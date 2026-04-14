import {
  app,
  BrowserWindow,
  BrowserView,
  WebContents,
  session,
  ipcMain,
  Rectangle,
  dialog,
} from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import fs from 'fs'

const require = createRequire(import.meta.url)
// electron-store ships CJS
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Store = require('electron-store')

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── Chromium flags (must be set before app.ready) ───────────────────────────
// Disable QUIC (HTTP/3): Gemini uses QUIC and its connection fingerprint
// can reveal Electron even when UA/headers are spoofed. Falling back to
// HTTP/2 over TLS removes that detection vector.
app.commandLine.appendSwitch('disable-quic')
// Ensure navigator.webdriver is not exposed (some Google services check this)
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled')

// ─── Types ───────────────────────────────────────────────────────────────────
export type AiName = 'gemini' | 'claude' | 'chatgpt' | 'perplexity'

interface AiConfig {
  url: string
  /** URL to navigate to for a fresh/new conversation — avoids old-response bleed-through */
  newChatUrl: string
  inputSelectors: string[]
  sendButtonSelectors: string[]
  responseContainerSelectors: string[]
  loadedIndicatorSelectors: string[]
}

interface StoreSchema {
  chatHistory: Array<{
    id: string
    query: string
    primaryAi: AiName
    result: string
    timestamp: number
  }>
  windowBounds: Rectangle
}

// ─── Inline Selectors Config ──────────────────────────────────────────────────
// Defaults are bundled inline; user can override by placing selectors.json
// in the app's userData directory.
const DEFAULT_SELECTORS: Record<AiName, AiConfig> = {
  gemini: {
    url: 'https://gemini.google.com',
    newChatUrl: 'https://gemini.google.com/app',
    inputSelectors: [
      'rich-textarea .ql-editor[contenteditable="true"]',
      'div[contenteditable="true"][data-placeholder]',
      'div[contenteditable="true"]',
      'textarea[placeholder]',
    ],
    sendButtonSelectors: [
      'button[data-test-id="send-button"]',
      'button[aria-label="Send message"]',
      'button.send-button',
      'button[jsaction*="send"]',
    ],
    responseContainerSelectors: [
      // Confirmed via DOM dump (2026-04): message-content is a custom element
      // containing the full model response text.
      'message-content',
      // response-container-content wraps message-content — good as backup
      '.response-container-content',
      // markdown block inside message-content
      'message-content .markdown',
      '.model-response-text',
    ],
    loadedIndicatorSelectors: ['rich-textarea', 'div[contenteditable]'],
  },
  claude: {
    url: 'https://claude.ai',
    newChatUrl: 'https://claude.ai/new',
    inputSelectors: [
      'div[contenteditable="true"][data-placeholder]',
      '.ProseMirror[contenteditable="true"]',
      'div[contenteditable="true"]',
    ],
    sendButtonSelectors: [
      'button[aria-label="Send Message"]',
      'button[aria-label="Send message"]',
      'button[data-testid="send-button"]',
    ],
    responseContainerSelectors: [
      // Confirmed via DOM dump (2026-04): Claude wraps responses in
      // div.font-claude-response (NOT .font-claude-message)
      '.font-claude-response',
      // data-is-streaming scoped variant (streaming=false = done)
      '[data-is-streaming="false"] .font-claude-response',
      // standard-markdown grid inside the response div
      '.standard-markdown',
    ],
    loadedIndicatorSelectors: ['div[contenteditable]', '.ProseMirror'],
  },
  chatgpt: {
    url: 'https://chatgpt.com',
    newChatUrl: 'https://chatgpt.com',
    inputSelectors: [
      '#prompt-textarea',
      'div[contenteditable="true"][id="prompt-textarea"]',
      'div[contenteditable="true"]',
    ],
    sendButtonSelectors: [
      'button[data-testid="send-button"]',
      'button[aria-label="Send prompt"]',
      'button[aria-label="Send message"]',
    ],
    responseContainerSelectors: [
      // Confirmed via DOM dump (2026-04): ChatGPT uses markdown-new-styling
      '.markdown-new-styling',
      'div[data-message-author-role="assistant"] .markdown',
      '[data-message-author-role="assistant"] .prose',
    ],
    loadedIndicatorSelectors: ['#prompt-textarea', 'div[contenteditable]'],
  },
  perplexity: {
    url: 'https://www.perplexity.ai',
    newChatUrl: 'https://www.perplexity.ai',
    inputSelectors: [
      // Perplexity home/search box (2025 UI — placeholder varies)
      'textarea[placeholder*="Ask"]',
      'textarea[placeholder*="anything"]',
      'textarea[placeholder*="search"]',
      'textarea[placeholder*="Search"]',
      'textarea[placeholder*="Follow"]',
      // conversation page follow-up textarea (class-based fallback)
      'textarea[class*="overflow"]',
      'textarea[rows]',
      // last resort: any textarea on the page
      'textarea',
      // rare contenteditable variant
      '[contenteditable="true"][data-placeholder]',
      'div[contenteditable="true"]',
    ],
    sendButtonSelectors: [
      'button[aria-label="Submit"]',
      'button[aria-label="Send"]',
      'button[data-testid="submit-button"]',
      'button[type="submit"]',
      'button[class*="send"]',
      'button[class*="submit"]',
    ],
    responseContainerSelectors: [
      // Confirmed via DOM dump (2026-04): response lives inside
      // <div id="markdown-content-0"> (and subsequent -1, -2 for follow-ups)
      '[id^="markdown-content"]',
      // prose block wrapping each answer paragraph
      '.prose.dark\\:prose-invert',
      '[class*="prose"][class*="inline"]',
      '[class*="prose"]',
    ],
    loadedIndicatorSelectors: ['textarea', 'div[contenteditable]', '[contenteditable]'],
  },
}

/** Load selectors: use userData override if present, else use bundled defaults */
function loadSelectorsConfig(): Record<AiName, AiConfig> {
  try {
    const overridePath = path.join(app.getPath('userData'), 'selectors.json')
    if (fs.existsSync(overridePath)) {
      const raw = fs.readFileSync(overridePath, 'utf-8')
      return JSON.parse(raw) as Record<AiName, AiConfig>
    }
  } catch {
    // fall through to defaults
  }
  return DEFAULT_SELECTORS
}

let selectorsConfig: Record<AiName, AiConfig> = DEFAULT_SELECTORS
const store = new Store<StoreSchema>({
  defaults: {
    chatHistory: [],
    windowBounds: { x: 0, y: 0, width: 1280, height: 720 },
  },
})

let mainWindow: BrowserWindow | null = null
const views: Map<AiName, BrowserView> = new Map()
const AI_NAMES: AiName[] = ['gemini', 'claude', 'chatgpt', 'perplexity']
let resizeDebounceTimer: ReturnType<typeof setTimeout> | null = null

// ─── UI Layout Constants ──────────────────────────────────────────────────────
const TITLEBAR_HEIGHT = 40
const TOOLBAR_HEIGHT = 62
const ATTACHMENT_BAR_HEIGHT = 34   // shown when files are attached
const STATUS_BAR_HEIGHT = 36
const FINAL_PANEL_HEADER_H = 36   // collapsed: header only
const FINAL_PANEL_FULL_H = 260  // expanded: full content
let finalPanelExpanded = false
const FINAL_PANEL_HEIGHT = 0      // legacy — not used directly below
const PANEL_HEADER_HEIGHT = 36

// Dynamically updated when attachment bar visibility changes
let attachmentBarVisible = false

// ─── Browser Identity Spoofing ───────────────────────────────────────────────
// Electron exposes itself via User-Agent AND sec-ch-ua headers, which causes
// Gemini (and other Google services) to return 502. We must replace both.
// Chrome version is read from process.versions.chrome at runtime so it stays
// in sync automatically whenever Electron is updated — no manual edits needed.
const _CHROME_FULL = process.versions.chrome                 // e.g. "146.0.7680.179"
const _CHROME_MAJOR = _CHROME_FULL.split('.')[0]              // e.g. "146"

const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  `Chrome/${_CHROME_MAJOR}.0.0.0 Safari/537.36`

// Chrome spoof preload path — needed both inside createWindow() and in the
// global web-contents-created handler for OAuth popup windows.
const CHROME_SPOOF_PRELOAD = path.join(__dirname, 'preload-chrome-spoof.js')

