import Store from 'electron-store'
import { getUpdates, sendMessage } from './api.js'
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
        if (!message || !message.text) continue
        
        const chatId = message.chat.id.toString()
        if (allowedChatId && chatId !== allowedChatId) {
          console.log(`[Telegram] Rejected message from unauthorized chat_id: ${chatId}`)
          continue
        }
        
        // Enqueue message processing
        queue.enqueue(async () => {
          await handleTelegramCommand(message.text!, async (text: string) => {
             await sendTelegramReply(text)
          })
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
