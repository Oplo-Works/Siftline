import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import Store from 'electron-store'
import {
  downloadFileBytes,
  editMessageText,
  getFile,
  getUpdates,
  sendMessage,
  type TgDocument,
  type TgMessage,
  type TgPhotoSize,
  type TgUpdate,
} from './api.js'
import { handleTelegramCommand } from './commands.js'
import { SerialQueue } from './queue.js'
import { formatForTelegram } from './formatter.js'
import { setTelegramAiReplyCallback } from '../main.js'

export interface TelegramConfig {
  enabled: boolean
  botToken: string
  chatId: string
  /** Comma-separated additional whitelisted chat IDs.  Empty = only `chatId` is allowed. */
  allowedChatIds?: string
  lastUpdateId: number
}

interface TelegramAttachment {
  name: string
  path: string
  ext: string
}

interface TelegramMessageBundle {
  chatId: string
  messages: TgMessage[]
}

const SUPPORTED_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'])

const tgStore = new Store<{ telegram: TelegramConfig }>({
  name: 'telegram-config',
  defaults: {
    telegram: {
      enabled: false,
      botToken: '',
      chatId: '',
      allowedChatIds: '',
      lastUpdateId: 0,
    },
  },
})

let pollingAbortController: AbortController | null = null
const queue = new SerialQueue()

export function getTelegramConfig() {
  return tgStore.get('telegram')
}

export function setTelegramConfig(config: Partial<TelegramConfig>) {
  const current = getTelegramConfig()
  const next = { ...current, ...config }
  tgStore.set('telegram', next)

  if (next.enabled && next.botToken) {
    startTelegramBridge()
  } else {
    stopTelegramBridge()
  }
  return next
}

// ─── Whitelist resolution ────────────────────────────────────────────────────
// Returns the effective set of allowed chat_ids.  If neither `chatId` nor
// `allowedChatIds` is set, returns null which signals legacy "accept any chat"
// behavior — preserved so existing setups don't break, but flagged with a log.
function resolveAllowedChatIds(config: TelegramConfig): Set<string> | null {
  const ids = new Set<string>()
  if (config.chatId && config.chatId.trim()) {
    ids.add(config.chatId.trim())
  }
  if (config.allowedChatIds && config.allowedChatIds.trim()) {
    for (const raw of config.allowedChatIds.split(',')) {
      const trimmed = raw.trim()
      if (trimmed) ids.add(trimmed)
    }
  }
  return ids.size > 0 ? ids : null
}

// ─── Active session: tracks which chat we're replying to right now and the
// progressive-streaming "checklist" status message that gets edited as each
// AI in the broadcast completes.  Set by commands.ts before kicking off
// council work; cleared after the broadcast resolves.
interface CouncilSession {
  chatId: string
  targets: string[]                  // AiName[] — kept as string here to avoid circular import
  remaining: Set<string>
  done: Map<string, number>           // AiName -> elapsed ms
  failed: Set<string>
  statusMessageId: number | null
  startedAt: number
  displayNames: Record<string, string>
}
let activeSession: CouncilSession | null = null

function getActiveChatId(): string {
  if (activeSession) return activeSession.chatId
  return getTelegramConfig().chatId
}

export async function sendTelegramReply(text: string, overrideChatId?: string) {
  const config = getTelegramConfig()
  if (!config.enabled || !config.botToken) return
  const chatId = overrideChatId || getActiveChatId()
  if (!chatId) return

  const chunks = formatForTelegram(text)
  for (const chunk of chunks) {
    await sendMessage(config.botToken, chatId, chunk)
  }
}