// Client-hint headers derived from the actual bundled Chromium version
const CHROME_CLIENT_HINTS: Record<string, string> = {
  'sec-ch-ua': `"Chromium";v="${_CHROME_MAJOR}", "Google Chrome";v="${_CHROME_MAJOR}", "Not-A.Brand";v="24"`,
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-ch-ua-full-version-list': `"Chromium";v="${_CHROME_FULL}", "Google Chrome";v="${_CHROME_FULL}", "Not-A.Brand";v="24.0.0.0"`,
}

// ─── Workflow Timing Constants ────────────────────────────────────────────────
const WORKFLOW_TIMEOUT_MS = 120_000   // max wait for AI response (2 min)
const STABLE_RESPONSE_MS = 2_500     // ms of DOM stability = response complete
const POLL_INTERVAL_INITIAL_MS = 400 // starting poll interval (exponential backoff)
const POLL_INTERVAL_MAX_MS = 2_000   // max poll interval
const CLICK_SEND_DELAY_MS = 800      // pause before clicking send
const REVIEWER_SEND_DELAY_MS = 600   // pause before reviewer send
// (typing delays removed — text is now pasted instantly)
const SELECTOR_JS_TIMEOUT_MS = 5_000 // max wait for a single JS execution
const RESIZE_DEBOUNCE_MS = 200            // resize event debounce delay
// After clicking Send, wait this long before starting to poll.
// Prevents the UI's "old response" from being captured before the page
// clears it and starts rendering the new response.
const INITIAL_RESPONSE_WAIT_MS = 3_000  // 3 s warm-up after Send
// Max time text can stay "stable" while streaming guard still returns true.
// After this duration we treat the streaming indicator as a false positive
// and accept the text anyway.
const STREAMING_GUARD_OVERRIDE_MS = 8_000  // force-accept after 8 s of stable text

// ─── Streaming Detection ─────────────────────────────────────────────────────
// These selectors are present in the DOM ONLY while the AI is still generating.
// If any match, we must keep waiting even if text appears stable.
const STREAMING_INDICATOR_SELECTORS: Partial<Record<AiName, string[]>> = {
  chatgpt: [
    '[data-testid="stop-button"]',
    'button[aria-label="Stop streaming"]',
    'button[aria-label="Stop generating"]',
    '.result-streaming',          // ChatGPT streaming CSS class
  ],
  claude: [
    'button[aria-label="Stop Response"]',
    '[data-value="stop"]',
  ],
  gemini: [
    // NOTE: Only use aria-label based selectors. data-test-id selectors
    // can be present even when NOT streaming and cause infinite wait.
    'button[aria-label="Stop response"]',
  ],
  perplexity: [
    'button[aria-label="Stop"]',
  ],
}

// ─── Response Quality Filter ──────────────────────────────────────────────────
// Patterns that identify UI boilerplate / disclaimer text that appears on the
// page at all times — NOT an actual AI answer. We must never treat them as the
// response content to send to the other reviewers.
const DISCLAIMER_PATTERNS: RegExp[] = [
  /chatgpt can make mistakes/i,
  /check important info/i,
  /may produce inaccurate information/i,
  /ai can make mistakes/i,
  /responses may be inaccurate/i,
  // Perplexity landing page placeholder text — not a real answer
  /^what do you want to know\??$/i,
  /^ask anything$/i,
  /^search the web$/i,
  /^type.*search.*shortcuts$/i,
]

// ─── Data Constants ───────────────────────────────────────────────────────────
const HISTORY_MAX_ITEMS = 50
const QUERY_MAX_LENGTH = 10_000

// ─── Status Messages ──────────────────────────────────────────────────────────
const MSG = {
  injecting: (ai: AiName) => `Typing question into ${ai}...`,
  sending: (ai: AiName) => `Sending question to ${ai}...`,
  waitingPrimary: (ai: AiName) => `${ai} is generating a response... (up to 2 min)`,
  sendingReviews: () => 'Sending review requests to reviewer AIs...',
  waitingReviewer: (ai: AiName) => `Waiting for ${ai}'s review...`,
  collectingFeedbacks: () => 'Collecting feedback from all reviewers...',
  sendingRevision: (ai: AiName) => `Sending final revision request to ${ai}...`,
  waitingFinal: (ai: AiName) => `Waiting for ${ai}'s final revised answer...`,
  done: () => '✅ Done! Final answer is ready.',
  error: (msg: string) => `❌ Error: ${msg}`,
} as const

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getSelectors(ai: AiName): AiConfig {
  return selectorsConfig[ai]
}

/**
 * Strip citation markers and UI boilerplate that AIs inject into their text:
 *   - Perplexity:  [1] [2] … inline citation badges
 *   - Gemini:      ¹ ² ³ superscript footnotes
 *   - ChatGPT:     【1†source】 or 【doc.pdf†source】 markers
 * Trimming these gives stable comparison across polls so the stability timer
 * doesn't keep resetting just because a badge was added at the end.
 */
function sanitizeResponseText(text: string): string {
  if (!text) return ''
  return text
    // Perplexity / standard citation brackets: [1], [2], [1][2], etc.
    .replace(/\[\d+\](\[\d+\])*/g, '')
    // ChatGPT file-citation markers: 【1†source】
    .replace(/【\d+[††][^】]*】/g, '')
    // Superscript digit footnotes (Gemini)
    .replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]+/g, '')
    // Collapse whitespace left by removed markers
    .replace(/ {2,}/g, ' ')
    .trim()
}

/** Returns true if the text is a real AI answer (not a disclaimer / too short). */
function isQualityResponse(text: string): boolean {
  if (text.length < 50) return false
  // Reject if the text is ONLY a disclaimer phrase (guards against footer bleed-through)
  const isOnlyDisclaimer = DISCLAIMER_PATTERNS.some((p) => p.test(text)) && text.length < 400
  return !isOnlyDisclaimer
}

/** Returns true if any streaming-indicator element exists in the view's DOM. */
async function checkIsStreaming(view: BrowserView, indicators: string[]): Promise<boolean> {
  for (const sel of indicators) {
    try {
      const found = await executeWithTimeout(
        view.webContents,
        `!!document.querySelector(\`${sel}\`)`,
        2_000
      )
      if (found) return true
    } catch {
      // ignore — assume not streaming
    }
  }
  return false
}

function sendStatus(msg: string) {
  mainWindow?.webContents.send('status-update', msg)
}

function sendLog(level: 'info' | 'warn' | 'error', msg: string) {
  mainWindow?.webContents.send('log', { level, msg })
}

/** Execute JS with a hard timeout to prevent indefinite hangs */
function executeWithTimeout(
  webContents: WebContents,
  script: string,
  timeoutMs = SELECTOR_JS_TIMEOUT_MS
): Promise<unknown> {
  return Promise.race([
    webContents.executeJavaScript(script),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`JS execution timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ])
}

/** Try multiple selectors until one matches, returns JS result.
 *  Logs each failure as a warn for easier debugging. */
async function execWithFallback(
  view: BrowserView,
  selectors: string[],
  buildScript: (sel: string) => string
): Promise<{ success: boolean; selector?: string; result?: unknown }> {
  for (const sel of selectors) {
    try {
      const result = await executeWithTimeout(view.webContents, buildScript(sel))
      if (result !== null && result !== undefined && result !== false) {
        return { success: true, selector: sel, result }
      }
    } catch (err) {
      sendLog('warn', `Selector "${sel}" failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return { success: false }
}

/** Instant paste — inserts the full text at once via clipboard-style execCommand.
 *  Works for both contenteditable (Gemini, Claude, ChatGPT) and
 *  native textarea elements (Perplexity).
 *
 *  For React-controlled textareas (e.g. Perplexity) the native value setter
 *  must be used AND a full synthetic event chain dispatched so React's
 *  internal fiber state is updated and the submit button is enabled. */
async function pasteText(view: BrowserView, text: string, selector: string) {
  const jsonSelector = JSON.stringify(selector)

  // Focus the target element first
  await view.webContents.executeJavaScript(`
    (() => {
      const target = document.querySelector(${jsonSelector});
      if (!target) return false;
      if (target.isContentEditable) {
        // contenteditable: select all then use execCommand so existing text is replaced
        target.click();
        target.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, ${JSON.stringify(text)});
        return true;
      }
      target.click();
      target.focus();
      // Clear any existing value first
      target.select?.();
      return true;
    })()
  `)

  // Use Electron clipboard + Ctrl+A/Ctrl+V via sendInputEvent.
  // This is the only approach that reliably triggers React's onChange for
  // controlled textareas — JS-dispatched events are intercepted by React
  // before they update internal state, keeping the submit button disabled.
  const { clipboard } = require('electron')
  clipboard.writeText(text)

  // Ctrl+A to clear, then Ctrl+V to paste
  view.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'A', modifiers: ['ctrl'] })
  view.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'A', modifiers: ['ctrl'] })
  await sleep(50)
  view.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'V', modifiers: ['ctrl'] })
  view.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'V', modifiers: ['ctrl'] })
  await sleep(100)
}

