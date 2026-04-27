import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import Store from 'electron-store'
import { downloadFile, getFile, getUpdates, sendMessage, type TgMessage } from './api.js'
import { handleTelegramCommand } from './commands.js'
import { SerialQueue } from './queue.js'
import { formatForTelegram } from './formatter.js'
import { buildFileContext, setTelegramAiReplyCallback } from '../main.js'

export interface TelegramConfig {
  enabled: boolean
  botToken: string
  chatId: string
  lastUpdateId: number
}

// Dedicated store for telegram
const tgStore = new Store<{ telegram: TelegramConfig }>({
  name: 'telegram-config',
  defaults: {
    telegram: {
      enabled: false,
      botToken: '',
      chatId: '',
      lastUpdateId: 0
    }
  }
})

let pollingAbortController: AbortController | null = null
const queue = new SerialQueue()

// Document extensions we can extract text from (mirrors extractFileContent in main.ts)
const SUPPORTED_DOC_EXTS = new Set(['pdf', 'docx', 'doc', 'xlsx', 'xls', 'txt', 'md', 'csv', 'json', 'html', 'htm'])

// Telegram Bot API caps downloads at 20 MB. We cap a bit lower for headroom.
const MAX_TELEGRAM_DOWNLOAD_BYTES = 20 * 1024 * 1024

interface DownloadedAttachment {
  name: string
  path: string
  ext: string
}

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

export function startTelegramBridge() {
  if (pollingAbortController) return // Already running
  const config = getTelegramConfig()
  if (!config.enabled || !config.botToken) return

  pollingAbortController = new AbortController()

  // Register callback for AI replies
  setTelegramAiReplyCallback((aiName, text) => {
    // Send it immediately (or put in queue?)
    // Formatting it nicely
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
  setTelegramAiReplyCallback(() => {}) // Clear callback
}

function getTempDir(): string {
  const dir = path.join(os.tmpdir(), 'ai-council-tg')
  try { fs.mkdirSync(dir, { recursive: true }) } catch { /* ignore */ }
  return dir
}

function extractExt(fileName: string | undefined, mimeType: string | undefined): string {
  if (fileName) {
    const dot = fileName.lastIndexOf('.')
    if (dot !== -1 && dot < fileName.length - 1) return fileName.slice(dot + 1).toLowerCase()
  }
  // Fallback: derive from common mime types
  if (mimeType) {
    const map: Record<string, string> = {
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'text/plain': 'txt',
      'text/markdown': 'md',
      'text/csv': 'csv',
      'application/json': 'json',
      'text/html': 'html',
    }
    if (map[mimeType]) return map[mimeType]
  }
  return ''
}

/**
 * Download any document attachment on a Telegram message into a temp dir.
 *
 * Photos are not supported in this MVP — vision/OCR is out of scope for the
 * web-automation-driven AI integrations. A user-facing notice is returned so
 * the caller can inform the sender.
 */
async function collectAttachments(
  token: string,
  message: TgMessage
): Promise<{ files: DownloadedAttachment[]; notices: string[] }> {
  const files: DownloadedAttachment[] = []
  const notices: string[] = []

  if (message.document) {
    const doc = message.document
    const ext = extractExt(doc.file_name, doc.mime_type)
    if (!SUPPORTED_DOC_EXTS.has(ext)) {
      notices.push(`⚠️ "${doc.file_name ?? 'file'}" (.${ext || 'unknown'}) is not a supported document type. Supported: ${[...SUPPORTED_DOC_EXTS].join(', ')}.`)
    } else if (doc.file_size && doc.file_size > MAX_TELEGRAM_DOWNLOAD_BYTES) {
      notices.push(`⚠️ "${doc.file_name ?? 'file'}" is larger than the 20 MB Telegram Bot API download limit and was skipped.`)
    } else {
      try {
        const meta = await getFile(token, doc.file_id)
        if (!meta.file_path) throw new Error('getFile returned no file_path')
        const buf = await downloadFile(token, meta.file_path)
        const safeName = (doc.file_name ?? `document.${ext}`).replace(/[^\w.\-]+/g, '_')
        const outPath = path.join(getTempDir(), `${Date.now()}_${safeName}`)
        fs.writeFileSync(outPath, buf)
        files.push({ name: doc.file_name ?? safeName, path: outPath, ext })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[Telegram] document download failed:', msg)
        notices.push(`❌ Failed to download "${doc.file_name ?? 'file'}": ${msg}`)
      }
    }
  }

  if (message.photo && message.photo.length > 0) {
    notices.push('⚠️ Image attachments are not supported yet — only document files (PDF, DOCX, XLSX, TXT, MD, CSV, JSON, HTML) are extracted and sent to the AIs.')
  }

  return { files, notices }
}

function cleanupAttachments(files: DownloadedAttachment[]): void {
  for (const f of files) {
    try { fs.unlinkSync(f.path) } catch { /* ignore */ }
  }
}

async function poll(token: string, allowedChatId: string, signal: AbortSignal) {
  let backoffMs = 1000

  while (!signal.aborted) {
    try {
      const config = getTelegramConfig()
      const updates = await getUpdates(token, config.lastUpdateId + 1, 25, signal)
      backoffMs = 1000 // Reset backoff on success

      for (const update of updates) {
        if (update.update_id > config.lastUpdateId) {
          tgStore.set('telegram.lastUpdateId', update.update_id)
        }

        const message = update.message
        if (!message) continue

        // Accept either text-only messages or messages with a caption + attachment.
        const textPart = message.text ?? message.caption ?? ''
        const hasAttachment = !!message.document || !!(message.photo && message.photo.length)
        if (!textPart && !hasAttachment) continue

        const chatId = message.chat.id.toString()
        if (allowedChatId && chatId !== allowedChatId) {
          console.log(`[Telegram] Rejected message from unauthorized chat_id: ${chatId}`)
          continue
        }

        // Enqueue message processing
        queue.enqueue(async () => {
          let downloaded: DownloadedAttachment[] = []
          try {
            let fileContext = ''
            if (hasAttachment) {
              const { files, notices } = await collectAttachments(token, message)
              downloaded = files
              for (const note of notices) {
                await sendTelegramReply(note)
              }
              if (files.length > 0) {
                // Extract text NOW so we can delete the temp files immediately
                // — apiSendCouncilMessage runs council turns asynchronously,
                // so file paths can't safely outlive this scope.
                fileContext = await buildFileContext(files)
              }
            }

            // Nothing actionable: no text/caption AND no extractable file content.
            if (!textPart && !fileContext) return

            // When the user sends a bare attachment with no caption, give the
            // council intent parser a sensible default so an AI is mentioned.
            const baseText = textPart || `@all Please review the attached file${downloaded.length > 1 ? 's' : ''}.`
            const effectiveText = fileContext ? `${baseText}${fileContext}` : baseText

            await handleTelegramCommand(
              effectiveText,
              async (text: string) => { await sendTelegramReply(text) }
            )
          } finally {
            cleanupAttachments(downloaded)
          }
        })
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || signal.aborted) break
      console.error('[Telegram] Polling error:', err.message)
      await new Promise(r => setTimeout(r, backoffMs))
      backoffMs = Math.min(backoffMs * 2, 30000)
    }
  }
}
