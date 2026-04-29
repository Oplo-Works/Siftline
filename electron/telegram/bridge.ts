import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import Store from 'electron-store'
import {
  downloadFileBytes,
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

export async function sendTelegramReply(text: string) {
  const config = getTelegramConfig()
  if (!config.enabled || !config.botToken || !config.chatId) return

  const chunks = formatForTelegram(text)
  for (const chunk of chunks) {
    await sendMessage(config.botToken, config.chatId, chunk)
  }
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

function buildTelegramBundles(updates: TgUpdate[], allowedChatId: string): TelegramMessageBundle[] {
  const bundles: TelegramMessageBundle[] = []

  for (let index = 0; index < updates.length; index += 1) {
    const message = updates[index]?.message
    if (!message) continue

    const chatId = message.chat.id.toString()
    if (allowedChatId && chatId !== allowedChatId) {
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
  })

  poll(config.botToken, config.chatId, pollingAbortController.signal)
}

export function stopTelegramBridge() {
  if (pollingAbortController) {
    pollingAbortController.abort()
    pollingAbortController = null
  }
  setTelegramAiReplyCallback(() => {})
}

async function poll(token: string, allowedChatId: string, signal: AbortSignal) {
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

      const bundles = buildTelegramBundles(updates, allowedChatId)
      for (const bundle of bundles) {
        queue.enqueue(async () => {
          const text = pickBundleText(bundle.messages)
          const attachments = await extractBundleAttachments(token, bundle.messages)
          if (!text && attachments.length === 0) return

          await handleTelegramCommand(text, async (replyText: string) => {
            await sendTelegramReply(replyText)
          }, attachments)
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