/**
 * Navigate a BrowserView to a fresh/new conversation page.
 * This is called before every AI interaction so there is no leftover text
 * from a previous session — removing the need for baseline comparison.
 */
async function navigateToNewChat(view: BrowserView, ai: AiName): Promise<void> {
  const config = getSelectors(ai)
  const url = config.newChatUrl || config.url
  sendLog('info', `[nav] ${ai} → ${url}`)

  // 1) Navigate and wait for initial page load
  await new Promise<void>((resolve) => {
    let resolved = false
    const done = () => { if (!resolved) { resolved = true; resolve() } }
    view.webContents.once('did-finish-load', done)
    setTimeout(done, 15_000)
    view.webContents.loadURL(url, { userAgent: DESKTOP_USER_AGENT }).catch((err) => {
      sendLog('warn', `[nav] ${ai} load error: ${err.message}`)
      done()
    })
  })

  // 2) Poll until the input box is actually ready in the DOM
  //    React / Next.js apps hydrate AFTER did-finish-load, so we must wait.
  const deadline = Date.now() + 20_000   // max 20 s total
  let inputFound = false
  while (Date.now() < deadline) {
    for (const sel of config.inputSelectors) {
      try {
        const found = await executeWithTimeout(
          view.webContents,
          `!!document.querySelector(\`${sel}\`)`,
          2_000
        ) as boolean
        if (found) {
          inputFound = true
          break
        }
      } catch { /* keep polling */ }
    }
    if (inputFound) break
    await sleep(500)
  }

  if (inputFound) {
    sendLog('info', `[nav] ${ai} input ready`)
  } else {
    sendLog('warn', `[nav] ${ai} input NOT found after 20s — proceeding anyway`)
  }

  // Extra brief pause to let React finish any event-handler binding
  await sleep(800)
}


/** Capture the full visible body text — used as a pre-injection baseline so
 *  landing-page content (e.g. Perplexity's "What do you want to know?") is
 *  never mistaken for a real AI answer. Falls back to empty string on error. */
async function capturePageBaseline(view: BrowserView): Promise<string> {
  try {
    const text = await executeWithTimeout(
      view.webContents,
      `(document.body?.innerText || '').trim()`,
      3_000
    ) as string
    return sanitizeResponseText(text ?? '')
  } catch {
    return ''
  }
}

/** Capture the current response-area text from a view — used as a baseline
 *  before clicking Send so we never mistake an OLD response for a new one. */
async function captureCurrentText(
  view: BrowserView,
  selectors: string[]
): Promise<string> {
  for (const sel of selectors) {
    try {
      const text = await executeWithTimeout(
        view.webContents,
        `(() => {
          const els = document.querySelectorAll(\`${sel}\`);
          if (!els.length) return '';
          return els[els.length - 1]?.innerText?.trim() || '';
        })()`,
        3_000
      ) as string
      if (text && text.length > 10) return text
    } catch {
      // ignore
    }
  }
  return ''
}

/** Wait for a stable response (no DOM changes for 'stableMs' milliseconds).
 *  Uses exponential backoff: starts at POLL_INTERVAL_INITIAL_MS and grows up to
 *  POLL_INTERVAL_MAX_MS while the AI is silent. Resets to fast when text changes.
 *
 *  Extra safeguards:
 *  - baselineText: text that was already on the page BEFORE the user sent the
 *    question. Any text equal to the baseline is ignored — we only accept a
 *    genuinely NEW response so that stale previous-conversation text can never
 *    be mistaken for the current answer.
 *  - If aiName is provided, check STREAMING_INDICATOR_SELECTORS so we never
 *    declare the response complete while the AI is still generating.
 *  - Text is validated through isQualityResponse() to filter out UI boilerplate
 *    (e.g. "ChatGPT can make mistakes") that appears before the real answer. */
async function waitForStableResponse(
  view: BrowserView,
  selectors: string[],
  timeoutMs = WORKFLOW_TIMEOUT_MS,
  stableMs = STABLE_RESPONSE_MS,
  aiName?: AiName,
  baselineText = ''
): Promise<string> {
  return new Promise((resolve, reject) => {
    let cancelled = false
    let lastText = ''
    let stableStart = 0
    let interval = POLL_INTERVAL_INITIAL_MS
    let streamingStableStart = 0
    let pollCount = 0
    // Best quality text seen so far — used by the force-resolve safety net.
    let bestTextSeen = ''

    const globalTimeout = setTimeout(() => {
      cancelled = true
      reject(new Error('Response timeout'))
    }, timeoutMs)

    // ── Safety-net timer ─────────────────────────────────────────────────────
    // Fires at 85% of the global timeout. If we have seen at least one quality
    // response by then, accept it — prevents infinite waits from streaming-guard
    // false positives. Using 85% (not a fixed 45s) so long document reviews
    // (which can take 90+ seconds) are not cut off prematurely.
    const forceResolveDelay = Math.floor(timeoutMs * 0.85)
    const forceResolveTimer = setTimeout(async () => {
      if (!cancelled) {
        cancelled = true
        clearTimeout(globalTimeout)
        sendLog('warn', `[wait] ${aiName ?? 'ai'}: safety-net (${forceResolveDelay}ms) — resolving with best text seen (${bestTextSeen.length} chars)`)
        resolve(bestTextSeen)
      }
    }, forceResolveDelay)

    const doPoll = async () => {
      if (cancelled) return
      pollCount++

      try {
        let text = ''
        for (const sel of selectors) {
          try {
            text = await view.webContents.executeJavaScript(`
              (() => {
                const els = document.querySelectorAll(\`${sel}\`);
                if (!els.length) return '';
                return els[els.length - 1]?.innerText?.trim() || '';
              })()
            `)
            if (text && text.length > 10) break
          } catch {
            // try next selector
          }
        }

        // Smart fallback: if no selector matched, scan the page for the
        // largest coherent text block in the main content area.
        if (!text || text.length <= 10) {
          try {
            text = await view.webContents.executeJavaScript(`
              (() => {
                const root = document.querySelector('main, [role="main"], #main, .main')
                  || document.body;
                let best = { len: 0, text: '' };
                const walk = (el) => {
                  if (!el) return;
                  // Skip nav, header, footer, buttons, inputs
                  const tag = el.tagName?.toLowerCase() || '';
                  if (['nav','header','footer','button','input','textarea','script','style'].includes(tag)) return;
                  const direct = Array.from(el.childNodes)
                    .filter(n => n.nodeType === 3)
                    .map(n => n.textContent || '')
                    .join('').trim();
                  const full = (el.innerText || '').trim();
                  // Target: nodes with lots of text. Allow up to 150 children
                  // so that AI responses with many paragraphs/list items are
                  // not incorrectly skipped.
                  if (full.length > 80 && full.length < 50000 && el.children.length <= 150) {
                    if (full.length > best.len) { best = { len: full.length, text: full }; }
                  }
                  Array.from(el.children).forEach(walk);
                };
                walk(root);
                return best.text;
              })()
            `)
          } catch {
            // smart fallback also failed — keep waiting
          }
        }

        // ── Sanitize: strip citation badges ────────────────────────────────
        const cleanText = sanitizeResponseText(text)

        // ── Baseline gate: skip text identical to (or contained within) pre-send state ──
        // The baseline may be the full page body (for primary AI, to block landing-page
        // content) or just the response area (for reviewers / final revision).
        const sanitizedBaseline = baselineText ? sanitizeResponseText(baselineText) : ''
        const isNewText = !baselineText || (
          cleanText !== sanitizedBaseline &&
          !sanitizedBaseline.includes(cleanText)
        )

        // ── Periodic diagnostic log (every 10 polls) ───────────────────────
        if (pollCount % 10 === 1) {
          sendLog('info',
            `[wait:${aiName ?? 'ai'}] poll#${pollCount} ` +
            `raw=${text.length}c clean=${cleanText.length}c ` +
            `isNew=${isNewText} quality=${isQualityResponse(cleanText)} ` +
            `stable=${stableStart > 0 ? Date.now() - stableStart : 0}ms`
          )
        }

        // ── Quality gate ───────────────────────────────────────────────────
        if (cleanText && isNewText && isQualityResponse(cleanText)) {
          // Track best text for safety-net resolver
          if (cleanText.length > bestTextSeen.length) bestTextSeen = cleanText

          // ── Streaming guard ─────────────────────────────────────────────
          if (aiName) {
            const streamingSelectors = STREAMING_INDICATOR_SELECTORS[aiName] ?? []
            if (streamingSelectors.length > 0) {
              const stillStreaming = await checkIsStreaming(view, streamingSelectors)
              if (stillStreaming) {
                const textChanged = cleanText !== lastText
                if (textChanged) {
                  streamingStableStart = 0
                } else {
                  if (streamingStableStart === 0) streamingStableStart = Date.now()
                  const streamingStableFor = Date.now() - streamingStableStart
                  if (streamingStableFor >= STREAMING_GUARD_OVERRIDE_MS) {
                    sendLog('warn', `[stream] ${aiName}: false-positive guard — accepting after ${streamingStableFor}ms (${cleanText.length} chars)`)
                    cancelled = true
                    clearTimeout(globalTimeout)
                    clearTimeout(forceResolveTimer)
                    resolve(cleanText)
                    return
                  }
                  sendLog('info', `[stream] ${aiName} generating (${streamingStableFor}ms / ${STREAMING_GUARD_OVERRIDE_MS}ms override)`)
                }
                lastText = cleanText
                stableStart = 0
                interval = POLL_INTERVAL_INITIAL_MS
                if (!cancelled) setTimeout(doPoll, interval)
                return
              }
            }
          }
          streamingStableStart = 0

          if (cleanText === lastText) {
            if (stableStart === 0) stableStart = Date.now()
            const stableFor = Date.now() - stableStart
            if (stableFor >= stableMs) {
              sendLog('info', `[wait:${aiName ?? 'ai'}] stable for ${stableFor}ms — resolving (${cleanText.length} chars)`)
              cancelled = true
              clearTimeout(globalTimeout)
              clearTimeout(forceResolveTimer)
              resolve(cleanText)
              return
            }
            interval = POLL_INTERVAL_INITIAL_MS
          } else {
            sendLog('info', `[wait:${aiName ?? 'ai'}] text changed (${lastText.length}→${cleanText.length}c) — reset stability`)
            lastText = cleanText
            stableStart = 0
            interval = POLL_INTERVAL_INITIAL_MS
          }
        } else {
          if (pollCount % 10 === 1) {
            sendLog('info', `[wait:${aiName ?? 'ai'}] no quality text yet — slowing poll`)
          }
          interval = Math.min(Math.floor(interval * 1.5), POLL_INTERVAL_MAX_MS)
        }
      } catch {
        // view might be navigating; keep polling
      }

      if (!cancelled) setTimeout(doPoll, interval)
    }

    setTimeout(doPoll, interval)
  })
}

