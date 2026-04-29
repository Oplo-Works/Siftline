/**
 * Minimal Telegram Bot API wrapper.
 *
 * Uses fetch only — no third-party deps so we don't take on supply-chain risk
 * for what is essentially a JSON HTTP API.  Only the methods we actually need
 * are wrapped; raw `call()` is exposed for one-offs.
 *
 * Reference: https://core.telegram.org/bots/api
 */

const TELEGRAM_API_BASE = 'https://api.telegram.org'

export interface TgUser {
  id: number
  is_bot: boolean
  first_name: string
  last_name?: string
  username?: string
}

export interface TgChat {
  id: number
  type: 'private' | 'group' | 'supergroup' | 'channel'
  title?: string
  username?: string
  first_name?: string
  last_name?: string
}

export interface TgPhotoSize {
  file_id: string
  file_unique_id: string
  width: number
  height: number
  file_size?: number
}

export interface TgDocument {
  file_id: string
  file_unique_id: string
  file_name?: string
  mime_type?: string
  file_size?: number
}

export interface TgFile {
  file_id: string
  file_unique_id: string
  file_size?: number
  file_path?: string
}

export interface TgMessage {
  message_id: number
  from?: TgUser
  chat: TgChat
  date: number
  text?: string
  caption?: string
  media_group_id?: string
  photo?: TgPhotoSize[]
  document?: TgDocument
  entities?: Array<{
    type: string
    offset: number
    length: number
  }>
  reply_to_message?: TgMessage
}

export interface TgUpdate {
  update_id: number
  message?: TgMessage
  edited_message?: TgMessage
}

export interface TgSendMessageOptions {
  /** Disable web-link previews on the message. */
  disable_web_page_preview?: boolean
  /** Send silently (no notification ping). */
  disable_notification?: boolean
  /** Reply to a specific message. */
  reply_to_message_id?: number
  /** parse_mode is intentionally omitted — MVP sends plain text only. */
}

export interface TgApiError extends Error {
  errorCode?: number
  description?: string
  /** Telegram retry-after seconds for 429 / flood-wait. */
  retryAfter?: number
}

function makeError(message: string, errorCode?: number, description?: string, retryAfter?: number): TgApiError {
  const err = new Error(message) as TgApiError
  err.errorCode = errorCode
  err.description = description
  err.retryAfter = retryAfter
  return err
}

/**
 * Mask a bot token for log output: keeps prefix + last 4 chars.
 * Bot tokens look like `1234567890:AAH...` — we keep the numeric prefix
 * (which is the bot's own user_id and not really secret) and the suffix.
 */
export function maskToken(token: string): string {
  if (!token || token.length < 12) return '***'
  const colonIdx = token.indexOf(':')
  if (colonIdx === -1) return token.slice(0, 3) + '...' + token.slice(-3)
  return token.slice(0, colonIdx + 1) + '***' + token.slice(-4)
}

/**
 * Low-level Bot API call.  Throws TgApiError on non-`ok` responses or HTTP failures.
 *
 * `signal` lets callers tie a long-poll request to AbortController for graceful
 * shutdown.
 */
export async function tgCall<T = unknown>(
  token: string,
  method: string,
  params: Record<string, unknown> = {},
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<T> {
  if (!token) throw makeError('Bot token is empty')
  const url = `${TELEGRAM_API_BASE}/bot${token}/${method}`

  // Per-request timeout (separate from long-poll which uses signal externally)
  const timeoutMs = options.timeoutMs ?? 30_000
  const internalAbort = new AbortController()
  const timeoutId = setTimeout(() => internalAbort.abort(), timeoutMs)

  // Compose external + internal abort signals
  const externalSignal = options.signal
  const onExternalAbort = () => internalAbort.abort()
  if (externalSignal) {
    if (externalSignal.aborted) internalAbort.abort()
    else externalSignal.addEventListener('abort', onExternalAbort)
  }

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: internalAbort.signal,
    })
  } finally {
    clearTimeout(timeoutId)
    if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort)
  }

  let body: { ok: boolean; result?: T; description?: string; error_code?: number; parameters?: { retry_after?: number } }
  try {
    body = await res.json() as typeof body
  } catch (e) {
    throw makeError(`Telegram ${method}: invalid JSON response (HTTP ${res.status})`)
  }

  if (!body.ok) {
    throw makeError(
      `Telegram ${method} failed: ${body.description ?? '(no description)'}`,
      body.error_code,
      body.description,
      body.parameters?.retry_after
    )
  }
  return body.result as T
}

/**
 * Long-poll for new updates. `timeout` is in seconds (Telegram-side hold time).
 * Use the returned offset+1 as the next call's offset to skip processed updates.
 */
export function getUpdates(
  token: string,
  offset: number,
  timeout = 25,
  signal?: AbortSignal
): Promise<TgUpdate[]> {
  return tgCall<TgUpdate[]>(
    token,
    'getUpdates',
    {
      offset,
      timeout,
      // Only listen for what we use today.  Limits noise from edited_*, callback_*, etc.
      allowed_updates: ['message'],
    },
    { signal, timeoutMs: (timeout + 10) * 1000 }
  )
}

/** Send a plain-text message. parse_mode is intentionally not set. */
export function sendMessage(
  token: string,
  chatId: string | number,
  text: string,
  opts: TgSendMessageOptions = {}
): Promise<TgMessage> {
  return tgCall<TgMessage>(token, 'sendMessage', {
    chat_id: chatId,
    text,
    disable_web_page_preview: opts.disable_web_page_preview ?? true,
    disable_notification: opts.disable_notification,
    reply_to_message_id: opts.reply_to_message_id,
  })
}

/**
 * Send a "typing" / "upload_photo" indicator.  Telegram shows it for ~5 seconds.
 * Useful to acknowledge that a slow request is in progress.
 */
export function sendChatAction(
  token: string,
  chatId: string | number,
  action: 'typing' | 'upload_photo' | 'record_voice' = 'typing'
): Promise<true> {
  return tgCall<true>(token, 'sendChatAction', { chat_id: chatId, action })
}

/** Validate a token by hitting `getMe`.  Returns the bot's profile on success. */
export function getMe(token: string): Promise<TgUser> {
  return tgCall<TgUser>(token, 'getMe', {}, { timeoutMs: 10_000 })
}

export function getFile(token: string, fileId: string): Promise<TgFile> {
  return tgCall<TgFile>(token, 'getFile', { file_id: fileId }, { timeoutMs: 20_000 })
}

export async function downloadFileBytes(token: string, filePath: string): Promise<Uint8Array> {
  if (!token) throw makeError('Bot token is empty')
  if (!filePath) throw makeError('Telegram file path is empty')

  const url = `${TELEGRAM_API_BASE}/file/bot${token}/${filePath}`
  const res = await fetch(url)
  if (!res.ok) {
    throw makeError(`Telegram file download failed: HTTP ${res.status}`)
  }

  return new Uint8Array(await res.arrayBuffer())
}

/** Register a fixed slash-command list so Telegram clients show suggestions. */
export function setMyCommands(
  token: string,
  commands: Array<{ command: string; description: string }>
): Promise<true> {
  return tgCall<true>(token, 'setMyCommands', { commands })
}