function renderStatusBlock(session: CouncilSession): string {
  const lines: string[] = []
  const elapsedSec = Math.max(0, Math.round((Date.now() - session.startedAt) / 1000))
  const allDone = session.remaining.size === 0
  const header = allDone
    ? `Council 완료 (${formatDuration(elapsedSec)})`
    : `Council 처리 중... (${formatDuration(elapsedSec)} 경과)`
  lines.push(header)
  for (const ai of session.targets) {
    const display = session.displayNames[ai] ?? ai
    if (session.done.has(ai)) {
      const ms = session.done.get(ai) ?? 0
      lines.push(`  [완료] ${display} (${formatDuration(Math.round(ms / 1000))})`)
    } else if (session.failed.has(ai)) {
      lines.push(`  [실패] ${display}`)
    } else {
      lines.push(`  [대기] ${display}...`)
    }
  }
  return lines.join('\n')
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}초`
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  return sec === 0 ? `${min}분` : `${min}분 ${sec}초`
}

export async function beginCouncilSession(params: {
  chatId: string
  targets: string[]
  displayNames: Record<string, string>
}): Promise<void> {
  // Initialize the session and post the initial status message.  Subsequent
  // per-AI completions will edit this message in place.
  const config = getTelegramConfig()
  if (!config.enabled || !config.botToken) return

  activeSession = {
    chatId: params.chatId,
    targets: params.targets.slice(),
    remaining: new Set(params.targets),
    done: new Map(),
    failed: new Set(),
    statusMessageId: null,
    startedAt: Date.now(),
    displayNames: params.displayNames,
  }

  try {
    const initialText = renderStatusBlock(activeSession)
    const sent = await sendMessage(config.botToken, params.chatId, initialText)
    activeSession.statusMessageId = sent.message_id
  } catch (err) {
    console.error('[Telegram] Failed to post initial status message:', err)
  }
}

async function refreshStatusMessage(): Promise<void> {
  if (!activeSession || activeSession.statusMessageId === null) return
  const config = getTelegramConfig()
  if (!config.enabled || !config.botToken) return

  const text = renderStatusBlock(activeSession)
  try {
    await editMessageText(config.botToken, activeSession.chatId, activeSession.statusMessageId, text)
  } catch (err: any) {
    // "message is not modified" is harmless; everything else gets logged once
    if (!String(err?.description ?? err?.message ?? '').includes('not modified')) {
      console.error('[Telegram] editMessageText failed:', err?.message ?? err)
    }
  }
}

export function markSessionAiDone(ai: string): void {
  if (!activeSession) return
  if (!activeSession.remaining.has(ai)) return
  const elapsedMs = Date.now() - activeSession.startedAt
  activeSession.done.set(ai, elapsedMs)
  activeSession.remaining.delete(ai)
  // Edit fires through the queue so it serializes with reply messages, keeping
  // the order on the user's screen consistent.
  queue.enqueue(() => refreshStatusMessage())
}

export async function endCouncilSession(): Promise<void> {
  if (!activeSession) return
  // Anything still in `remaining` after the broadcast resolves is treated as
  // failed — covers AIs whose processCouncilTurn rejected before firing the
  // reply callback.
  for (const ai of activeSession.remaining) {
    activeSession.failed.add(ai)
  }
  activeSession.remaining.clear()
  await new Promise<void>((resolve) => queue.enqueue(async () => { await refreshStatusMessage(); resolve() }))
  activeSession = null
}

function ensureTelegramTempDir() {
  const dir = path.join(app.getPath('temp'), 'ai-council-telegram')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function sanitizeFileName(name: string) {
  const cleaned = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim()
  return cleaned.length > 0 ? cleaned.slice(0, 120) : 'telegram-file'
}

function getExtensionFromName(name: string | undefined | null) {
  return path.extname(name ?? '').replace('.', '').toLowerCase()
}

const SUPPORTED_DOCUMENT_EXTENSIONS = new Set([
  // Documents
  'pdf', 'doc', 'docx', 'xls', 'xlsx',
  'txt', 'md', 'csv', 'json', 'html', 'htm',
  // Images
  ...SUPPORTED_IMAGE_EXTENSIONS,
])

const SUPPORTED_MIME_PREFIXES = ['image/', 'text/', 'application/pdf', 'application/msword',
  'application/vnd.openxmlformats', 'application/vnd.ms-excel', 'application/json']

function isSupportedTelegramDocument(document: TgDocument | undefined) {
  if (!document) return false
  const mimeType = document.mime_type?.toLowerCase() ?? ''
  const ext = getExtensionFromName(document.file_name)
  return SUPPORTED_DOCUMENT_EXTENSIONS.has(ext)
    || SUPPORTED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix))
}

async function downloadTelegramAttachment(
  token: string,
  fileId: string,
  preferredName: string,
  fallbackExt: string,
): Promise<TelegramAttachment> {
  const file = await getFile(token, fileId)
  if (!file.file_path) {
    throw new Error(`Telegram file ${fileId} did not include file_path`)
  }

  const bytes = await downloadFileBytes(token, file.file_path)
  const ext = getExtensionFromName(preferredName) || getExtensionFromName(file.file_path) || fallbackExt
  const baseName = sanitizeFileName(preferredName || path.basename(file.file_path))
  const finalName = baseName.includes('.') ? baseName : `${baseName}.${ext || fallbackExt}`
  const uniquePrefix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const finalPath = path.join(ensureTelegramTempDir(), `${uniquePrefix}-${finalName}`)
  await fs.promises.writeFile(finalPath, Buffer.from(bytes))

  return {
    name: finalName,
    path: finalPath,
    ext: ext || fallbackExt,
  }
}

async function downloadPhotoAttachment(token: string, photo: TgPhotoSize, messageId: number) {
  return downloadTelegramAttachment(token, photo.file_id, `telegram-photo-${messageId}.jpg`, 'jpg')
}

async function downloadDocumentAttachment(token: string, document: TgDocument, messageId: number) {
  const fallbackName = document.file_name?.trim() || `telegram-file-${messageId}`
  const fallbackExt = getExtensionFromName(document.file_name) || 'bin'
  return downloadTelegramAttachment(token, document.file_id, fallbackName, fallbackExt)
}

async function extractBundleAttachments(token: string, messages: TgMessage[]): Promise<TelegramAttachment[]> {
  const attachments: TelegramAttachment[] = []

  for (const message of messages) {
    if (Array.isArray(message.photo) && message.photo.length > 0) {
      const preferred = [...message.photo].sort((a, b) => (a.file_size ?? 0) - (b.file_size ?? 0)).at(-1) ?? message.photo[message.photo.length - 1]
      if (preferred) {
        try {
          attachments.push(await downloadPhotoAttachment(token, preferred, message.message_id))
        } catch (err) {
          console.error('[Telegram] Failed to download photo attachment:', err)
        }
      }
    }

    if (isSupportedTelegramDocument(message.document)) {
      try {
        attachments.push(await downloadDocumentAttachment(token, message.document!, message.message_id))
      } catch (err) {
        console.error('[Telegram] Failed to download document attachment:', err)
      }
    }
  }

  return attachments
}

function buildTelegramBundles(updates: TgUpdate[], allowedChatIds: Set<string> | null): TelegramMessageBundle[] {
  const bundles: TelegramMessageBundle[] = []

  for (let index = 0; index < updates.length; index += 1) {
    const message = updates[index]?.message
    if (!message) continue

    const chatId = message.chat.id.toString()
    if (allowedChatIds && !allowedChatIds.has(chatId)) {
      console.log(`[Telegram] Rejected message from unauthorized chat_id: ${chatId}`)
      continue
    }

    const mediaGroupId = message.media_group_id?.trim()
    if (!mediaGroupId) {
      bundles.push({ chatId, messages: [message] })
      continue
    }

    const groupedMessages: TgMessage[] = [message]
    while (index + 1 < updates.length) {
      const nextMessage = updates[index + 1]?.message
      if (!nextMessage) break
      const nextChatId = nextMessage.chat.id.toString()
      if (nextChatId !== chatId || nextMessage.media_group_id?.trim() !== mediaGroupId) break
      groupedMessages.push(nextMessage)
      index += 1
    }

    bundles.push({ chatId, messages: groupedMessages })
  }

  return bundles
}

function pickBundleText(messages: TgMessage[]) {
  for (const message of messages) {
    const candidate = message.caption ?? message.text ?? ''
    const trimmed = candidate.trim()
    if (trimmed) return trimmed
  }
  return ''
}

export function startTelegramBridge() {
  if (pollingAbortController) return
  const config = getTelegramConfig()
  if (!config.enabled || !config.botToken) return

  pollingAbortController = new AbortController()

  setTelegramAiReplyCallback((aiName, text) => {
    const prefix = `**${aiName}**:\n\n`
    queue.enqueue(() => sendTelegramReply(prefix + text))
    // Mark this AI as done in the active session (no-op if no session active
    // or if this AI wasn't part of the broadcast).
    markSessionAiDone(aiName)
  })

  poll(config.botToken, pollingAbortController.signal)
}

export function stopTelegramBridge() {
  if (pollingAbortController) {
    pollingAbortController.abort()
    pollingAbortController = null
  }
  setTelegramAiReplyCallback(() => {})
}

async function poll(token: string, signal: AbortSignal) {
  let backoffMs = 1000

  while (!signal.aborted) {
    try {
      const config = getTelegramConfig()
      const updates = await getUpdates(token, config.lastUpdateId + 1, 25, signal)
      backoffMs = 1000

      for (const update of updates) {
        if (update.update_id > config.lastUpdateId) {
          tgStore.set('telegram.lastUpdateId', update.update_id)
        }
      }

      // Resolve whitelist on every batch so config changes take effect on the
      // next poll without needing a bridge restart.
      const allowedChatIds = resolveAllowedChatIds(config)
      if (allowedChatIds === null && updates.length > 0) {
        console.warn('[Telegram] No chat_id whitelist configured — accepting messages from any chat. Set chatId or allowedChatIds in Telegram settings.')
      }

      const bundles = buildTelegramBundles(updates, allowedChatIds)
      for (const bundle of bundles) {
        queue.enqueue(async () => {
          const text = pickBundleText(bundle.messages)
          const attachments = await extractBundleAttachments(token, bundle.messages)
          if (!text && attachments.length === 0) return

          await handleTelegramCommand(text, async (replyText: string) => {
            await sendTelegramReply(replyText, bundle.chatId)
          }, attachments, bundle.chatId)
        })
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || signal.aborted) break
      console.error('[Telegram] Polling error:', err.message)
      await new Promise((resolve) => setTimeout(resolve, backoffMs))
      backoffMs = Math.min(backoffMs * 2, 30000)
    }
  }
}