/** Click the send button using fallback selectors */
async function clickSend(view: BrowserView, selectors: string[]): Promise<boolean> {
  const res = await execWithFallback(view, selectors, (sel) => `
    (() => {
      const btn = document.querySelector(\`${sel}\`);
      if (!btn) return false;
      btn.focus();
      btn.click();
      return true;
    })()
  `)
  if (res.success) return true

  // Fallback: find the submit button relative to the active textarea,
  // then use sendInputEvent for a native Enter as last resort.
  try {
    await view.webContents.executeJavaScript(`
      (() => {
        const inputEl = document.activeElement?.tagName === 'TEXTAREA'
          ? document.activeElement
          : document.querySelector('textarea');
        if (inputEl) {
          // Walk up to find the nearest form or wrapper, then click its submit button
          let container = inputEl.closest('form') || inputEl.parentElement;
          for (let i = 0; i < 5 && container; i++) {
            const btn = container.querySelector('button[type="submit"], button[aria-label="Submit"], button[aria-label="Send"]');
            if (btn && !btn.disabled) { btn.click(); return 'btn'; }
            const btns = container.querySelectorAll('button');
            const last = btns[btns.length - 1];
            if (last && !last.disabled) { last.click(); return 'last-btn'; }
            container = container.parentElement;
          }
          inputEl.focus();
          inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true, cancelable: true }));
        }
        return 'enter';
      })()
    `)
    view.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' })
    view.webContents.sendInputEvent({ type: 'char', keyCode: 'Return' })
    view.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Return' })
  } catch { /* ignore */ }
  return false
}

// ─── BrowserView Layout ───────────────────────────────────────────────────────
function computeViewBounds(index: number, winWidth: number, winHeight: number): Rectangle {
  const attachH = attachmentBarVisible ? ATTACHMENT_BAR_HEIGHT : 0
  const finalH = finalPanelExpanded ? FINAL_PANEL_FULL_H : FINAL_PANEL_HEADER_H
  const gridTop = TITLEBAR_HEIGHT + TOOLBAR_HEIGHT + attachH + STATUS_BAR_HEIGHT + PANEL_HEADER_HEIGHT
  const gridHeight = winHeight - gridTop - finalH
  const panelWidth = Math.floor(winWidth / AI_NAMES.length)
  return {
    x: index * panelWidth,
    y: gridTop,
    width: panelWidth,
    height: Math.max(gridHeight, 200),
  }
}

function updateViewBounds() {
  if (!mainWindow) return
  const [winWidth, winHeight] = mainWindow.getSize()
  AI_NAMES.forEach((name, i) => {
    const view = views.get(name)
    if (view) {
      try {
        view.setBounds(computeViewBounds(i, winWidth, winHeight))
      } catch {
        // view might be detached
      }
    }
  })
}

/** Debounced resize handler — prevents excessive layout recalculation during drag */
function debouncedUpdateViewBounds() {
  if (resizeDebounceTimer !== null) clearTimeout(resizeDebounceTimer)
  resizeDebounceTimer = setTimeout(() => {
    resizeDebounceTimer = null
    updateViewBounds()
  }, RESIZE_DEBOUNCE_MS)
}

// ─── Window Creation ──────────────────────────────────────────────────────────
async function createWindow() {
  const bounds = store.get('windowBounds') as Rectangle

  mainWindow = new BrowserWindow({
    // Always start at 1920×1080 — restore only the saved position (x/y)
    x: bounds?.x,
    y: bounds?.y,
    width: 1920,
    height: 1080,
    minWidth: 854,
    minHeight: 480,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0a0f',
    show: false,   // hidden until ready-to-show fires — prevents invisible window bug
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  })

  // Show window only when content is fully rendered
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })

  // Load app
  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Fallback: if ready-to-show didn't fire (e.g. CSP blocked script),
  // force show after load completes so the window is never permanently hidden
  if (!mainWindow.isVisible()) {
    mainWindow.show()
    mainWindow.focus()
  }

  // Save window bounds on close
  mainWindow.on('close', () => {
    const b = mainWindow!.getBounds()
    store.set('windowBounds', b)
  })

  mainWindow.on('resize', debouncedUpdateViewBounds)
  mainWindow.on('closed', () => { mainWindow = null })

  // Create BrowserViews for each AI
  for (let i = 0; i < AI_NAMES.length; i++) {
    const name = AI_NAMES[i]
    const config = getSelectors(name)

    // ── Configure session BEFORE creating BrowserView so UA is set from the start ──
    const ses = session.fromPartition(`persist:${name}`)
    ses.setUserAgent(DESKTOP_USER_AGENT)

    const view = new BrowserView({
      webPreferences: {
        preload: CHROME_SPOOF_PRELOAD, // Chrome API 주입 (Google 감지 우회)
        contextIsolation: false,               // MAIN world 접근을 위해 반드시 false
        nodeIntegration: false,
        partition: `persist:${name}`,           // separate sessions for login persistence
      },
    })

    // ── Spoof UA: Chrome desktop, not Electron (belt-and-suspenders) ──────────
    view.webContents.setUserAgent(DESKTOP_USER_AGENT)

    // ── Strip/replace sec-ch-ua client hints that expose Electron identity ────
    // Gemini checks these headers server-side even when UA looks like Chrome.
    // IMPORTANT: we must case-insensitively remove the originals — Object.assign
    // only matches exact keys, so if Electron sends 'Sec-Ch-Ua' (capitalized)
    // alongside our lowercase 'sec-ch-ua', Gemini receives BOTH and detects us.
    view.webContents.session.webRequest.onBeforeSendHeaders(
      { urls: ['*://*/*'] },
      (details, callback) => {
        const headers: Record<string, string> = {}
        // Keys to replace — skip originals, we set our own values below
        const SKIP_KEYS = new Set([
          'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform',
          'sec-ch-ua-full-version-list',
          'user-agent', 'x-client-data',
        ])
        for (const [key, value] of Object.entries(details.requestHeaders)) {
          if (!SKIP_KEYS.has(key.toLowerCase())) {
            headers[key] = value as string
          }
        }
        // Inject Chrome-matching headers
        Object.assign(headers, CHROME_CLIENT_HINTS)
        headers['user-agent'] = DESKTOP_USER_AGENT
        callback({ requestHeaders: headers })
      }
    )

    mainWindow.addBrowserView(view)
    const bounds = computeViewBounds(i, mainWindow.getSize()[0], mainWindow.getSize()[1])
    view.setBounds(bounds)
    view.setAutoResize({ width: false, height: false, horizontal: false, vertical: false })

    views.set(name, view)

    if (name === 'gemini') {
      // ── Gemini: 로그인 상태 확인 후 적절한 URL로 이동 ──────────────────────
      // 첫 설치 시 Google 세션 쿠키가 없으면 gemini.google.com이 502를 반환함.
      // 쿠키 존재 여부를 먼저 확인해 없으면 로그인 페이지를 먼저 보여준다.
      const existingCookies = await ses.cookies.get({ domain: '.google.com' })
      const alreadyLoggedIn = existingCookies.some(
        (c) => c.name === 'SID' || c.name === '__Secure-1PSID'
      )

      view.webContents.on('did-finish-load', async () => {
        // 502 페이지 감지: 쿠키가 있는데도 502가 뜨면 로그인으로 리다이렉트
        try {
          const is502 = await view.webContents.executeJavaScript(
            `document.title.includes('502') || ` +
            `(document.body ? document.body.innerText.includes('502') : false)`
          ).catch(() => false)
          if (is502) {
            sendLog('warn', 'Gemini 502 detected — redirecting to Google login page')
            mainWindow?.webContents.send(
              'status-update',
              '⚠️ Gemini connection error (502) — Google login required. Please log in from the Gemini panel.'
            )
            view.webContents.loadURL('https://accounts.google.com/signin', {
              userAgent: DESKTOP_USER_AGENT,
            }).catch(() => {})
            return
          }
        } catch { /* ignore */ }
        mainWindow?.webContents.send('view-loaded', { ai: name })
      })

      // 로그인 완료 감지: accounts.google.com을 벗어났고 SID 쿠키가 생기면 Gemini로 이동
      view.webContents.on('did-navigate', async (_e, navUrl) => {
        if (navUrl.includes('accounts.google.com')) return   // 아직 로그인 중
        if (navUrl.startsWith('https://gemini.google.com')) return  // 이미 Gemini

        const latestCookies = await ses.cookies.get({ domain: '.google.com' })
        const nowLoggedIn = latestCookies.some(
          (c) => c.name === 'SID' || c.name === '__Secure-1PSID'
        )
        if (nowLoggedIn) {
          await ses.cookies.flushStore()
          sendLog('info', '✅ Google login complete — loading Gemini')
          mainWindow?.webContents.send(
            'status-update',
            '✅ Google login complete! Loading Gemini...'
          )
          view.webContents.loadURL('https://gemini.google.com', {
            userAgent: DESKTOP_USER_AGENT,
          }).catch(() => {})
        }
      })

      if (!alreadyLoggedIn) {
        sendLog('info', 'Gemini: No Google session — showing login page')
        mainWindow?.webContents.send(
          'status-update',
          '🔑 Google login required — please sign in with your Google account from the Gemini panel.'
        )
        view.webContents.loadURL('https://accounts.google.com/signin', {
          userAgent: DESKTOP_USER_AGENT,
        }).catch((err) => sendLog('error', `Gemini login page load failed: ${err.message}`))
      } else {
        view.webContents.loadURL('https://gemini.google.com', {
          userAgent: DESKTOP_USER_AGENT,
        }).catch((err) => sendLog('error', `Gemini load failed: ${err.message}`))
      }
    } else {
      view.webContents.on('did-finish-load', () => {
        mainWindow?.webContents.send('view-loaded', { ai: name })
      })

      view.webContents.loadURL(config.url, {
        userAgent: DESKTOP_USER_AGENT,
      }).catch((err) => {
        sendLog('error', `Failed to load ${name}: ${err.message}`)
      })
    }

    view.webContents.on('did-fail-load', (_e, errCode, errDesc) => {
      sendLog('error', `${name} failed to load: [${errCode}] ${errDesc}`)
      mainWindow?.webContents.send('view-load-error', { ai: name, errCode, errDesc })
    })
  }
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

// ── File dialog ──────────────────────────────────────────────────────────────
ipcMain.handle('open-file-dialog', async () => {
  if (!mainWindow) return []
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Attach File',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Supported Files', extensions: ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'txt', 'md', 'csv'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })
  if (result.canceled || result.filePaths.length === 0) return []
  return result.filePaths.map((filePath) => {
    const name = path.basename(filePath)
    const ext = path.extname(filePath).replace('.', '').toLowerCase()
    return { name, path: filePath, ext }
  })
})

// ── Save file dialog ──────────────────────────────────────────────────────────
ipcMain.handle(
  'save-file',
  async (_e, { content, defaultName, ext }: { content: string; defaultName: string; ext: string }) => {
    if (!mainWindow) return { saved: false }

    const extFilters: Record<string, Electron.FileFilter[]> = {
      docx: [{ name: 'Word Document', extensions: ['docx'] }],
      xlsx: [{ name: 'Excel Document', extensions: ['xlsx'] }],
      txt: [{ name: 'Text File', extensions: ['txt'] }],
      md: [{ name: 'Markdown', extensions: ['md'] }],
      csv: [{ name: 'CSV', extensions: ['csv'] }],
    }

    const filters = extFilters[ext] ?? [{ name: 'Text File', extensions: ['txt'] }]
    filters.push({ name: 'All Files', extensions: ['*'] })

    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Revised File',
      defaultPath: defaultName,
      filters,
    })

    if (result.canceled || !result.filePath) return { saved: false }

    try {
      const saveExt = path.extname(result.filePath).replace('.', '').toLowerCase() || ext
      await buildDownloadFile(content, saveExt, result.filePath)
      return { saved: true, filePath: result.filePath }
    } catch (err) {
      sendLog('error', `File save error: ${err instanceof Error ? err.message : String(err)}`)
      return { saved: false }
    }
  }
)

// ── Attachment bar visibility → update BrowserView layout ────────────────────
ipcMain.handle('set-attachment-bar-visible', (_e, visible: boolean) => {
  attachmentBarVisible = visible
  updateViewBounds()
})

// ── Final panel expand/collapse → update BrowserView layout ──────────────────
ipcMain.handle('set-final-panel-expanded', (_e, expanded: boolean) => {
  finalPanelExpanded = expanded
  updateViewBounds()
})

ipcMain.handle('get-ai-list', () => AI_NAMES)

ipcMain.handle('get-history', () => store.get('chatHistory'))

ipcMain.handle('clear-history', () => {
  store.set('chatHistory', [])
  return true
})

/** Open DevTools for a specific BrowserView — useful for inspecting DOM/selectors */
ipcMain.handle('open-view-devtools', (_e, aiName: AiName) => {
  const view = views.get(aiName)
  if (!view) return false
  view.webContents.openDevTools({ mode: 'detach' })
  return true
})

ipcMain.handle('reload-ai', async (_e, aiName: AiName) => {
  const view = views.get(aiName)
  if (!view) return false
  if (!AI_NAMES.includes(aiName)) return false
  const config = getSelectors(aiName)
  if (!config?.url) {
    sendLog('error', `reload-ai: no valid config for ${aiName}`)
    return false
  }

  // Gemini 리로드 시 로그인 쿠키 재확인 — 없으면 로그인 페이지로
  if (aiName === 'gemini') {
    const reloadSes = session.fromPartition('persist:gemini')
    const cookies = await reloadSes.cookies.get({ domain: '.google.com' })
    const loggedIn = cookies.some((c) => c.name === 'SID' || c.name === '__Secure-1PSID')
    const targetUrl = loggedIn ? 'https://gemini.google.com' : 'https://accounts.google.com/signin'
    view.webContents.loadURL(targetUrl, { userAgent: DESKTOP_USER_AGENT }).catch((err: Error) => {
      sendLog('error', `reload-ai(gemini) failed: ${err.message}`)
    })
    return true
  }

  view.webContents.loadURL(config.url, { userAgent: DESKTOP_USER_AGENT }).catch((err: Error) => {
    sendLog('error', `reload-ai failed for ${aiName}: ${err.message}`)
  })
  return true
})

ipcMain.handle('window-minimize', () => mainWindow?.minimize())
ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.restore()
  else mainWindow?.maximize()
})
ipcMain.handle('window-close', () => mainWindow?.close())

/** Show/hide all BrowserViews (used when switching to a settings page etc.) */
ipcMain.handle('set-views-visible', (_e, visible: boolean) => {
  AI_NAMES.forEach((name) => {
    const view = views.get(name)
    if (!view) return
    if (visible) {
      try { mainWindow?.addBrowserView(view) } catch { /* already added */ }
    } else {
      try { mainWindow?.removeBrowserView(view) } catch { /* already removed */ }
    }
  })
})

/**
 * Main workflow IPC handler
 * Orchestrates the full 8-step cross-verification workflow
 */
ipcMain.handle(
  'start-workflow',
  async (_e, {
    primaryAi,
    query,
    attachedFiles,
  }: {
    primaryAi: AiName
    query: string
    attachedFiles?: Array<{ name: string; path: string; ext: string }>
  }) => {
    // ── Input validation ──────────────────────────────────────────────────────
    if (!query || typeof query !== 'string' || !query.trim()) {
      return { success: false, error: 'Query is empty.' }
    }
    if (query.length > QUERY_MAX_LENGTH) {
      return { success: false, error: `Query is too long. (Max ${QUERY_MAX_LENGTH} chars)` }
    }
    if (!AI_NAMES.includes(primaryAi)) {
      return { success: false, error: `Invalid AI selection: ${primaryAi}` }
    }

    const reviewers = AI_NAMES.filter((n) => n !== primaryAi)
    const primaryConfig = getSelectors(primaryAi)
    const hasFiles = Array.isArray(attachedFiles) && attachedFiles.length > 0

    try {
      // ── STEP 2.5: Extract attached file content ───────────────────────────
      let fileContext = ''
      if (hasFiles) {
        sendStatus('Extracting attached file contents...')
        sendLog('info', `[Step 2.5] Extracting ${attachedFiles!.length} file(s)`)
        fileContext = await buildFileContext(attachedFiles!)
        sendLog('info', `[Step 2.5] File context ready (${fileContext.length} chars)`)
      }

      // ── STEP 3: Navigate primary AI to new chat, then inject query ────────
      const primaryView = views.get(primaryAi)!
      sendStatus(`Preparing new conversation in ${primaryAi}...`)
      sendLog('info', `[Step 3] Navigating ${primaryAi} to new chat`)
      await navigateToNewChat(primaryView, primaryAi)

      sendStatus(MSG.injecting(primaryAi))
      sendLog('info', `[Step 3] Injecting query into ${primaryAi}`)

      const primaryBaseline = await capturePageBaseline(primaryView)
      sendLog('info', `[Step 3] Pre-injection page baseline captured (${primaryBaseline.length} chars)`)

      const inputResult = await execWithFallback(
        primaryView,
        primaryConfig.inputSelectors,
        (sel) => `!!document.querySelector(\`${sel}\`)`
      )

      if (!inputResult.success) {
        throw new Error(`Could not find input box in ${primaryAi}. Please check login status.`)
      }

      const primaryPrompt = buildPrimaryPrompt(query, fileContext)
      await pasteText(primaryView, primaryPrompt, inputResult.selector!)

      // small pause before send
      await sleep(CLICK_SEND_DELAY_MS)
      sendStatus(MSG.sending(primaryAi))
      await clickSend(primaryView, primaryConfig.sendButtonSelectors)

      // ── STEP 4: Wait for Primary AI response ─────────────────────────────
      sendStatus(MSG.waitingPrimary(primaryAi))
      sendLog('info', `[Step 4] Waiting ${INITIAL_RESPONSE_WAIT_MS}ms then polling`)
      await sleep(INITIAL_RESPONSE_WAIT_MS)

      const draftAnswer = await waitForStableResponse(
        primaryView,
        primaryConfig.responseContainerSelectors,
        WORKFLOW_TIMEOUT_MS,
        STABLE_RESPONSE_MS,
        primaryAi,
        primaryBaseline
      )

      sendLog('info', `[Step 4] Got draft (${draftAnswer.length} chars)`)

      if (!draftAnswer || draftAnswer.trim().length === 0) {
        throw new Error(`No response received from ${primaryAi}. Check login status or response timeout.`)
      }

      mainWindow?.webContents.send('draft-ready', { ai: primaryAi, draft: draftAnswer })

      // ── STEP 5: Inject reviewer prompt into all reviewers simultaneously ──
      sendStatus(MSG.sendingReviews())
      sendLog('info', '[Step 5] Injecting review requests')

      const filePaths = hasFiles ? attachedFiles!.map((f) => f.path) : []

      const reviewPromises = reviewers.map(async (reviewerName) => {
        const reviewerView = views.get(reviewerName)!
        const reviewerConfig = getSelectors(reviewerName)

        sendLog('info', `[Step 5] Navigating ${reviewerName} to new chat`)
        await navigateToNewChat(reviewerView, reviewerName)

        const inputRes = await execWithFallback(
          reviewerView,
          reviewerConfig.inputSelectors,
          (sel) => `!!document.querySelector(\`${sel}\`)`
        )

        if (!inputRes.success) {
          sendLog('error', `[Step 5] ${reviewerName}: Input box not found — skipping feedback`)
          return { ai: reviewerName as AiName, feedback: '' }
        }

        // ── Try to physically attach original files via CDP ────────────────
        let filesAttached = false
        if (hasFiles && filePaths.length > 0) {
          sendLog('info', `[Step 5] ${reviewerName}: Attempting CDP file attach (${filePaths.length} file(s))`)
          filesAttached = await attachFilesViaCDP(reviewerView, reviewerName, filePaths)
          if (filesAttached) {
            sendLog('info', `[Step 5] ${reviewerName}: File attach succeeded — omitting file content from prompt`)
          } else {
            sendLog('warn', `[Step 5] ${reviewerName}: File attach failed — falling back to text method`)
            // Close any dialogs that may have been left open, then restore focus
            reviewerView.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' })
            reviewerView.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' })
            await sleep(400)
          }
        }

        // Build prompt: omit embedded file content when files were physically attached
        const prompt = buildReviewerPrompt(
          primaryAi, query, draftAnswer,
          filesAttached ? '' : fileContext   // skip text embed if CDP succeeded
        )

        sendLog('info', `[Step 5] ${reviewerName}: Starting prompt paste`)
        await pasteText(reviewerView, prompt, inputRes.selector!)

        // ── Capture baseline BEFORE clicking Send ─────────────────────────
        // This prevents old conversation text from being mistaken for the
        // new response. Same pattern used for the primary AI in Step 4.
        const reviewerBaseline = await captureCurrentText(
          reviewerView,
          reviewerConfig.responseContainerSelectors
        )
        sendLog('info', `[Step 5] ${reviewerName}: Pre-send baseline captured (${reviewerBaseline.length} chars)`)

        await sleep(REVIEWER_SEND_DELAY_MS)

        const sent = await clickSend(reviewerView, reviewerConfig.sendButtonSelectors)
        sendLog('info', `[Step 5] ${reviewerName}: Send ${sent ? 'succeeded' : 'failed'}`)

        if (!sent) {
          sendLog('warn', `[Step 5] ${reviewerName}: Send button not found — falling back to Enter key`)
        }

        sendStatus(MSG.waitingReviewer(reviewerName))
        await sleep(INITIAL_RESPONSE_WAIT_MS)
        const feedback = await waitForStableResponse(
          reviewerView,
          reviewerConfig.responseContainerSelectors,
          WORKFLOW_TIMEOUT_MS,
          STABLE_RESPONSE_MS,
          reviewerName,
          reviewerBaseline    // ← old-response bleed-through 방지
        ).catch((err) => {
          sendLog('warn', `${reviewerName} timeout: ${err.message}`)
          return ''
        })

        mainWindow?.webContents.send('feedback-ready', { ai: reviewerName, feedback })
        return { ai: reviewerName as AiName, feedback }
      })

      // ── STEP 6: Collect all reviewer feedbacks ────────────────────────────
      sendStatus(MSG.collectingFeedbacks())
      sendLog('info', '[Step 6] Collecting reviewer feedbacks')
      const feedbackResults = await Promise.all(reviewPromises)

      // ── STEP 7: Inject final revision prompt into Primary AI ──────────────
      sendStatus(MSG.sendingRevision(primaryAi))
      sendLog('info', '[Step 7] Sending final revision prompt')

      const attachedFileNames = hasFiles ? attachedFiles!.map((f) => f.name) : []
      const finalPrompt = buildFinalRevisionPrompt(feedbackResults, hasFiles, attachedFileNames)

      const finalInputRes = await execWithFallback(
        primaryView,
        primaryConfig.inputSelectors,
        (sel) => `!!document.querySelector(\`${sel}\`)`
      )

      if (!finalInputRes.success) {
        throw new Error('Could not find Primary AI input box for final revision request.')
      }

      const finalBaseline = await captureCurrentText(
        primaryView,
        primaryConfig.responseContainerSelectors
      )
      sendLog('info', `[Step 7] Final baseline captured (${finalBaseline.length} chars)`)

      await pasteText(primaryView, finalPrompt, finalInputRes.selector!)
      await sleep(CLICK_SEND_DELAY_MS)
      await clickSend(primaryView, primaryConfig.sendButtonSelectors)

      // ── STEP 8: Extract final revised answer ──────────────────────────────
      sendStatus(MSG.waitingFinal(primaryAi))
      sendLog('info', `[Step 8] Waiting ${INITIAL_RESPONSE_WAIT_MS}ms before polling...`)
      await sleep(INITIAL_RESPONSE_WAIT_MS)
      sendLog('info', '[Step 8] Polling final revised answer (ignoring baseline)')

      const finalAnswer = await waitForStableResponse(
        primaryView,
        primaryConfig.responseContainerSelectors,
        WORKFLOW_TIMEOUT_MS,
        STABLE_RESPONSE_MS,
        primaryAi,
        finalBaseline
      )

      // Save to history
      const historyEntry = {
        id: `${Date.now()}`,
        query,
        primaryAi,
        result: finalAnswer,
        timestamp: Date.now(),
      }
      const history = store.get('chatHistory') as StoreSchema['chatHistory']
      store.set('chatHistory', [historyEntry, ...history].slice(0, HISTORY_MAX_ITEMS))

      // ── Parse per-file modified content from final answer ────────────────
      const fileContents = hasFiles
        ? parseFileContents(finalAnswer, attachedFiles!.map((f) => ({ name: f.name, ext: f.ext })))
        : []

      sendStatus(MSG.done())
      sendLog('info', `[Step 8] Final answer ready (${finalAnswer.length} chars)${fileContents.length > 0 ? `, ${fileContents.length} file(s) parsed` : ''}`)

      return { success: true, finalAnswer, feedbacks: feedbackResults, fileContents }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      sendStatus(MSG.error(msg))
      sendLog('error', msg)
      return { success: false, error: msg }
    }
  }
)

// ─── Prompt Builders ──────────────────────────────────────────────────────────
function buildPrimaryPrompt(query: string, fileContext: string): string {
  if (!fileContext) return query
  return `${query}${fileContext}`
}

function buildReviewerPrompt(
  _primaryAi: AiName,
  query: string,
  draft: string,
  fileContext: string
): string {
  const fileSection = fileContext ? `\n${fileContext}\n` : ''

  return `Here is an analysis result for the following question${fileContext ? ' and attached file(s)' : ''}.

**Important rules:**
- Do not mention the source AI name in your feedback
- Do not include web search citations, source links, or reference numbers ([1][2], etc.)
- Write only the feedback — do not attribute anything to any source

[Original Question]
${query}
${fileSection}
[Analysis Result]
${draft}

Please review the above analysis based on the following criteria:
1. Accuracy (are there any factual errors?)
2. Completeness (is any important content missing?)
3. Clarity (are there any parts that are hard to understand?)
4. Suggestions for improvement`
}

function buildFinalRevisionPrompt(
  feedbacks: Array<{ ai: AiName; feedback: string }>,
  hasFiles: boolean,
  attachedFileNames: string[] = []
): string {
  const lines = feedbacks
    .filter((f) => f.feedback && f.feedback.trim().length > 0)
    .map((f, i) => `[Feedback ${i + 1}]:\n${f.feedback}`)

  const feedbackBlock = lines.length > 0
    ? lines.join('\n\n')
    : '(No feedback collected — please review your previous analysis on your own and improve it.)'

  if (!hasFiles || attachedFileNames.length === 0) {
    return `Your previous answer has received feedback from multiple AIs. Do not mention the source.

${feedbackBlock}

[FINAL TASK]
Incorporate the above feedback comprehensively. If you disagree with any part, explain why, and write the most complete and accurate final answer possible.`
  }

  // Build per-file output instructions with unambiguous delimiters
  const fileBlocks = attachedFileNames
    .map((name) => `<<<FILE:${name}>>>\n(Write the complete revised content of this file here)\n<<<END_FILE>>>`)
    .join('\n\n')

  return `Your previous file analysis has received feedback from multiple AIs. Do not mention the source.

${feedbackBlock}

[FINAL TASK]
Incorporate the above feedback comprehensively. If you disagree with any part, briefly explain why.
Then output the complete revised content of each file in the following format, without omission.
(Follow the delimiters around file content exactly)

${fileBlocks}`
}

/**
 * Parse per-file content blocks from the final AI answer.
 * Format expected:  <<<FILE:filename.ext>>> ... <<<END_FILE>>>
 * Falls back to full answer for each file if no delimiters are found.
 */
function parseFileContents(
  finalAnswer: string,
  files: Array<{ name: string; ext: string }>
): Array<{ name: string; ext: string; content: string }> {
  const results: Array<{ name: string; ext: string; content: string }> = []

  for (const file of files) {
    const startTag = `<<<FILE:${file.name}>>>`
    const endTag = `<<<END_FILE>>>`
    const startIdx = finalAnswer.indexOf(startTag)

    if (startIdx !== -1) {
      const contentStart = startIdx + startTag.length
      const endIdx = finalAnswer.indexOf(endTag, contentStart)
      const content = endIdx !== -1
        ? finalAnswer.slice(contentStart, endIdx).trim()
        : finalAnswer.slice(contentStart).trim()
      results.push({ name: file.name, ext: file.ext, content })
    }
  }

  // Fallback: if no delimiters found, use full answer for every file
  if (results.length === 0) {
    for (const file of files) {
      results.push({ name: file.name, ext: file.ext, content: finalAnswer })
    }
  }

  return results
}

function primaryAiDisplayName(ai: AiName): string {
  const map: Record<AiName, string> = {
    gemini: 'Gemini',
    claude: 'Claude',
    chatgpt: 'ChatGPT',
    perplexity: 'Perplexity',
  }
  return map[ai]
}

// ─── CDP File Attachment ──────────────────────────────────────────────────────
// Upload button selectors: clicking these reveals the hidden <input type="file">
// in each AI's UI before we set files programmatically via CDP.
const FILE_UPLOAD_BUTTON_SELECTORS: Partial<Record<AiName, string[]>> = {
  claude: [
    'button[aria-label="Attach files"]',
    'button[aria-label*="ttach"]',
    'button[aria-label*="ile"]',
    // The "+" add-content button in the composer
    'button[data-testid="composer-add-content"]',
    'button.composer-add-content',
  ],
  chatgpt: [
    'button[aria-label="Attach files"]',
    'button[aria-label="Upload files"]',
    'button[aria-label*="ttach"]',
    'button[data-testid="send-button"]',  // fallback
  ],
  gemini: [
    'button[aria-label="Upload and use files"]',
    'button[aria-label*="pload"]',
    'button[jsaction*="upload"]',
  ],
  perplexity: [],   // no reliable file upload in free tier
}

/**
 * Attach files to an AI BrowserView using Chrome DevTools Protocol.
 *
 * Steps:
 *   1. Optionally click the upload-trigger button to reveal the hidden <input type="file">
 *   2. Find the file input via CDP DOM.querySelectorAll
 *   3. Set file paths with DOM.setFileInputFiles (fires the 'change' event automatically)
 *   4. Wait briefly for the AI's upload UI to register the files
 *
 * Returns true when files were set successfully, false on any failure
 * (caller should then fall back to embedding file content as text).
 */
async function attachFilesViaCDP(
  view: BrowserView,
  ai: AiName,
  filePaths: string[]
): Promise<boolean> {
  if (!filePaths || filePaths.length === 0) return true

  const dbg = view.webContents.debugger
  const wasAlreadyAttached = dbg.isAttached()

  try {
    if (!wasAlreadyAttached) dbg.attach('1.3')

    // Helper: find file input nodeIds from current DOM
    const findFileInputs = async (): Promise<number[]> => {
      const { root } = await dbg.sendCommand('DOM.getDocument', { depth: 3 }) as { root: { nodeId: number } }
      const { nodeIds } = await dbg.sendCommand('DOM.querySelectorAll', {
        nodeId: root.nodeId,
        selector: 'input[type="file"]',
      }) as { nodeIds: number[] }
      return nodeIds ?? []
    }

    const nodeIds = await findFileInputs()

    if (nodeIds.length === 0) {
      sendLog('warn', `[file-attach] ${ai}: No <input type="file"> found — falling back to text`)
      return false
    }

    // Set files on the first (most relevant) file input
    await dbg.sendCommand('DOM.setFileInputFiles', {
      nodeId: nodeIds[0],
      files: filePaths,
    })

    sendLog('info', `[file-attach] ${ai}: ${filePaths.length} file(s) attached via CDP`)

    // Wait for the AI's upload handler to process the files
    await sleep(2500)
    return true
  } catch (err) {
    sendLog('warn', `[file-attach] ${ai}: CDP error — ${err instanceof Error ? err.message : String(err)}`)
    return false
  } finally {
    if (!wasAlreadyAttached) {
      try { dbg.detach() } catch { /* ignore */ }
    }
  }
}

// ─── File Content Extraction ──────────────────────────────────────────────────
const FILE_CONTENT_MAX_CHARS = 80_000   // ~40-50 pages — prevents token overflow

async function extractFileContent(filePath: string, ext: string): Promise<string> {
  try {
    if (ext === 'pdf') {
      const pdfParse = require('pdf-parse')
      const buffer = fs.readFileSync(filePath)
      const data = await pdfParse(buffer)
      return data.text?.trim() ?? ''
    }

    if (ext === 'docx' || ext === 'doc') {
      const mammoth = require('mammoth')
      const result = await mammoth.extractRawText({ path: filePath })
      return result.value?.trim() ?? ''
    }

    if (ext === 'xlsx' || ext === 'xls') {
      const XLSX = require('xlsx')
      const workbook = XLSX.readFile(filePath)
      const lines: string[] = []
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName]
        const csv: string = XLSX.utils.sheet_to_csv(sheet, { FS: '\t' })
        lines.push(`[Sheet: ${sheetName}]\n${csv}`)
      }
      return lines.join('\n\n').trim()
    }

    if (['txt', 'md', 'csv', 'json', 'html', 'htm'].includes(ext)) {
      return fs.readFileSync(filePath, 'utf-8').trim()
    }

    return `[Unsupported file type: .${ext}]`
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return `[File read error: ${msg}]`
  }
}

async function buildFileContext(
  files: Array<{ name: string; path: string; ext: string }>
): Promise<string> {
  if (!files || files.length === 0) return ''

  const parts: string[] = []
  for (const file of files) {
    sendLog('info', `[file] Extracting: ${file.name} (.${file.ext})`)
    let content = await extractFileContent(file.path, file.ext)
    if (content.length > FILE_CONTENT_MAX_CHARS) {
      content = content.slice(0, FILE_CONTENT_MAX_CHARS) + '\n\n[... Content truncated due to length]'
      sendLog('warn', `[file] ${file.name}: Content truncated to ${FILE_CONTENT_MAX_CHARS} chars`)
    }
    parts.push(`--- File: ${file.name} ---\n${content}\n---`)
  }
  return '\n\n[Attached Files]\n' + parts.join('\n\n')
}

// ─── File Reconstruction (for download) ──────────────────────────────────────
async function buildDownloadFile(
  content: string,
  ext: string,
  outputPath: string
): Promise<void> {
  if (ext === 'docx') {
    const { Document, Packer, Paragraph, TextRun } = require('docx')
    const paragraphs = content.split('\n').map((line: string) =>
      new Paragraph({ children: [new TextRun(line)] })
    )
    const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] })
    const buffer = await Packer.toBuffer(doc)
    fs.writeFileSync(outputPath, buffer)
    return
  }

  if (ext === 'xlsx') {
    const XLSX = require('xlsx')
    const rows = content.split('\n').map((line: string) => [line])
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    XLSX.writeFile(wb, outputPath)
    return
  }

  // txt, md, csv, pdf (as text) → plain text
  fs.writeFileSync(outputPath, content, 'utf-8')
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

// ─── App Lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Clear HTTP cache + service workers for all AI sessions on every startup.
  // This removes any cached Electron fingerprints from prior runs.
  // Cookies are intentionally preserved so users stay logged in.
  for (const name of AI_NAMES) {
    const ses = session.fromPartition(`persist:${name}`)
    await ses.clearCache()
    await ses.clearStorageData({ storages: ['serviceworkers'] })
  }

  // Load selectors (userData override or built-in defaults)
  selectorsConfig = loadSelectorsConfig()

  await createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── OAuth / SSO domains allowed to open popups ───────────────────────────────
// These are needed for "Sign in with Google / Apple / GitHub" flows inside
// the AI BrowserViews. Without this list those popups are denied and login fails.
const OAUTH_ALLOWED_DOMAINS = [
  'accounts.google.com',     // Google OAuth (Claude, Perplexity, etc.)
  'oauth2.googleapis.com',
  'accounts.youtube.com',
  'auth0.com',               // Auth0 SSO
  'cdn.auth0.com',
  'twitter.com',             // X/Twitter own auth
  'api.twitter.com',
  'abs.twimg.com',
  'login.microsoftonline.com', // Microsoft SSO
  'appleid.apple.com',       // Apple Sign-In
  'github.com',              // GitHub OAuth
  'discord.com',             // Discord OAuth
]

// Allow loading AI websites and OAuth popups
app.on('web-contents-created', (_e, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, '')
      const isAiSite = AI_NAMES.some((n) => selectorsConfig[n].url.includes(hostname))
      const isOAuth = OAUTH_ALLOWED_DOMAINS.some((d) => hostname === d || hostname.endsWith('.' + d))

      if (isAiSite || isOAuth) {
        // Determine the correct session partition from the parent view.
        // Without this, OAuth popups run in the default session (no Chrome spoof,
        // wrong cookies) and Google/Anthropic detect Electron → login fails.
        let partition = 'persist:claude'   // safe fallback for OAuth flows
        for (const [aiName, view] of views.entries()) {
          if (view.webContents.id === contents.id) {
            partition = `persist:${aiName}`
            break
          }
        }

        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 520,
            height: 680,
            // Chrome 완전 위장: Google OAuth 팝업도 동일하게 처리해야
            // accounts.google.com 이 Electron 감지를 우회할 수 있음.
            webPreferences: {
              partition,
              preload: CHROME_SPOOF_PRELOAD,
              contextIsolation: false,   // MAIN world 주입에 필수
              nodeIntegration: false,
            },
          },
        }
      }
    } catch {
      return { action: 'deny' }
    }
    return { action: 'deny' }
  })

  // OAuth 팝업이 생성된 직후 UA를 명시적으로 설정
  // (partition의 setUserAgent가 이미 적용되지만 belt-and-suspenders 처리)
  contents.on('did-create-window', (popup) => {
    popup.setMenuBarVisibility(false)
    popup.webContents.setUserAgent(DESKTOP_USER_AGENT)
  })
})

// ─── Selector Config IPC ──────────────────────────────────────────────────────
ipcMain.handle('get-selectors', () => selectorsConfig)

ipcMain.handle('save-selectors', (_e, config: Record<AiName, AiConfig>) => {
  try {
    const savePath = path.join(app.getPath('userData'), 'selectors.json')
    fs.writeFileSync(savePath, JSON.stringify(config, null, 2), 'utf-8')
    selectorsConfig = config
    return { success: true, path: savePath }
  } catch (err) {
    return { success: false, error: String(err) }
  }
})
