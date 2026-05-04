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
import { spawn } from 'child_process'
import {
  COUNCIL_MENTION_ALIASES as _COUNCIL_MENTION_ALIASES,
  parseCouncilIntent as parseCouncilIntentPure,
  getSequentialCouncilTargets as getSequentialCouncilTargetsPure,
  summarizeCouncilMessages as summarizeCouncilMessagesPure,
  renderCouncilTranscript as renderCouncilTranscriptPure,
  buildCouncilPrompt as buildCouncilPromptPure,
  buildCouncilBroadcastPrompt as buildCouncilBroadcastPromptPure,
  extractPreviousRoundReplies as extractPreviousRoundRepliesPure,
  summarizeContextBeforePreviousRound as summarizeContextBeforePreviousRoundPure,
} from './councilPrompt.js'
import { buildResponseLanguageDirective, detectPreferredReplyLanguage } from '../src/responseLanguage.js'

const require = createRequire(import.meta.url)
// electron-store ships CJS
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Store = require('electron-store') as new <T extends object>(options: { defaults: T }) => {
  get<K extends keyof T>(key: K): T[K]
  set<K extends keyof T>(key: K, value: T[K]): void
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── Chromium flags (must be set before app.ready) ───────────────────────────
// Disable QUIC (HTTP/3): Gemini uses QUIC and its connection fingerprint
// can reveal Electron even when UA/headers are spoofed. Falling back to
// HTTP/2 over TLS removes that detection vector.
app.commandLine.appendSwitch('disable-quic')
// Ensure navigator.webdriver is not exposed (some Google services check this)
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled')

// ─── Types ───────────────────────────────────────────────────────────────────
export type AiName = 'chatgpt' | 'claude' | 'gemini' | 'grok' | 'deepseek' | 'perplexity' | 'kimi'
type InteractionMode = 'workflow' | 'chat'

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
  apiKeys: Partial<Record<AiName, string>> & { deepseek?: string }
  apiKeyOrder: string[]
  councilRoomSnapshot: CouncilRoomState | null
  councilUiState: {
    pinnedCandidateIds: string[]
    selectedCandidateId: string | null
  }
  councilSnapshots: Array<{
    id: string
    title: string
    savedAt: number
    messageCount: number
    isFavorite: boolean
    room: CouncilRoomState
    uiState: CouncilUiState
    insight: CouncilSnapshotInsight
  }>
  activeCouncilSnapshotId: string | null
  /**
   * Telegram bridge settings.  When `enabled` is true and both `botToken` and
   * `chatId` are set, the main process starts a long-poll loop on app startup
   * so the user can chat with Council from their phone.
   *
   * `lastUpdateId` is the id of the last Telegram update we processed — used
   * as the offset in `getUpdates` so old messages don't replay after restart.
   */
  telegram: {
    enabled: boolean
    botToken: string
    chatId: string   // stored as string (Telegram chat IDs can exceed JS safe int)
    /** Comma-separated additional whitelisted chat IDs.  Empty = only `chatId` is allowed. */
    allowedChatIds?: string
    lastUpdateId: number
  }
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
      // <div id="markdown-content-0"> (and subsequent -1, -2 for follow-ups).
      // Keep this list tight — broader fallbacks like `[class*="prose"]`
      // also match Perplexity's landing-page placeholder ("What do you want
      // to know? / Type @ for connectors..."), which we'd otherwise capture
      // and relay as the AI's "answer".
      '[id^="markdown-content"]',
      // Answer text wrapper that only renders once a response begins streaming
      'div[data-testid*="answer" i] .prose',
      'div[data-testid*="result" i] .prose',
      // Generic prose ONLY inside an answer/turn container — never bare on
      // the landing page.
      '[data-testid="thread"] .prose',
    ],
    loadedIndicatorSelectors: ['textarea', 'div[contenteditable]', '[contenteditable]'],
  },
  grok: {
    url: 'https://grok.com',
    newChatUrl: 'https://grok.com',
    inputSelectors: [
      // Main chat textarea (Grok 2025 UI)
      'textarea[placeholder*="Ask"]',
      'textarea[placeholder*="Grok"]',
      'textarea[placeholder*="Message"]',
      // Contenteditable variant
      'div[contenteditable="true"][aria-label]',
      'div[contenteditable="true"]',
      // Final fallback
      'textarea',
    ],
    sendButtonSelectors: [
      'button[aria-label="Send message"]',
      'button[aria-label="Send"]',
      'button[type="submit"]',
      'button[data-testid="send-button"]',
    ],
    responseContainerSelectors: [
      // Grok wraps responses in message-bubble containers
      '.message-bubble',
      '[data-testid="message-content"]',
      // Markdown / prose fallbacks
      '.prose',
      '.markdown',
    ],
    loadedIndicatorSelectors: ['textarea', 'div[contenteditable]'],
  },
  deepseek: {
    url: 'https://chat.deepseek.com',
    newChatUrl: 'https://chat.deepseek.com',
    inputSelectors: [
      '#chat-input',
      'textarea[placeholder*="Message" i]',
      'textarea[placeholder*="Ask" i]',
      'textarea[placeholder*="Send a message" i]',
      'textarea[placeholder*="DeepSeek" i]',
      'textarea[placeholder*="向 DeepSeek"]',
      'textarea[placeholder*="问"]',
      'textarea',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]',
    ],
    sendButtonSelectors: [
      // CAUTION: do NOT use `div.ds-button:has(svg)` here — DeepSeek's composer
      // footer has 3 such elements (DeepThink toggle, Search toggle, Send) and
      // querySelector picks the FIRST one (DeepThink), which silently toggles
      // DeepThink mode instead of sending.  The smart fallback in clickSend()
      // handles DeepSeek's send button via DOM heuristics.
      //
      // English aria-label variants (rare in DeepSeek but check first)
      'button[aria-label*="Send" i]',
      'button[aria-label*="Submit" i]',
      'div[role="button"][aria-label*="Send" i]',
      // Chinese aria-label variants (DeepSeek's UI is bilingual)
      'button[aria-label*="发送"]',
      'div[role="button"][aria-label*="发送"]',
      // Generic fallbacks
      'button[type="submit"]',
      'button[data-testid="send-button"]',
    ],
    responseContainerSelectors: [
      '.ds-markdown',
      '[class*="ds-markdown"]',
      '[class*="markdown"]',
      '.prose',
      '[class*="prose"]',
      'article',
    ],
    loadedIndicatorSelectors: ['#chat-input', 'textarea', '[contenteditable]'],
  },
  kimi: {
    url: 'https://kimi.com',
    newChatUrl: 'https://kimi.com',
    inputSelectors: [
      // Kimi's main composer (2025 UI — bilingual EN/中文)
      'div[contenteditable="true"][data-testid="msh-chatinput-editor"]',
      'div[contenteditable="true"][role="textbox"]',
      'div.chat-input-editor[contenteditable="true"]',
      'textarea[placeholder*="Kimi" i]',
      'textarea[placeholder*="Ask" i]',
      'textarea[placeholder*="Message" i]',
      'textarea[placeholder*="问"]',
      'textarea[placeholder*="发送"]',
      'div[contenteditable="true"][data-placeholder]',
      'div[contenteditable="true"]',
      'textarea',
    ],
    sendButtonSelectors: [
      'div[data-testid="msh-chatinput-send-button"]',
      'button[data-testid="msh-chatinput-send-button"]',
      'button[aria-label*="Send" i]',
      'button[aria-label*="Submit" i]',
      'button[aria-label*="发送"]',
      'div[role="button"][aria-label*="Send" i]',
      'div[role="button"][aria-label*="发送"]',
      'button[type="submit"]',
    ],
    responseContainerSelectors: [
      // Kimi response container — markdown-rendered assistant turn
      '.markdown',
      '[class*="markdown-body"]',
      '[class*="segment-assistant"] .markdown',
      '[data-role="assistant"] .markdown',
      '.prose',
      'article',
    ],
    loadedIndicatorSelectors: ['div[contenteditable="true"]', 'textarea', '[contenteditable]'],
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
    apiKeys: {},
    apiKeyOrder: ['chatgpt', 'claude', 'deepseek', 'gemini', 'grok', 'kimi', 'perplexity'],
    councilRoomSnapshot: null,
    councilUiState: {
      pinnedCandidateIds: [],
      selectedCandidateId: null,
    },
    councilSnapshots: [],
    activeCouncilSnapshotId: null,
    telegram: {
      enabled: false,
      botToken: '',
      chatId: '',
      lastUpdateId: 0,
    },
  },
})

let mainWindow: BrowserWindow | null = null
const views: Map<AiName, BrowserView> = new Map()
const AI_NAMES: AiName[] = ['chatgpt', 'claude', 'deepseek', 'gemini', 'grok', 'kimi', 'perplexity']
const DEFAULT_ENABLED_AI_NAMES: AiName[] = ['chatgpt', 'claude', 'gemini']
export const AI_DISPLAY_NAMES: Record<AiName, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
  grok: 'Grok',
  deepseek: 'DeepSeek',
  perplexity: 'Perplexity',
  kimi: 'Kimi',
}
// Which AIs are currently visible — user can toggle panels on/off
let enabledAiNames: AiName[] = [...DEFAULT_ENABLED_AI_NAMES]
let resizeDebounceTimer: ReturnType<typeof setTimeout> | null = null

// ─── Workflow pause-point gate ────────────────────────────────────────────────
// When non-null, the workflow is paused and waiting for the user to click
// Next or Continue. Resolved by the 'workflow-proceed' IPC handler.
// The resolver receives an optional new primaryAi if the user reassigned it.
let workflowProceedResolver: ((decision: { primaryAi?: AiName }) => void) | null = null

interface WorkflowAttachment {
  name: string
  path: string
  ext: string
}

interface WorkflowSessionState {
  topicSeed: string
  lastUserQuery: string
  currentPrimary: AiName
  latestDraft: string
  latestFinalAnswer: string
  latestFeedbacks: Array<{ ai: AiName; feedback: string }>
  fileContext: string
  attachedFiles: WorkflowAttachment[]
  participants: AiName[]
  roundsCompleted: number
}

let workflowSession: WorkflowSessionState | null = null

interface CouncilMessage {
  id: string
  kind: 'user' | 'assistant' | 'system'
  text: string
  createdAt: number
  source?: 'chat' | 'workflow-bridge'
  ai?: AiName
  pending?: boolean
  error?: boolean
}

interface CouncilIntentState {
  kind: 'mention' | 'all' | 'none' | 'unsupported'
  targetAi?: AiName
  targetAis?: AiName[]
  note: string
}

interface CouncilRoomState {
  participants: AiName[]
  primaryAi: AiName
  status: 'idle' | 'running'
  pendingAi: AiName | null
  messages: CouncilMessage[]
  lastIntent: CouncilIntentState | null
  failedTurn: {
    ai: AiName
    promptText: string
    errorMessage: string
  } | null
}

interface CouncilRuntimeState extends CouncilRoomState {
  deliveredCount: Partial<Record<AiName, number>>
  threadPrepared: Partial<Record<AiName, boolean>>
}

interface CouncilUiState {
  pinnedCandidateIds: string[]
  selectedCandidateId: string | null
}

interface CouncilSnapshotInsight {
  workflowReady: boolean
  workflowPreview: string | null
  moderatorConsensus: string | null
  moderatorNextSpeaker: AiName | null
  moderatorNextPrompt: string | null
}

type CouncilSnapshotLifecycle = 'in-progress' | 'completed'

interface CouncilSnapshotRecord {
  id: string
  title: string
  label: string | null
  note: string | null
  savedAt: number
  lastOpenedAt: number
  messageCount: number
  isFavorite: boolean
  isArchived: boolean
  lifecycle: CouncilSnapshotLifecycle
  room: CouncilRoomState
  uiState: CouncilUiState
  insight: CouncilSnapshotInsight
}

interface CouncilSnapshotExportEnvelope {
  version: 1
  exportedAt: number
  snapshot: CouncilSnapshotRecord
}

interface WorkflowCouncilBridgeResult {
  room: CouncilRoomState
  bridged: boolean
  note: string
}

// ─── UI Layout Constants ──────────────────────────────────────────────────────
const TITLEBAR_HEIGHT = 40
const TOOLBAR_HEIGHT = 120
const ATTACHMENT_BAR_HEIGHT = 34   // shown when files are attached
const STATUS_BAR_HEIGHT = 36
const FINAL_PANEL_HEADER_H = 36   // collapsed: header only
const FINAL_PANEL_FULL_H = 260  // expanded: full content
let finalPanelExpanded = false
const FINAL_PANEL_HEIGHT = 0      // legacy — not used directly below
const PANEL_HEADER_HEIGHT = 36
const COUNCIL_CHAT_PANEL_WIDTH = 420
let councilChatVisible = false

// Dynamically updated when attachment bar visibility changes
let attachmentBarVisible = false

let councilRoom: CouncilRuntimeState = loadPersistedCouncilRoom()
let councilTurnChain: Promise<void> = Promise.resolve()
let currentInteractionMode: InteractionMode = 'workflow'
const viewThreadOwners: Partial<Record<AiName, InteractionMode | null>> = {}
let councilWorkflowBridgeSignature: string | null = null

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
  `Chrome/${_CHROME_FULL} Safari/537.36`

// Chrome spoof preload path — needed both inside createWindow() and in the
// global web-contents-created handler for OAuth popup windows.
const CHROME_SPOOF_PRELOAD = path.join(__dirname, 'preload-chrome-spoof.js')
// Minimal preload that only overrides navigator.language → en-US.
// Safe for any AI site — does NOT patch Error/chrome globals like the spoof preload does.
const EN_LOCALE_PRELOAD = path.join(__dirname, 'preload-en-locale.js')
// Domain-gated preload: applies full Chrome spoofing ONLY when on Google/Microsoft/Apple
// OAuth pages.  Completely inert on chatgpt.com / perplexity.ai, so it is safe to attach
// to those BrowserViews without breaking their React/WebSocket code.
const OAUTH_GOOGLE_SPOOF_PRELOAD = path.join(__dirname, 'preload-oauth-google-spoof.js')

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

function createEmptyCouncilRuntimeState(): CouncilRuntimeState {
  return {
    participants: [...DEFAULT_ENABLED_AI_NAMES],
    primaryAi: 'gemini',
    status: 'idle',
    pendingAi: null,
    messages: [],
    lastIntent: null,
    failedTurn: null,
    deliveredCount: {},
    threadPrepared: {},
  }
}

function persistCouncilRoomState() {
  store.set('councilRoomSnapshot', cloneCouncilRoomState())
}

function loadPersistedCouncilRoom(): CouncilRuntimeState {
  const snapshot = store.get('councilRoomSnapshot')
  return loadPersistedCouncilRoomFromSnapshot(snapshot)
}

function sanitizeCouncilUiState(payload: Partial<CouncilUiState> | undefined | null): CouncilUiState {
  const pinnedCandidateIds = Array.isArray(payload?.pinnedCandidateIds)
    ? payload.pinnedCandidateIds.filter((id): id is string => typeof id === 'string')
    : []
  const selectedCandidateId = typeof payload?.selectedCandidateId === 'string'
    ? payload.selectedCandidateId
    : null

  return {
    pinnedCandidateIds,
    selectedCandidateId,
  }
}

function truncateSnapshotText(text: string | null | undefined, maxChars: number): string | null {
  if (typeof text !== 'string') return null
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return null
  return normalized.length <= maxChars ? normalized : `${normalized.slice(0, maxChars - 3).trimEnd()}...`
}

function sanitizeSnapshotLabel(label: string | null | undefined): string | null {
  return truncateSnapshotText(label, 28)
}

function sanitizeSnapshotNote(note: string | null | undefined): string | null {
  return truncateSnapshotText(note, 140)
}

function sanitizeSnapshotFilenamePart(value: string): string {
  const normalized = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, '-')
    .trim()
  return normalized.length > 0 ? normalized.slice(0, 48) : 'council-session'
}

function sanitizeSnapshotLifecycle(
  lifecycle: CouncilSnapshotLifecycle | string | null | undefined
): CouncilSnapshotLifecycle {
  return lifecycle === 'completed' ? 'completed' : 'in-progress'
}

function sanitizeCouncilSnapshotInsight(payload: Partial<CouncilSnapshotInsight> | undefined | null): CouncilSnapshotInsight {
  const nextSpeaker = payload?.moderatorNextSpeaker
  return {
    workflowReady: Boolean(payload?.workflowReady),
    workflowPreview: truncateSnapshotText(payload?.workflowPreview, 220),
    moderatorConsensus: truncateSnapshotText(payload?.moderatorConsensus, 160),
    moderatorNextSpeaker: typeof nextSpeaker === 'string' && AI_NAMES.includes(nextSpeaker as AiName)
      ? nextSpeaker as AiName
      : null,
    moderatorNextPrompt: truncateSnapshotText(payload?.moderatorNextPrompt, 180),
  }
}

function defaultCouncilSnapshotTitle(room: CouncilRoomState): string {
  const latestUserMessage = [...room.messages]
    .reverse()
    .find((message) => message.kind === 'user' && typeof message.text === 'string' && message.text.trim().length > 0)

  if (!latestUserMessage) {
    return `Council Snapshot ${new Date().toLocaleString()}`
  }

  const normalized = latestUserMessage.text.replace(/\s+/g, ' ').trim()
  return normalized.length <= 60 ? normalized : `${normalized.slice(0, 57).trimEnd()}...`
}

function sanitizeCouncilSnapshotRecord(record: CouncilSnapshotRecord): CouncilSnapshotRecord {
  const room = loadPersistedCouncilRoomFromSnapshot(record.room)
  const uiState = sanitizeCouncilUiState(record.uiState)
  const insight = sanitizeCouncilSnapshotInsight(record.insight)
  const allowedIds = new Set(room.messages.map((message) => message.id))

  return {
    id: record.id,
    title: typeof record.title === 'string' && record.title.trim().length > 0
      ? record.title.trim()
      : defaultCouncilSnapshotTitle(room),
    label: sanitizeSnapshotLabel(record.label),
    note: sanitizeSnapshotNote(record.note),
    savedAt: typeof record.savedAt === 'number' ? record.savedAt : Date.now(),
    lastOpenedAt: typeof record.lastOpenedAt === 'number'
      ? record.lastOpenedAt
      : (typeof record.savedAt === 'number' ? record.savedAt : Date.now()),
    messageCount: room.messages.length,
    isFavorite: Boolean(record.isFavorite),
    isArchived: Boolean(record.isArchived),
    lifecycle: sanitizeSnapshotLifecycle(record.lifecycle),
    room,
    uiState: {
      pinnedCandidateIds: uiState.pinnedCandidateIds.filter((id) => allowedIds.has(id)),
      selectedCandidateId: uiState.selectedCandidateId && allowedIds.has(uiState.selectedCandidateId)
        ? uiState.selectedCandidateId
        : null,
    },
    insight,
  }
}

function loadPersistedCouncilRoomFromSnapshot(snapshot: CouncilRoomState | null | undefined): CouncilRuntimeState {
  if (!snapshot) return createEmptyCouncilRuntimeState()

  const safeParticipants = Array.isArray(snapshot.participants)
    ? snapshot.participants.filter((ai): ai is AiName => AI_NAMES.includes(ai as AiName))
    : []
  const safeMessages = Array.isArray(snapshot.messages)
    ? snapshot.messages
        .filter((message): message is CouncilMessage => Boolean(message && typeof message.text === 'string'))
        .filter((message) => !message.pending)
        .map((message) => ({
          ...message,
          pending: false,
        }))
    : []

  return {
    participants: safeParticipants.length > 0 ? safeParticipants : [...DEFAULT_ENABLED_AI_NAMES],
    primaryAi: AI_NAMES.includes(snapshot.primaryAi) ? snapshot.primaryAi : 'gemini',
    status: 'idle',
    pendingAi: null,
    messages: safeMessages,
    lastIntent: safeMessages.length > 0
      ? {
          kind: 'none',
          note: 'Restored previous council transcript.',
        }
      : null,
    failedTurn: snapshot.failedTurn ?? null,
    deliveredCount: {},
    threadPrepared: {},
  }
}

function getCouncilSnapshots(): CouncilSnapshotRecord[] {
  const snapshots = store.get('councilSnapshots') ?? []
  return snapshots
    .map((snapshot) => sanitizeCouncilSnapshotRecord(snapshot))
    .sort((a, b) => {
      if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1
      return b.savedAt - a.savedAt
    })
}

function persistCouncilSnapshots(snapshots: CouncilSnapshotRecord[]) {
  store.set('councilSnapshots', snapshots)
}

function getActiveCouncilSnapshotId(): string | null {
  const value = store.get('activeCouncilSnapshotId')
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function setActiveCouncilSnapshotId(snapshotId: string | null) {
  store.set('activeCouncilSnapshotId', snapshotId)
}

function serializeCouncilSnapshotComparableState(
  room: CouncilRoomState,
  uiState: CouncilUiState
): string {
  return JSON.stringify({
    participants: [...room.participants],
    primaryAi: room.primaryAi,
    messages: room.messages.map((message) => ({
      id: message.id,
      kind: message.kind,
      text: message.text,
      createdAt: message.createdAt,
      ai: message.ai ?? null,
      pending: Boolean(message.pending),
      error: Boolean(message.error),
    })),
    lastIntent: room.lastIntent
      ? {
          kind: room.lastIntent.kind,
          targetAi: room.lastIntent.targetAi ?? null,
          targetAis: room.lastIntent.targetAis ?? [],
          note: room.lastIntent.note,
        }
      : null,
    failedTurn: room.failedTurn
      ? {
          ai: room.failedTurn.ai,
          promptText: room.failedTurn.promptText,
          errorMessage: room.failedTurn.errorMessage,
        }
      : null,
    uiState: {
      pinnedCandidateIds: [...uiState.pinnedCandidateIds],
      selectedCandidateId: uiState.selectedCandidateId,
    },
  })
}

function summarizeCouncilSnapshots(snapshots: CouncilSnapshotRecord[]) {
  const activeSnapshotId = getActiveCouncilSnapshotId()
  const currentRoom = loadPersistedCouncilRoomFromSnapshot(store.get('councilRoomSnapshot'))
  const currentUiState = sanitizeCouncilUiState(store.get('councilUiState'))
  const currentComparable = serializeCouncilSnapshotComparableState(currentRoom, currentUiState)
  return snapshots.map(({ id, title, label, note, savedAt, lastOpenedAt, messageCount, isFavorite, isArchived, lifecycle, room, uiState, insight }) => ({
    id,
    title,
    label,
    note,
    savedAt,
    lastOpenedAt,
    messageCount,
    isActive: id === activeSnapshotId,
    isDirty: id === activeSnapshotId
      ? serializeCouncilSnapshotComparableState(room, sanitizeCouncilUiState(uiState)) !== currentComparable
      : false,
    isFavorite,
    isArchived,
    lifecycle,
    primaryAi: room.primaryAi,
    participants: [...room.participants],
    insight,
  }))
}

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
  grok: [
    'button[aria-label="Stop"]',
    'button[aria-label="Stop generating"]',
    '[data-testid="stop-button"]',
  ],
  deepseek: [
    'button[aria-label*="Stop"]',
    '[data-testid="stop-button"]',
  ],
  kimi: [
    'button[aria-label*="Stop" i]',
    'button[aria-label*="停止"]',
    'div[role="button"][aria-label*="Stop" i]',
    'div[role="button"][aria-label*="停止"]',
    '[data-testid*="stop" i]',
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
  // Perplexity landing-page placeholder hints — appear when no answer has
  // been generated yet.  Patterns are unanchored so they match even when
  // the empty composer surfaces several hint lines at once
  // (e.g. "What do you want to know?\nType @ for connectors...\nType / ...").
  /what do you want to know\??/i,
  /\btype\s*@\s*for\s+connectors/i,
  /\btype\s*\/\s*for\s+search/i,
  /\bask anything\b/i,
]

/**
 * Returns true if the text matches multiple Perplexity landing-page hint
 * markers — meaning the captured "response" is actually the empty search
 * composer placeholder, not an answer to our prompt.  We use a 2+ marker
 * rule so a real answer that happens to mention the phrase "what do you
 * want to know" once doesn't get rejected.
 */
function isPerplexityPlaceholder(text: string): boolean {
  if (!text) return false
  if (text.length > 600) return false  // real answers are longer
  const markers = [
    /what do you want to know\??/i,
    /\btype\s*@\s*for\s+connectors/i,
    /\btype\s*\/\s*for\s+search/i,
    /\bsearch the web\b/i,
    /\bask anything\b/i,
  ]
  let hits = 0
  for (const re of markers) if (re.test(text)) hits++
  return hits >= 2
}

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

/**
 * Strip Claude-specific UI chrome from captured innerText.
 *
 * Claude's DOM (sidebar + conversation + footer) is read as one big
 * innerText blob, so we need to cut away three sections:
 *
 * 1. TOP CHROME — Claude sidebar lines before the actual response:
 *    "New chat / Search / Customize / Chats / Projects / Artifacts /
 *     Your chats will show up here / <username> / Free plan / Untitled / Get Pro"
 *    plus the echoed reviewer prompt the user sent.
 *
 * 2. PROMPT ECHO — Claude repeats the prompt we injected:
 *    "Here is an analysis result … Please review the above analysis …"
 *    followed by "Show more" button text.
 *    We detect the boundary by looking for "Please review" + the numbered
 *    criteria list and cut everything up to (and incl.) the last criterion.
 *
 * 3. FOOTER — Lines after the actual response:
 *    "Show more / HH:MM AM|PM / <model name> /
 *     Claude is AI and can make mistakes. Please double-check responses."
 */
function sanitizeClaudeFeedback(text: string): string {
  if (!text) return ''

  let result = text

  // ── 1. Strip top chrome: sidebar UI lines ──────────────────────────────
  // The sidebar always ends with "Get Pro" before the conversation starts.
  const GET_PRO = 'Get Pro'
  const getProIdx = result.indexOf(GET_PRO)
  if (getProIdx !== -1) {
    result = result.slice(getProIdx + GET_PRO.length).trimStart()
  }

  // ── 2. Strip the echoed prompt block ──────────────────────────────────
  // Our reviewer prompt always contains this closing instruction line:
  //   "4. Suggestions for improvement"
  // Everything up to and including that line (plus a trailing "Show more")
  // is the prompt echo — the real feedback starts after it.
  const PROMPT_BOUNDARY_PATTERNS = [
    /4\.\s+Suggestions for improvement\s*/i,
    /Please review the above analysis based on the following criteria[\s\S]*?4\.\s+Suggestions for improvement\s*/i,
  ]
  for (const pattern of PROMPT_BOUNDARY_PATTERNS) {
    const match = result.match(pattern)
    if (match && match.index !== undefined) {
      const afterBoundary = result.slice(match.index + match[0].length)
      // Skip any stray "Show more" button text right after the prompt
      result = afterBoundary.replace(/^Show more\s*/i, '').trimStart()
      break
    }
  }

  // ── 3. Strip footer: timestamp + model name + disclaimer ──────────────
  // Footer patterns (appear in this order at the very end):
  //   "Show more"          – may appear before footer too, handled above
  //   "HH:MM AM" or "HH:MM PM"
  //   "<Model name>" line
  //   "Claude is AI and can make mistakes…"
  const FOOTER_PATTERNS = [
    /\nShow more\s*\n?\d{1,2}:\d{2}\s*(AM|PM)[\s\S]*$/i,
    /\n\d{1,2}:\d{2}\s*(AM|PM)[\s\S]*$/i,
    /\nClaude is AI and can make mistakes[\s\S]*$/i,
  ]
  for (const pattern of FOOTER_PATTERNS) {
    result = result.replace(pattern, '')
  }

  return result.trim()
}

/** Returns true if the text is a real AI answer (not a disclaimer / too short). */
function isQualityResponse(text: string): boolean {
  if (text.length < 50) return false
  // Reject Perplexity's empty-composer placeholder before anything else.
  // Without this guard the polling loop accepts the landing-page hint text
  // ("What do you want to know? / Type @ for connectors / Type / for search…")
  // as the AI's "answer" and we relay that back to the user.
  if (isPerplexityPlaceholder(text)) return false
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

/**
 * Load a URL in a WebContents and swallow the noisy `ERR_ABORTED` rejection
 * that Electron emits whenever a subsequent navigation supersedes this one.
 * Any other error is logged (not thrown) so silent navigation failures still
 * surface in the log drawer.
 */
function loadURLSafe(
  wc: WebContents,
  url: string,
  context: string,
  options?: Electron.LoadURLOptions,
): Promise<void> {
  return wc.loadURL(url, options).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('ERR_ABORTED')) return
    sendLog('warn', `[${context}] loadURL failed: ${message}`)
  })
}

function cloneCouncilRoomState(): CouncilRoomState {
  return {
    participants: [...councilRoom.participants],
    primaryAi: councilRoom.primaryAi,
    status: councilRoom.status,
    pendingAi: councilRoom.pendingAi,
    messages: councilRoom.messages.map((message) => ({ ...message })),
    lastIntent: councilRoom.lastIntent ? { ...councilRoom.lastIntent } : null,
    failedTurn: councilRoom.failedTurn ? { ...councilRoom.failedTurn } : null,
  }
}

function emitCouncilRoomUpdate() {
  persistCouncilRoomState()
  mainWindow?.webContents.send('council-room-updated', cloneCouncilRoomState())
}

function emitCouncilStreamChunk(ai: AiName, messageId: string, text: string) {
  mainWindow?.webContents.send('council-stream-chunk', { ai, messageId, text })
}

function makeCouncilMessage(
  kind: CouncilMessage['kind'],
  text: string,
  extras: Partial<CouncilMessage> = {}
): CouncilMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    text,
    createdAt: Date.now(),
    source: extras.source ?? 'chat',
    ...extras,
  }
}

function hasMeaningfulCouncilMessages(messages: CouncilMessage[] = councilRoom.messages): boolean {
  return messages.some((message) => message.kind !== 'system' && message.text.trim().length > 0)
}

function getWorkflowBridgeStage(session: WorkflowSessionState): 'query' | 'draft' | 'reviews' | 'final' {
  if (session.latestFinalAnswer.trim().length > 0) return 'final'
  if (session.latestFeedbacks.some((item) => item.feedback.trim().length > 0)) return 'reviews'
  if (session.latestDraft.trim().length > 0) return 'draft'
  return 'query'
}

function buildWorkflowCouncilBridgeSignature(session: WorkflowSessionState): string {
  const feedbackSignature = session.latestFeedbacks
    .filter((item) => item.feedback.trim().length > 0)
    .map((item) => `${item.ai}:${item.feedback.trim().slice(0, 240)}`)
    .join('||')

  return [
    session.currentPrimary,
    session.lastUserQuery.trim(),
    session.latestDraft.trim().slice(0, 400),
    session.latestFinalAnswer.trim().slice(0, 400),
    feedbackSignature,
    session.attachedFiles.map((file) => file.name).join('|'),
    String(session.roundsCompleted),
  ].join('###')
}

function buildWorkflowCouncilBridgePayload(session: WorkflowSessionState): {
  summary: string
  messages: CouncilMessage[]
} {
  const stage = getWorkflowBridgeStage(session)
  const primaryName = AI_DISPLAY_NAMES[session.currentPrimary]
  const attachedFileSummary = session.attachedFiles.length > 0
    ? ` Attached files: ${session.attachedFiles.map((file) => file.name).join(', ')}.`
    : ''
  const reviewerMessages = session.latestFeedbacks
    .filter((item) => item.feedback.trim().length > 0)
    .map((item) => makeCouncilMessage('assistant', item.feedback.trim(), {
      ai: item.ai,
      source: 'workflow-bridge',
    }))
  const messages: CouncilMessage[] = []
  const userQuery = session.lastUserQuery.trim()

  if (userQuery) {
    messages.push(makeCouncilMessage('user', userQuery, { source: 'workflow-bridge' }))
  }

  if (stage === 'draft') {
    if (session.latestDraft.trim()) {
      messages.push(makeCouncilMessage('assistant', session.latestDraft.trim(), {
        ai: session.currentPrimary,
        source: 'workflow-bridge',
      }))
    }

    return {
      summary: `Imported the latest Workflow draft from ${primaryName} into Council Chat.${attachedFileSummary} Continue here and mention an AI when you want a reply.`,
      messages,
    }
  }

  if (stage === 'reviews') {
    if (session.latestDraft.trim()) {
      messages.push(makeCouncilMessage('assistant', session.latestDraft.trim(), {
        ai: session.currentPrimary,
        source: 'workflow-bridge',
      }))
    }
    messages.push(...reviewerMessages)

    return {
      summary: `Imported the current Workflow draft and reviewer feedback into Council Chat.${attachedFileSummary} Continue the discussion here before the final revision.`,
      messages,
    }
  }

  if (stage === 'final') {
    messages.push(...reviewerMessages)
    messages.push(makeCouncilMessage('assistant', session.latestFinalAnswer.trim(), {
      ai: session.currentPrimary,
      source: 'workflow-bridge',
    }))

    return {
      summary: `Imported the latest Workflow result from ${primaryName} into Council Chat.${attachedFileSummary} Continue here, or gather fresh council replies from the active AIs.`,
      messages,
    }
  }

  return {
    summary: `Imported the latest Workflow objective into Council Chat.${attachedFileSummary} Continue the discussion here and mention an AI when you want a reply.`,
    messages,
  }
}

function bridgeWorkflowToCouncil(
  participants: AiName[],
  primaryAi: AiName
): WorkflowCouncilBridgeResult {
  syncCouncilRoomContext(participants, primaryAi)
  councilRoom.status = 'idle'
  councilRoom.pendingAi = null
  clearFailedCouncilTurn()

  if (!workflowSession) {
    const note = hasMeaningfulCouncilMessages()
      ? 'Council Chat is active. The existing council transcript is ready to continue.'
      : 'Council Chat is active. Use @AI mentions in the docked panel to continue the conversation.'
    emitCouncilRoomUpdate()
    return {
      room: cloneCouncilRoomState(),
      bridged: false,
      note,
    }
  }

  const signature = buildWorkflowCouncilBridgeSignature(workflowSession)
  if (signature === councilWorkflowBridgeSignature) {
    const stage = getWorkflowBridgeStage(workflowSession)
    const note = stage === 'final'
      ? 'Council Chat is already synced with the latest Workflow result.'
      : 'Council Chat is already synced with the latest Workflow context.'
    emitCouncilRoomUpdate()
    return {
      room: cloneCouncilRoomState(),
      bridged: false,
      note,
    }
  }

  const { summary, messages } = buildWorkflowCouncilBridgePayload(workflowSession)
  const shouldReplaceTranscript = !hasMeaningfulCouncilMessages()

  if (shouldReplaceTranscript) {
    setActiveCouncilSnapshotId(null)
    councilRoom.messages = [makeCouncilMessage('system', summary, { source: 'workflow-bridge' }), ...messages]
    councilRoom.deliveredCount = {}
    councilRoom.threadPrepared = {}
  } else {
    councilRoom.messages.push(
      makeCouncilMessage('system', summary, { source: 'workflow-bridge' }),
      ...messages
    )
  }

  councilRoom.lastIntent = {
    kind: 'none',
    note: summary,
  }
  councilWorkflowBridgeSignature = signature
  emitCouncilRoomUpdate()

  return {
    room: cloneCouncilRoomState(),
    bridged: true,
    note: summary,
  }
}

function syncCouncilRoomContext(participants: AiName[], primaryAi: AiName): CouncilRoomState {
  const nextParticipants = participants.filter((ai) => AI_NAMES.includes(ai))
  councilRoom.participants = nextParticipants.length > 0 ? nextParticipants : [...DEFAULT_ENABLED_AI_NAMES]
  councilRoom.primaryAi = primaryAi
  emitCouncilRoomUpdate()
  return cloneCouncilRoomState()
}

function clearFailedCouncilTurn(note?: string) {
  councilRoom.failedTurn = null
  if (note) {
    councilRoom.lastIntent = {
      kind: 'none',
      note,
    }
  }
}

/**
 * Record a failed council turn and emit an update.
 * `processCouncilTurn` already resets `status`/`pendingAi` and removes its
 * placeholder on throw — this helper only captures the failure metadata and
 * appends a user-facing system message.
 */
function recordCouncilTurnFailure(
  ai: AiName,
  promptText: string,
  err: unknown,
  intent?: CouncilIntentState,
) {
  const errorMessage = err instanceof Error ? err.message : String(err)
  councilRoom.lastIntent = intent ?? {
    kind: 'mention',
    targetAi: ai,
    note: `${AI_DISPLAY_NAMES[ai]} failed to reply.`,
  }
  councilRoom.failedTurn = { ai, promptText, errorMessage }
  councilRoom.messages.push(
    makeCouncilMessage(
      'system',
      `Failed to get a reply from ${AI_DISPLAY_NAMES[ai]}: ${errorMessage}`,
      { error: true },
    ),
  )
  emitCouncilRoomUpdate()
}

function doesWorkflowOwnThread(ai: AiName): boolean {
  return viewThreadOwners[ai] === 'workflow' && Boolean(workflowSession?.participants.includes(ai))
}

function doesCouncilOwnThread(ai: AiName): boolean {
  return viewThreadOwners[ai] === 'chat' && Boolean(councilRoom.threadPrepared[ai])
}

function markViewThreadOwner(ai: AiName, mode: InteractionMode | null) {
  viewThreadOwners[ai] = mode
}

async function handoffInteractionMode(
  mode: InteractionMode,
  participants: AiName[],
  primaryAi: AiName
): Promise<CouncilRoomState> {
  currentInteractionMode = mode
  councilChatVisible = mode === 'chat'

  if (mode === 'chat') {
    syncCouncilRoomContext(participants, primaryAi)
    councilRoom.status = 'idle'
    councilRoom.pendingAi = null
    clearFailedCouncilTurn()
    for (const ai of AI_NAMES) {
      if (viewThreadOwners[ai] !== 'chat') {
        delete councilRoom.threadPrepared[ai]
      }
    }
  } else {
    councilRoom.status = 'idle'
    councilRoom.pendingAi = null
    clearFailedCouncilTurn('Workflow mode is active.')
    councilRoom.threadPrepared = {}
  }

  updateViewBounds()
  emitCouncilRoomUpdate()
  return cloneCouncilRoomState()
}

function resetCouncilRoomContext(participants?: AiName[], primaryAi: AiName = councilRoom.primaryAi): CouncilRoomState {
  setActiveCouncilSnapshotId(null)
  councilWorkflowBridgeSignature = null
  councilRoom = {
    participants: participants && participants.length > 0 ? participants : [...DEFAULT_ENABLED_AI_NAMES],
    primaryAi,
    status: 'idle',
    pendingAi: null,
    messages: [
      makeCouncilMessage(
        'system',
        'Council Chat is ready. Mention one or more active AIs (e.g. @Gemini, @Gemini @DeepSeek) or @all to request replies.'
      ),
    ],
    lastIntent: {
      kind: 'none',
      note: 'Shared transcript is ready. Mention one or more AIs (e.g. @Gemini @DeepSeek) or @all.',
    },
    failedTurn: null,
    deliveredCount: {},
    threadPrepared: {},
  }
  emitCouncilRoomUpdate()
  return cloneCouncilRoomState()
}

// Council prompt/intent helpers are in ./councilPrompt.ts — these wrappers
// bind the pure functions to this module's state (AI_NAMES, AI_DISPLAY_NAMES,
// councilRoom, AI_REVIEWER_BRIEFS).
const parseCouncilIntent = parseCouncilIntentPure
void _COUNCIL_MENTION_ALIASES

function getSequentialCouncilTargets(participants: AiName[], primaryAi: AiName): AiName[] {
  return getSequentialCouncilTargetsPure(participants, primaryAi, AI_NAMES)
}

function summarizeCouncilMessages(messages: CouncilMessage[], maxChars: number): string {
  return summarizeCouncilMessagesPure(messages, maxChars, AI_DISPLAY_NAMES)
}

function renderCouncilTranscript(messages: CouncilMessage[]): string {
  return renderCouncilTranscriptPure(messages, AI_DISPLAY_NAMES)
}

function buildCouncilPrompt(aiName: AiName, promptText: string): string {
  return buildCouncilPromptPure(aiName, promptText, {
    deliveredCount: councilRoom.deliveredCount[aiName] ?? 0,
    messages: councilRoom.messages,
    displayNames: AI_DISPLAY_NAMES,
    brief: AI_REVIEWER_BRIEFS[aiName],
  })
}

/**
 * Build the broadcast / fan-out prompt for a single AI.  The previous-round
 * snapshot is captured by the caller (before any new placeholders are added)
 * so peer AIs in the SAME round are never visible to each other — every AI
 * in the round sees the exact same prompt, including the same view of the
 * previous round's answers.
 */
function buildCouncilBroadcastPromptForAi(
  aiName: AiName,
  userQuestion: string,
  messagesSnapshot: CouncilMessage[],
): string {
  const previousRoundReplies = extractPreviousRoundRepliesPure(messagesSnapshot)
  const earlierContextSummary = summarizeContextBeforePreviousRoundPure(
    messagesSnapshot,
    AI_DISPLAY_NAMES,
    1600,
  )
  return buildCouncilBroadcastPromptPure(aiName, userQuestion, {
    displayNames: AI_DISPLAY_NAMES,
    brief: AI_REVIEWER_BRIEFS[aiName],
    previousRoundReplies,
    earlierContextSummary,
  })
}

interface ProcessCouncilTurnOptions {
  /** When true, the caller manages councilRoom.status / pendingAi / lastIntent
   * and supplies a placeholder. Used by the broadcast orchestrator so that
   * parallel turns do not stomp on shared state. */
  skipStatusMgmt?: boolean
  /** Pre-built placeholder message already pushed onto councilRoom.messages.
   * Required when skipStatusMgmt is true. */
  prebuiltPlaceholder?: CouncilMessage
  /** When provided, this exact text (after optional file-context append) is
   * sent to the AI instead of the default per-AI buildCouncilPrompt() output.
   * Used by broadcast so every AI in the round receives the same prompt and
   * is not influenced by peers' just-generated replies. */
  prebuiltPrompt?: string
}

async function processCouncilTurn(
  aiName: AiName,
  promptText: string,
  filePaths: string[] = [],
  attachedFiles: Array<{ name: string; path: string; ext: string }> = [],
  options: ProcessCouncilTurnOptions = {},
): Promise<void> {
  const view = views.get(aiName)
  if (!view) throw new Error(`No BrowserView found for ${aiName}`)

  const manageStatus = !options.skipStatusMgmt
  if (manageStatus) {
    councilRoom.status = 'running'
    councilRoom.pendingAi = aiName
    councilRoom.lastIntent = {
      kind: 'mention',
      targetAi: aiName,
      note: `${AI_DISPLAY_NAMES[aiName]} is replying...`,
    }
  }
  const placeholder = options.prebuiltPlaceholder ?? (() => {
    const ph = makeCouncilMessage('assistant', 'Waiting for reply...', {
      ai: aiName,
      pending: true,
    })
    councilRoom.messages.push(ph)
    return ph
  })()
  emitCouncilRoomUpdate()

  try {
    const config = getSelectors(aiName)
    if (!doesCouncilOwnThread(aiName)) {
      await navigateToNewChat(view, aiName)
      markViewThreadOwner(aiName, 'chat')
      councilRoom.threadPrepared[aiName] = true
    }

    const inputRes = await execWithFallback(
      view,
      config.inputSelectors,
      (sel) => `!!document.querySelector(\`${sel}\`)`
    )
    if (!inputRes.success || !inputRes.selector) {
      throw new Error(`Input selector not found for ${aiName}`)
    }

    const baseline = await captureCurrentText(view, config.responseContainerSelectors)

    // Attach files via CDP before injecting text (images, documents, etc.)
    let filesAttachedViaCDP = false
    if (filePaths.length > 0) {
      sendLog('info', `[council] ${aiName}: attaching ${filePaths.length} file(s) via CDP`)
      filesAttachedViaCDP = await attachFilesViaCDP(view, aiName, filePaths)
      if (filesAttachedViaCDP) {
        sendLog('info', `[council] ${aiName}: file attach succeeded — waiting for upload to complete`)
        // Wait for file upload/processing to finish (ChatGPT shows a spinner
        // during upload and blocks Send until the file is fully processed).
        await waitForFileUploadComplete(view, aiName)
      } else {
        sendLog('warn', `[council] ${aiName}: file attach failed — falling back to text extraction`)
        // Close any dialogs that may have been left open
        view.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' })
        view.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' })
        await sleep(400)
      }
      await sleep(800)
    }

    // Build council prompt; if CDP failed, extract document text and append it.
    // Broadcast mode supplies a prebuilt prompt so every AI in the round sees
    // the exact same input and isn't influenced by peers' just-generated text.
    let councilPrompt = options.prebuiltPrompt ?? buildCouncilPrompt(aiName, promptText)
    if (attachedFiles.length > 0 && !filesAttachedViaCDP) {
      const fileContext = await buildFileContext(attachedFiles)
      if (fileContext.trim().length > 0) {
        councilPrompt += '\n' + fileContext
        sendLog('info', `[council] ${aiName}: appended ${fileContext.length} chars of file context to prompt`)
      }
    }

    sendLog('info', `[council] ${aiName}: injecting ${councilPrompt.length} chars`)
    await pasteText(view, councilPrompt, inputRes.selector, aiName)
    if (filePaths.length > 0) {
      sendLog('info', `[council] ${aiName}: waiting for composer to become send-ready after attachment`)
      await waitForComposerReadyToSend(view, aiName, config.sendButtonSelectors)
    }
    await sleep(CLICK_SEND_DELAY_MS)

    const sent = await clickSend(view, config.sendButtonSelectors, aiName)
    if (!sent) {
      throw new Error(`Send button not found for ${aiName}`)
    }

    await sleep(INITIAL_RESPONSE_WAIT_MS)
    const reply = await waitForStableResponse(
      view,
      config.responseContainerSelectors,
      WORKFLOW_TIMEOUT_MS,
      STABLE_RESPONSE_MS,
      aiName,
      baseline,
      (chunk) => {
        const placeholderIndex = councilRoom.messages.findIndex((message) => message.id === placeholder.id)
        if (placeholderIndex === -1) return
        councilRoom.messages[placeholderIndex] = {
          ...councilRoom.messages[placeholderIndex],
          text: chunk,
          pending: true,
        }
        emitCouncilStreamChunk(aiName, placeholder.id, chunk)
        emitCouncilRoomUpdate()
      }
    )

    const placeholderIndex = councilRoom.messages.findIndex((message) => message.id === placeholder.id)
    const finalMessage = makeCouncilMessage('assistant', reply, { ai: aiName })
    if (placeholderIndex !== -1) {
      councilRoom.messages.splice(placeholderIndex, 1, finalMessage)
    } else {
      councilRoom.messages.push(finalMessage)
    }

    if (telegramAiReplyCallback) {
      telegramAiReplyCallback(aiName, reply)
    }

    councilRoom.deliveredCount[aiName] = councilRoom.messages.length
    if (manageStatus) {
      councilRoom.status = 'idle'
      councilRoom.pendingAi = null
      councilRoom.lastIntent = {
        kind: 'mention',
        targetAi: aiName,
        note: `${AI_DISPLAY_NAMES[aiName]} replied and the transcript is shared with the council.`,
      }
    }
    emitCouncilRoomUpdate()
  } catch (err) {
    // Guaranteed cleanup: remove this turn's placeholder so the caller only
    // needs to record the failure — they don't risk drifting from the
    // transcript shape.  Status mutation is left to the caller in broadcast
    // mode so peers' running turns aren't reset prematurely.
    const idx = councilRoom.messages.findIndex((message) => message.id === placeholder.id)
    if (idx !== -1) councilRoom.messages.splice(idx, 1)
    if (manageStatus) {
      if (councilRoom.pendingAi === aiName) councilRoom.pendingAi = null
      councilRoom.status = 'idle'
    }
    emitCouncilRoomUpdate()
    throw err
  }
}

async function enqueueCouncilTurn(
  aiName: AiName,
  promptText: string,
  filePaths: string[] = [],
  attachedFiles: Array<{ name: string; path: string; ext: string }> = []
): Promise<void> {
  councilTurnChain = councilTurnChain
    .catch(() => undefined)
    .then(() => processCouncilTurn(aiName, promptText, filePaths, attachedFiles))
  return councilTurnChain
}

interface CouncilBroadcastResult {
  successes: AiName[]
  failures: Array<{ ai: AiName; error: unknown }>
}

/**
 * Fan-out / broadcast dispatcher.
 *
 * Sends the SAME prompt to every target AI in parallel — never the sequential
 * pipeline that would let AI #2 see AI #1's just-generated reply.  The prompt
 * for each AI is built from a snapshot of the transcript taken BEFORE any
 * round placeholders are added, so peers in the same round are invisible to
 * each other.  Between rounds, every AI sees a "Previous round — what every
 * active AI just answered" block so they can integrate / re-organize.
 */
async function runCouncilBroadcast(
  targets: AiName[],
  userText: string,
  filePaths: string[],
  attachedFiles: Array<{ name: string; path: string; ext: string }>,
): Promise<CouncilBroadcastResult> {
  if (targets.length === 0) return { successes: [], failures: [] }

  // Snapshot transcript state before adding placeholders so every AI in this
  // round receives the identical prompt — including the same view of the
  // previous round's per-AI replies.
  const messagesSnapshot = councilRoom.messages.slice()

  const targetLabels = targets.map((ai) => AI_DISPLAY_NAMES[ai]).join(', ')
  councilRoom.status = 'running'
  councilRoom.pendingAi = targets[0] ?? null
  councilRoom.lastIntent = targets.length === 1
    ? {
        kind: 'mention',
        targetAi: targets[0],
        note: `${AI_DISPLAY_NAMES[targets[0]]} is replying...`,
      }
    : {
        kind: 'all',
        targetAis: targets,
        note: `Broadcasting the same prompt in parallel to ${targetLabels}.`,
      }

  // Create placeholders for ALL targets up-front so the UI shows every AI as
  // pending immediately.  Insertion order matches the user's mention order.
  const placeholders: CouncilMessage[] = targets.map((ai) =>
    makeCouncilMessage('assistant', 'Waiting for reply...', { ai, pending: true })
  )
  councilRoom.messages.push(...placeholders)
  emitCouncilRoomUpdate()

  const successes: AiName[] = []
  const failures: Array<{ ai: AiName; error: unknown }> = []

  // Serialize the channel queue so the existing councilTurnChain still settles
  // sequentially with respect to OTHER queued turns (retry, telegram), but
  // the targets within THIS broadcast are launched in parallel.
  const broadcastPromise = (async () => {
    const promptByAi = new Map<AiName, string>()
    for (const ai of targets) {
      promptByAi.set(ai, buildCouncilBroadcastPromptForAi(ai, userText, messagesSnapshot))
    }

    const settled = await Promise.allSettled(
      targets.map((ai, index) =>
        processCouncilTurn(ai, userText, filePaths, attachedFiles, {
          skipStatusMgmt: true,
          prebuiltPlaceholder: placeholders[index],
          prebuiltPrompt: promptByAi.get(ai),
        })
      )
    )

    settled.forEach((res, i) => {
      const ai = targets[i]
      if (res.status === 'fulfilled') {
        successes.push(ai)
      } else {
        failures.push({ ai, error: res.reason })
      }
    })
  })()

  // Drain the existing chain first, then run the broadcast.  This keeps
  // retry/telegram turns sequenced relative to broadcasts.
  councilTurnChain = councilTurnChain.catch(() => undefined).then(() => broadcastPromise)
  await councilTurnChain

  // Failures are recorded after the parallel run completes so error system
  // messages don't interleave with live placeholder updates.
  for (const { ai, error } of failures) {
    recordCouncilTurnFailure(ai, userText, error, {
      kind: targets.length === 1 ? 'mention' : 'all',
      targetAi: ai,
      targetAis: targets.length === 1 ? undefined : targets,
      note: `${AI_DISPLAY_NAMES[ai]} failed to reply.`,
    })
  }

  councilRoom.status = 'idle'
  councilRoom.pendingAi = null

  if (targets.length > 1) {
    const successList = successes.length > 0
      ? successes.map((ai) => AI_DISPLAY_NAMES[ai]).join(', ')
      : 'no AI'
    councilRoom.lastIntent = {
      kind: 'all',
      targetAis: targets,
      note: failures.length === 0
        ? `Broadcast finished: ${successList} replied in parallel.`
        : `Broadcast finished: ${successList} replied; ${failures.length} failed.`,
    }
  } else if (successes.length === 1) {
    const ai = successes[0]
    councilRoom.lastIntent = {
      kind: 'mention',
      targetAi: ai,
      note: `${AI_DISPLAY_NAMES[ai]} replied and the transcript is shared with the council.`,
    }
  }
  emitCouncilRoomUpdate()

  return { successes, failures }
}

/**
 * Pause the workflow at a named stage and wait for the user to click
 * Next or Continue.
 * Sends 'workflow-waiting' to the renderer so the button label updates,
 * then blocks until the renderer calls 'workflow-proceed'.
 * Returns the new primaryAi if the user reassigned it at the pause point,
 * or undefined if the primary AI was not changed.
 */
function waitForUserProceed(stage: 'after-draft' | 'after-reviews'): Promise<{ primaryAi?: AiName }> {
  return new Promise<{ primaryAi?: AiName }>((resolve) => {
    workflowProceedResolver = resolve
    mainWindow?.webContents.send('workflow-waiting', { stage })
  })
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
async function pasteText(view: BrowserView, text: string, selector: string, aiName?: AiName) {
  const jsonSelector = JSON.stringify(selector)

  // Focus the target element first using DOM methods (which might be ignored by anti-bot, but good as a first step)
  const inputRect = await view.webContents.executeJavaScript(`
    (() => {
      const target = document.querySelector(${jsonSelector});
      if (!target) return null;
      target.click();
      target.focus();
      // Clear any existing value for textareas using native select()
      if (typeof target.select === 'function') {
        target.select();
      }

      // Return bounding rect for native click
      const r = target.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, isContentEditable: target.isContentEditable };
    })()
  `)

  // CRITICAL: Focus the BrowserView itself before dispatching keyboard/mouse input.
  try { view.webContents.focus() } catch { /* view may be detached */ }
  await sleep(30)

  // NATIVE CLICK on the text area to defeat anti-bot focus restrictions (like DeepSeek)
  if (inputRect) {
    view.webContents.sendInputEvent({ type: 'mouseDown', x: Math.round(inputRect.x), y: Math.round(inputRect.y), button: 'left', clickCount: 1 })
    view.webContents.sendInputEvent({ type: 'mouseUp', x: Math.round(inputRect.x), y: Math.round(inputRect.y), button: 'left', clickCount: 1 })
    await sleep(50)
  }

  // ── Kimi: use execCommand('insertText') instead of Ctrl+V ────────────────
  // Kimi converts clipboard pastes that exceed ~4000 bytes into a TXT file
  // attachment, leaving the input empty and blocking send.  execCommand fires
  // an 'input' event (not 'paste'), so Kimi's paste-size guard is bypassed.
  if (aiName === 'kimi') {
    const inserted = await view.webContents.executeJavaScript(`
      (() => {
        const target = document.querySelector(${jsonSelector});
        if (!target) return false;
        target.focus();
        // Clear existing content with Ctrl+A + Delete via execCommand
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        // Insert text directly — fires 'input' event, bypasses paste handler
        const ok = document.execCommand('insertText', false, ${JSON.stringify(text)});
        if (!ok) {
          // execCommand not supported: fall through to clipboard path
          return false;
        }
        return true;
      })()
    `).catch(() => false)

    if (inserted) {
      await sleep(150)
      return
    }
    // If execCommand failed, fall through to clipboard paste below
    sendLog('warn', '[pasteText] kimi: execCommand insertText failed — falling back to clipboard paste')
  }

  // Use Electron clipboard + Ctrl+A/Ctrl+V via sendInputEvent.
  const { clipboard } = require('electron')
  clipboard.writeText(text)

  // Ctrl+A to clear, then Ctrl+V to paste
  view.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'A', modifiers: ['ctrl'] })
  view.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'A', modifiers: ['ctrl'] })
  await sleep(50)
  view.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'V', modifiers: ['ctrl'] })
  view.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'V', modifiers: ['ctrl'] })
  await sleep(150)

  // Last-resort fallback: directly set the value via JS and dispatch the
  // native input event. We DO NOT mutate innerText for contenteditable
  // because that crashes React apps (like DeepSeek) with unhandled exceptions!
  await view.webContents.executeJavaScript(`
    (() => {
      const target = document.querySelector(${jsonSelector});
      if (!target) return false;
      const currentValue = target.value ?? target.innerText ?? '';
      const expected = ${JSON.stringify(text)};
      // Already populated by the paste — nothing to do.
      if (currentValue && currentValue.includes(expected.slice(0, 32))) return 'paste-ok';

      // Manual injection path ONLY for standard inputs/textareas
      if ('value' in target && !target.isContentEditable) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
          || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (setter) setter.call(target, expected);
        else target.value = expected;
        target.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: expected }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
        return 'fallback-injected';
      }
      return 'fallback-skipped-contenteditable';
    })()
  `).catch(() => { /* swallow — best-effort fallback */ })
}

/**
 * After we paste the prompt, some UIs still keep Send disabled while they
 * finish indexing attached files. ChatGPT is the most sensitive to this.
 */
async function waitForComposerReadyToSend(
  view: BrowserView,
  ai: AiName,
  sendSelectors: string[]
): Promise<void> {
  const maxWaitMs = ai === 'chatgpt' ? 90000 : 20000
  const pollIntervalMs = 350
  const startTime = Date.now()
  let lastStatus = ''

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const status = await view.webContents.executeJavaScript(`
        (() => {
          const isVisible = (el) => {
            if (!(el instanceof HTMLElement)) return false;
            const rect = el.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return false;
            const style = window.getComputedStyle(el);
            return style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
          };

          const sendSelectors = ${JSON.stringify(sendSelectors)};
          const inputSelectors = ${JSON.stringify(getSelectors(ai).inputSelectors)};
          const busySelectors = [
            '[role="progressbar"]',
            'progress',
            '[aria-busy="true"]',
            '.animate-spin',
            'svg[class*="spin"]',
            '.spinner',
            '.loading'
          ];

          let inputEl = null;
          for (const sel of inputSelectors) {
            const found = document.querySelector(sel);
            if (found instanceof HTMLElement) {
              inputEl = found;
              break;
            }
          }
          if (!inputEl) {
            const fallback = document.querySelector('textarea, div[contenteditable="true"]');
            if (fallback instanceof HTMLElement) inputEl = fallback;
          }

          const inputText = inputEl
            ? ('value' in inputEl ? String(inputEl.value || '') : String(inputEl.innerText || inputEl.textContent || ''))
            : '';
          const inputHasText = inputText.trim().length > 0;

          let sendFound = false;
          let sendEnabled = false;
          for (const sel of sendSelectors) {
            const btn = document.querySelector(sel);
            if (!(btn instanceof HTMLElement) || !isVisible(btn)) continue;
            sendFound = true;
            sendEnabled = !btn.hasAttribute('disabled') && btn.getAttribute('aria-disabled') !== 'true';
            break;
          }

          const hasVisibleBusyIndicator = busySelectors.some((sel) =>
            Array.from(document.querySelectorAll(sel)).some((el) => isVisible(el))
          );

          const attachmentBusy = Array.from(
            document.querySelectorAll('[data-testid^="file-"], [data-testid*="attachment"], [data-testid*="file-pill"]')
          ).some((el) => {
            if (!(el instanceof HTMLElement) || !isVisible(el)) return false;
            const text = (el.innerText || el.textContent || '').toLowerCase();
            if (/upload|processing|analy|index|extract|reading/.test(text)) return true;
            return busySelectors.some((sel) => {
              try {
                return Array.from(el.querySelectorAll(sel)).some((child) => isVisible(child));
              } catch {
                return false;
              }
            });
          });

          const dragOverlayVisible = Array.from(document.querySelectorAll('div, section, form, [role="dialog"]')).some((el) => {
            if (!(el instanceof HTMLElement) || !isVisible(el)) return false;
            const text = (el.innerText || el.textContent || '').toLowerCase();
            return text.includes('add anything') && text.includes('drop any file here');
          });

          const duplicateDialogVisible = Array.from(document.querySelectorAll('div, section, [role="dialog"]')).some((el) => {
            if (!(el instanceof HTMLElement) || !isVisible(el)) return false;
            const text = (el.innerText || el.textContent || '').toLowerCase();
            return text.includes('already uploaded this file');
          });

          return {
            inputHasText,
            sendFound,
            sendEnabled,
            busy: hasVisibleBusyIndicator || attachmentBusy || dragOverlayVisible || duplicateDialogVisible,
            dragOverlayVisible,
            duplicateDialogVisible,
          };
        })()
      `)

      lastStatus = JSON.stringify(status)
      if (ai === 'chatgpt' && (status?.dragOverlayVisible || status?.duplicateDialogVisible)) {
        await dismissChatgptUploadOverlay(view)
      }
      if (status?.inputHasText && (!status?.sendFound || status?.sendEnabled) && !status?.busy) {
        await sleep(ai === 'chatgpt' ? 500 : 200)
        return
      }
    } catch (err) {
      sendLog('warn', `[composer-ready] ${ai}: error while polling composer state: ${err instanceof Error ? err.message : String(err)}`)
      break
    }

    await sleep(pollIntervalMs)
  }

  sendLog('warn', `[composer-ready] ${ai}: timed out waiting for send-ready composer after ${maxWaitMs}ms; last=${lastStatus || 'n/a'}`)
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
  baselineText = '',
  onChunk?: (text: string) => void
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
    let lastChunkSent = ''

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
                const els = Array.from(document.querySelectorAll(\`${sel}\`));
                if (!els.length) return '';
                // Drop elements that are descendants of another match — prefer
                // the outermost container when the selector matches both a parent
                // and its children.
                const outermost = els.filter(el => !els.some(other => other !== el && other.contains(el)));
                const lastEl = outermost[outermost.length - 1];
                if (!lastEl) return '';
                // If multiple sibling matches share the same direct parent (e.g. a
                // bilingual response rendered as two sibling blocks with the same
                // class), join them so both the English and Korean portions are
                // captured rather than only the last sibling.
                const siblings = outermost.filter(el => el.parentElement === lastEl.parentElement);
                if (siblings.length > 1) {
                  return siblings.map(el => el.innerText?.trim() || '').filter(Boolean).join('\\n\\n');
                }
                return lastEl.innerText?.trim() || '';
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
          if (onChunk && cleanText !== lastChunkSent) {
            lastChunkSent = cleanText
            onChunk(cleanText)
          }

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
async function clickSend(view: BrowserView, selectors: string[], aiName?: AiName): Promise<boolean> {
  // Ensure the BrowserView has OS-level focus before any input dispatch.
  // Without this, when multiple AI panels are visible the synthetic click
  // can succeed at the DOM level but the page never registers the action
  // (or, worse, focus events fire on a different panel).
  try { view.webContents.focus() } catch { /* view may be detached */ }

  // First attempt: try synthetic click using config selectors
  const res = await execWithFallback(view, selectors, (sel) => `
    (() => {
      const btn = document.querySelector(\`${sel}\`);
      if (!btn) return false;
      // Skip disabled controls — clicking them is a no-op and we'd mistakenly report success
      if (btn.disabled) return false;
      if (btn.getAttribute('aria-disabled') === 'true') return false;
      btn.focus();
      btn.click();
      return true;
    })()
  `)
  if (res.success) return true

  // ── Kimi: skip the DOM heuristic and submit via CDP ───────────────────────
  // Kimi's composer footer has multiple icon buttons (model selector, emoji,
  // "+", send arrow) and the generic heuristic can pick the wrong one.
  // We try two trusted strategies in order:
  //   1. CDP mouse click on the visible send button (most reliable — directly
  //      fires Kimi's React onClick handler with isTrusted=true)
  //   2. CDP Enter key (clean keydown — NO `text` payload, otherwise Kimi's
  //      contenteditable inserts a literal \r and Send never enables)
  if (aiName === 'kimi') {
    let attached = false
    try {
      // Locate composer + send button geometry in one round-trip
      const probe = await view.webContents.executeJavaScript(`
        (() => {
          const editor = document.querySelector('div[contenteditable="true"][data-testid="msh-chatinput-editor"]')
                      || document.querySelector('div.chat-input-editor[contenteditable="true"]')
                      || document.querySelector('div[contenteditable="true"][role="textbox"]')
                      || document.querySelector('div[contenteditable="true"]');
          if (!editor) return { ok: false, reason: 'no-editor' };
          editor.focus();
          // Place caret at end so Enter (fallback) triggers send, not split
          try {
            const range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
            const sel = window.getSelection();
            if (sel) { sel.removeAllRanges(); sel.addRange(range); }
          } catch (e) { /* best-effort */ }
          const text = String(editor.innerText || editor.textContent || '');
          const hadText = text.trim().length > 0;
          // Fingerprint a chunk of the typed text so we can verify submission
          // by its disappearance — innerText alone can be misleading because
          // Kimi may render a placeholder span when the composer is empty.
          const trimmed = text.trim();
          const fingerprint = trimmed.length >= 8
            ? trimmed.slice(0, Math.min(48, trimmed.length))
            : trimmed;

          // Find the send button — try testid first, then heuristic.
          // Heuristic: rightmost icon-only enabled button in the composer
          // footer that is NOT an attach button.
          let sendBtn = document.querySelector('[data-testid="msh-chatinput-send-button"]');
          if (!sendBtn || sendBtn.getAttribute('aria-disabled') === 'true' || sendBtn.disabled) {
            // Walk up to composer container
            let composer = editor.parentElement;
            for (let i = 0; i < 10 && composer; i++) {
              const candidates = composer.querySelectorAll('button, div[role="button"]');
              if (candidates.length >= 2) {
                const attachLabels = /attach|upload|file|clip|image|photo|emoji/i;
                const iconOnly = [];
                for (const c of candidates) {
                  if (c.disabled) continue;
                  if (c.getAttribute('aria-disabled') === 'true') continue;
                  const aria = (c.getAttribute('aria-label') || '') + ' ' + (c.getAttribute('title') || '');
                  if (attachLabels.test(aria)) continue;
                  if ((c.innerText || '').trim().length > 2) continue;
                  if (!c.querySelector('svg, img')) continue;
                  const r = c.getBoundingClientRect();
                  if (r.width === 0 || r.height === 0) continue;
                  iconOnly.push({ el: c, x: r.right });
                }
                if (iconOnly.length > 0) {
                  iconOnly.sort((a, b) => b.x - a.x);
                  sendBtn = iconOnly[0].el;
                  break;
                }
              }
              composer = composer.parentElement;
            }
          }

          let btnRect = null;
          if (sendBtn) {
            const r = sendBtn.getBoundingClientRect();
            if (r.width > 0 && r.height > 0
                && !sendBtn.disabled
                && sendBtn.getAttribute('aria-disabled') !== 'true') {
              btnRect = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
            }
          }
          return { ok: true, hadText, btnRect, fingerprint };
        })()
      `).catch(() => ({ ok: false }))

      if (probe?.ok && probe?.hadText) {
        try { view.webContents.focus() } catch { /* ignore */ }

        const dbg = view.webContents.debugger
        if (!dbg.isAttached()) {
          try { dbg.attach('1.3'); attached = true } catch (e) {
            sendLog('warn', '[clickSend] kimi: debugger attach failed: ' + (e instanceof Error ? e.message : String(e)))
          }
        }

        // Verify submission by polling for either:
        //   (a) the typed text fingerprint is no longer in the composer, OR
        //   (b) a stop/abort button has appeared (Kimi swaps Send → Stop while
        //       streaming — a strong positive signal even if the composer
        //       briefly retains a placeholder span).
        // Polling avoids racing Kimi's clear animation, which can take >400ms.
        const verifySubmitted = async (): Promise<boolean> => {
          const fp = (probe?.fingerprint ?? '') as string
          const fpJson = JSON.stringify(fp)
          const deadline = Date.now() + 2000
          while (Date.now() < deadline) {
            await sleep(150)
            const state = await view.webContents.executeJavaScript(`
              (() => {
                const el = document.querySelector('div[contenteditable="true"][data-testid="msh-chatinput-editor"]')
                        || document.querySelector('div.chat-input-editor[contenteditable="true"]')
                        || document.querySelector('div[contenteditable="true"][role="textbox"]')
                        || document.querySelector('div[contenteditable="true"]');
                const text = el ? String(el.innerText || el.textContent || '') : '';
                const fp = ${fpJson};
                const fingerprintGone = fp.length > 0 ? !text.includes(fp) : text.trim().length === 0;
                // Stop/abort button: Kimi shows a square stop icon while streaming.
                // Match by aria-label, testid, or any button labelled stop/abort/cancel.
                const stopBtn = document.querySelector(
                  '[data-testid*="stop" i], [data-testid*="abort" i],' +
                  ' [aria-label*="stop" i], [aria-label*="abort" i], [aria-label*="cancel" i],' +
                  ' [aria-label*="停止"], [aria-label*="取消"]'
                );
                return { fingerprintGone, hasStop: !!stopBtn };
              })()
            `).catch(() => null)
            if (state?.fingerprintGone || state?.hasStop) return true
          }
          return false
        }

        if (dbg.isAttached()) {
          // Strategy 1: trusted CDP mouse click on the send button
          if (probe.btnRect) {
            try {
              const { x, y } = probe.btnRect
              await dbg.sendCommand('Input.dispatchMouseEvent', {
                type: 'mouseMoved', x, y, button: 'none', clickCount: 0,
              })
              await dbg.sendCommand('Input.dispatchMouseEvent', {
                type: 'mousePressed', x, y, button: 'left', clickCount: 1,
              })
              await dbg.sendCommand('Input.dispatchMouseEvent', {
                type: 'mouseReleased', x, y, button: 'left', clickCount: 1,
              })
              if (await verifySubmitted()) {
                sendLog('info', '[clickSend] kimi: CDP mouse-click on send button succeeded')
                if (attached) { try { dbg.detach() } catch { /* ignore */ } }
                return true
              }
              sendLog('warn', '[clickSend] kimi: CDP mouse-click did not clear composer — trying Enter')
            } catch (e) {
              sendLog('warn', '[clickSend] kimi: CDP mouse-click failed: ' + (e instanceof Error ? e.message : String(e)))
            }
          } else {
            sendLog('info', '[clickSend] kimi: send button not located — falling back to Enter')
          }

          // Strategy 2: clean CDP Enter — NO text payload, otherwise Kimi
          // inserts a literal \r into the composer instead of submitting.
          await dbg.sendCommand('Input.dispatchKeyEvent', {
            type: 'keyDown',
            key: 'Enter',
            code: 'Enter',
            windowsVirtualKeyCode: 13,
            nativeVirtualKeyCode: 13,
          }).catch((e) => sendLog('warn', '[clickSend] kimi: CDP keyDown failed: ' + e.message))

          await dbg.sendCommand('Input.dispatchKeyEvent', {
            type: 'keyUp',
            key: 'Enter',
            code: 'Enter',
            windowsVirtualKeyCode: 13,
            nativeVirtualKeyCode: 13,
          }).catch((e) => sendLog('warn', '[clickSend] kimi: CDP keyUp failed: ' + e.message))

          if (await verifySubmitted()) {
            sendLog('info', '[clickSend] kimi: CDP Enter-key submission succeeded')
            if (attached) { try { dbg.detach() } catch { /* ignore */ } }
            return true
          }
          sendLog('warn', '[clickSend] kimi: CDP Enter left composer non-empty — falling through to heuristic')
        }
      }
    } catch (err) {
      sendLog('warn', '[clickSend] kimi CDP submit error: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      if (attached) {
        try { view.webContents.debugger.detach() } catch { /* ignore */ }
      }
    }
  }

  // Second attempt: DOM heuristic — works for DeepSeek-style composers where
  // the send button has no aria-label and shares a class (e.g. `ds-button`)
  // with adjacent toggle buttons (DeepThink, Search).  Strategy:
  //   1. Find the chat input element
  //   2. Walk up to the composer container
  //   3. Among button-like elements in the container, exclude any that have
  //      visible TEXT content (toggles like "DeepThink"/"Search" have labels;
  //      the send button is icon-only)
  //   4. Among the remaining icon-only candidates, pick the rightmost enabled one
  try {
    const heuristicResult = await view.webContents.executeJavaScript(`
      (() => {
        const input = document.querySelector('textarea, div[contenteditable="true"]');
        if (!input) return { ok: false, reason: 'no-input' };

        // Walk up to find the composer container
        let composer = input.parentElement;
        for (let i = 0; i < 8 && composer; i++) {
          const btnLike = composer.querySelectorAll('button, div[role="button"], div.ds-button');
          if (btnLike.length >= 2) break;  // Found a container with multiple controls — likely composer footer
          composer = composer.parentElement;
        }
        if (!composer) return { ok: false, reason: 'no-composer' };

        const candidates = composer.querySelectorAll('button, div[role="button"], div.ds-button');
        const iconOnly = [];
        const attachLabels = /attach|upload|file|clip|image|photo/i;
        for (const c of candidates) {
          if (c.disabled) continue;
          if (c.getAttribute('aria-disabled') === 'true') continue;
          // Skip attachment/upload buttons — clicking them opens a file dialog
          const ariaLabel = c.getAttribute('aria-label') || '';
          const title = c.getAttribute('title') || '';
          if (attachLabels.test(ariaLabel) || attachLabels.test(title)) continue;
          // Skip if this button has an associated <input type="file"> (either as
          // a child, sibling, or via a nearby hidden input — a strong sign it is
          // an upload trigger, not a send button).
          const hasFileInput = c.querySelector('input[type="file"]')
            || (c.nextElementSibling && c.nextElementSibling.matches && c.nextElementSibling.matches('input[type="file"]'))
            || (c.parentElement && c.parentElement.querySelector(':scope > input[type="file"]'));
          if (hasFileInput) continue;
          // Visible text content excludes toggles like DeepThink, Search
          const textLen = (c.innerText || '').trim().length;
          if (textLen > 2) continue;  // Allow tiny labels (e.g. "↑") but skip word-labeled toggles
          // Must contain an icon (svg or img) — the send button is icon-only
          if (!c.querySelector('svg, img')) continue;
          const rect = c.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;  // Hidden
          iconOnly.push({ el: c, x: rect.right });
        }
        if (iconOnly.length === 0) return { ok: false, reason: 'no-icon-only' };

        // Rightmost icon-only button is almost always Send
        iconOnly.sort((a, b) => b.x - a.x);
        const target = iconOnly[0].el;
        target.focus();
        target.click();
        return { ok: true, total: iconOnly.length, tag: target.tagName, cls: target.className };
      })()
    `)
    if (heuristicResult && heuristicResult.ok) {
      sendLog('info', '[clickSend] heuristic success: ' + JSON.stringify(heuristicResult))
      return true
    } else {
      sendLog('info', '[clickSend] heuristic failed: ' + JSON.stringify(heuristicResult))
    }
  } catch (err) {
    sendLog('warn', '[clickSend] heuristic error: ' + (err instanceof Error ? err.message : String(err)))
  }

  // Final fallback: Ultra-robust native input strategy
  // 1. Focus the webContents
  // 2. Click the input box natively to ensure active state
  // 3. Send native Enter key
  try {
    view.webContents.focus()
    const fallbackState = await view.webContents.executeJavaScript(`
      (() => {
        const inputEl = document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.isContentEditable
          ? document.activeElement
          : document.querySelector('textarea, div[contenteditable="true"]');
        if (inputEl) {
          inputEl.focus();
          const text = 'value' in inputEl
            ? String(inputEl.value || '')
            : String(inputEl.innerText || inputEl.textContent || '');
          const r = inputEl.getBoundingClientRect();
          return {
            x: r.x + r.width / 2,
            y: r.y + r.height / 2,
            hadText: text.trim().length > 0,
          };
        }
        return null;
      })()
    `)

    if (fallbackState?.x != null && fallbackState?.y != null && fallbackState?.hadText) {
      // Native click on the text area to ensure it has physical focus and defeats any transparent masks
      view.webContents.sendInputEvent({ type: 'mouseDown', x: Math.round(fallbackState.x), y: Math.round(fallbackState.y), button: 'left', clickCount: 1 })
      view.webContents.sendInputEvent({ type: 'mouseUp', x: Math.round(fallbackState.x), y: Math.round(fallbackState.y), button: 'left', clickCount: 1 })

      // Wait a tiny bit for UI state to catch up
      await new Promise(r => setTimeout(r, 50))

      // Native Enter Key (this is how 99% of chat apps send messages)
      view.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' })
      view.webContents.sendInputEvent({ type: 'char', keyCode: 'Return' })
      view.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Return' })

      await sleep(250)

      const postEnterState = await view.webContents.executeJavaScript(`
        (() => {
          const inputEl = document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.isContentEditable
            ? document.activeElement
            : document.querySelector('textarea, div[contenteditable="true"]');
          const text = inputEl
            ? ('value' in inputEl ? String(inputEl.value || '') : String(inputEl.innerText || inputEl.textContent || ''))
            : '';
          return { textLength: text.trim().length };
        })()
      `)

      if ((postEnterState?.textLength ?? 0) === 0) {
        return true
      }
    }

    return false
  } catch { /* ignore */ }
  return false
}

// ─── BrowserView Layout ───────────────────────────────────────────────────────
function computeViewBounds(indexInEnabled: number, totalEnabled: number, winWidth: number, winHeight: number): Rectangle {
  const attachH = attachmentBarVisible ? ATTACHMENT_BAR_HEIGHT : 0
  const finalH = finalPanelExpanded ? FINAL_PANEL_FULL_H : FINAL_PANEL_HEADER_H
  const gridTop = TITLEBAR_HEIGHT + TOOLBAR_HEIGHT + attachH + STATUS_BAR_HEIGHT + PANEL_HEADER_HEIGHT
  const gridHeight = winHeight - gridTop - finalH
  const availableWidth = Math.max(
    winWidth - (councilChatVisible ? COUNCIL_CHAT_PANEL_WIDTH : 0),
    320
  )
  const panelWidth = Math.floor(availableWidth / Math.max(totalEnabled, 1))
  return {
    x: indexInEnabled * panelWidth,
    y: gridTop,
    width: panelWidth,
    height: Math.max(gridHeight, 200),
  }
}

function updateViewBounds() {
  if (!mainWindow) return
  const [winWidth, winHeight] = mainWindow.getSize()
  let enabledIndex = 0
  AI_NAMES.forEach((name) => {
    const view = views.get(name)
    if (!view) return
    try {
      if (enabledAiNames.includes(name)) {
        try { mainWindow.addBrowserView(view) } catch { /* already added */ }
        view.setBounds(computeViewBounds(enabledIndex, enabledAiNames.length, winWidth, winHeight))
        enabledIndex++
      } else {
        try { mainWindow.removeBrowserView(view) } catch { /* already removed */ }
        view.setBounds({ x: -10000, y: 0, width: 100, height: 100 })
      }
    } catch {
      // view might be detached
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

    // Gemini and Grok benefit from a fuller Chrome-style renderer identity.
    // Grok has recently started treating the plain Electron BrowserView more
    // aggressively than a normal browser tab, so give it the same stronger
    // renderer spoofing we already use for Gemini.
    const needsChromeSpoof = name === 'gemini' || name === 'grok' || name === 'chatgpt'
    // ChatGPT / Perplexity: domain-gated OAuth preload.
    // Applies Chrome spoofing ONLY on Google/Microsoft/Apple OAuth pages so that
    // Google login works without breaking React/WebSocket on the AI sites themselves.
    const needsOAuthSpoof = name === 'chatgpt' || name === 'perplexity'
    // Grok previously used a locale-only preload. Now that it uses the full
    // Chrome spoof preload above, keep this off to avoid conflicting preload selection.
    const needsLocaleSpoof = false
    const view = new BrowserView({
      webPreferences: {
        preload: needsChromeSpoof ? CHROME_SPOOF_PRELOAD
          : needsOAuthSpoof ? OAUTH_GOOGLE_SPOOF_PRELOAD
            : needsLocaleSpoof ? EN_LOCALE_PRELOAD
              : undefined,
        // contextIsolation: false is required for MAIN world access —
        // apply only to views that use a preload that needs it.
        contextIsolation: !(needsChromeSpoof || needsOAuthSpoof || needsLocaleSpoof),
        nodeIntegration: false,
        partition: `persist:${name}`,           // separate sessions for login persistence
      },
    })

    // ── Spoof UA: Chrome desktop, not Electron (belt-and-suspenders) ──────────
    view.webContents.setUserAgent(DESKTOP_USER_AGENT)

    // ── Strip/replace sec-ch-ua client hints that expose Electron identity ────
    // Only applied to Gemini: Google checks these headers server-side even when
    // UA looks like Chrome. Other services (Claude, ChatGPT, Perplexity) do NOT
    // need this — modifying their API request headers causes "network error"
    // because the destination server (e.g. Anthropic) validates request integrity.
    if (needsChromeSpoof) {
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
    }

    // ChatGPT / Perplexity: spoof sec-ch-ua headers ONLY for Google/Microsoft/Apple
    // OAuth domains.  Google checks these server-side and blocks Electron identity.
    // We limit the scope to OAuth URLs so that the AI sites' own API requests are
    // untouched (modifying those causes "network error" on ChatGPT/Perplexity).
    if (name === 'chatgpt' || name === 'perplexity') {
      const OAUTH_URL_PATTERNS = [
        '*://*.google.com/*',
        '*://*.googleapis.com/*',
        '*://*.microsoftonline.com/*',
        '*://*.live.com/*',
        '*://*.appleid.apple.com/*',
        '*://*.apple.com/*',
      ]
      ses.webRequest.onBeforeSendHeaders({ urls: OAUTH_URL_PATTERNS }, (details, callback) => {
        const headers: Record<string, string> = {}
        const SKIP_KEYS = new Set([
          'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform',
          'sec-ch-ua-full-version-list', 'user-agent', 'x-client-data',
        ])
        for (const [key, value] of Object.entries(details.requestHeaders)) {
          if (!SKIP_KEYS.has(key.toLowerCase())) headers[key] = value as string
        }
        Object.assign(headers, CHROME_CLIENT_HINTS)
        headers['user-agent'] = DESKTOP_USER_AGENT
        callback({ requestHeaders: headers })
      })
    }

    // Force English locale and Chrome-like request hints for Grok.
    // This narrows the gap between the embedded BrowserView and a regular
    // Chrome/Edge tab, which helps avoid Grok serving the degraded
    // "under heavy usage / try SuperGrok" experience to the app only.
    if (name === 'grok') {
      view.webContents.session.webRequest.onBeforeSendHeaders(
        { urls: ['*://grok.com/*', '*://*.grok.com/*', '*://x.com/*', '*://*.x.com/*'] },
        (details, callback) => {
          const headers: Record<string, string> = {}
          const SKIP_KEYS = new Set([
            'sec-ch-ua',
            'sec-ch-ua-mobile',
            'sec-ch-ua-platform',
            'sec-ch-ua-full-version-list',
            'user-agent',
            'x-client-data',
            'accept-language',
          ])
          for (const [key, value] of Object.entries(details.requestHeaders)) {
            if (!SKIP_KEYS.has(key.toLowerCase())) {
              headers[key] = value as string
            }
          }
          Object.assign(headers, CHROME_CLIENT_HINTS)
          headers['user-agent'] = DESKTOP_USER_AGENT
          headers['Accept-Language'] = 'en-US,en;q=0.9'
          callback({ requestHeaders: headers })
        }
      )
    }

    const enabledIndex = enabledAiNames.indexOf(name)
    if (enabledIndex !== -1) {
      mainWindow.addBrowserView(view)
      const [winWidth, winHeight] = mainWindow.getSize()
      view.setBounds(computeViewBounds(enabledIndex, enabledAiNames.length, winWidth, winHeight))
    } else {
      view.setBounds({ x: -10000, y: 0, width: 100, height: 100 })
    }
    view.setAutoResize({ width: false, height: false, horizontal: false, vertical: false })

    views.set(name, view)

    // ── ChatGPT / Perplexity: intercept Google OAuth navigations ─────────────
    // When the user clicks "Continue with Google" inside the BrowserView,
    // Chromium navigates the view itself to accounts.google.com.  An embedded
    // BrowserView is treated as a webview by Google's anti-bot checks even with
    // full UA/header spoofing, so login is blocked.
    // Fix: cancel the in-view navigation and re-open the URL in a proper
    // BrowserWindow (with full Chrome spoof preload) so Google sees it as a
    // normal browser window — identical to how chatgpt-login.mjs works.
    if (name === 'chatgpt' || name === 'perplexity' || name === 'deepseek') {
      const GOOGLE_OAUTH_RE = /^https?:\/\/(accounts\.google\.com|oauth2\.googleapis\.com|accounts\.youtube\.com|login\.microsoftonline\.com|login\.live\.com|appleid\.apple\.com)/

      view.webContents.on('will-navigate', (event, url) => {
        if (!GOOGLE_OAUTH_RE.test(url)) return
        event.preventDefault()   // stop the BrowserView from navigating to Google

        const popup = new BrowserWindow({
          width: 520,
          height: 680,
          title: 'Sign in',
          parent: mainWindow ?? undefined,
          webPreferences: {
            partition: `persist:${name}`,
            preload: CHROME_SPOOF_PRELOAD,   // full spoof — Google needs this
            contextIsolation: false,
            nodeIntegration: false,
          },
        })
        popup.setMenuBarVisibility(false)
        popup.webContents.setUserAgent(DESKTOP_USER_AGENT)
        popup.loadURL(url, { userAgent: DESKTOP_USER_AGENT })

        // When the OAuth flow redirects back to the AI site, close the popup
        // and reload the BrowserView so it picks up the new session cookies.
        const AI_RETURN_RE = name === 'chatgpt'
          ? /^https?:\/\/(chatgpt\.com|openai\.com|auth\.openai\.com)/
          : name === 'deepseek'
          ? /^https?:\/\/(chat\.deepseek\.com|deepseek\.com)/
          : /^https?:\/\/(perplexity\.ai|[^/]*\.perplexity\.ai)/
        let oauthDone = false
        const reloadHomeView = () => {
          if (oauthDone) return
          oauthDone = true
          if (!popup.isDestroyed()) popup.destroy()
          const v = views.get(name)
          if (v && !v.webContents.isDestroyed()) {
            const homeUrl = getSelectors(name).url
            v.webContents.once('did-finish-load', () =>
              mainWindow?.webContents.send('login-status-changed'))
            v.webContents.loadURL(homeUrl, { userAgent: DESKTOP_USER_AGENT }).catch((err) => {
              const message = err instanceof Error ? err.message : String(err)
              if (!message.includes('ERR_ABORTED')) {
                sendLog('warn', `[oauth-return:${name}] loadURL failed: ${message}`)
              }
              mainWindow?.webContents.send('login-status-changed')
            })
          } else {
            mainWindow?.webContents.send('login-status-changed')
          }
        }
        popup.webContents.on('will-navigate', (_e2, redirectUrl) => {
          if (AI_RETURN_RE.test(redirectUrl)) reloadHomeView()
        })
        popup.webContents.on('did-navigate', (_e2, redirectUrl) => {
          if (AI_RETURN_RE.test(redirectUrl)) reloadHomeView()
        })
        popup.on('closed', () => mainWindow?.webContents.send('login-status-changed'))
      })
    }

    
    if (name === 'deepseek') {
      view.webContents.on('did-finish-load', () => {
        // DeepSeek defaults to open sidebar or mobile overlay on narrow screens, obscuring the input.
        view.webContents.executeJavaScript(`
          const hideDeepSeekSidebar = () => {
            // 1. Hide generic <aside> which is typically the sidebar
            document.querySelectorAll('aside').forEach(a => { a.style.display = 'none'; });
            // 2. Hide overlay masks that appear in mobile mode
            const masks = document.querySelectorAll('div[class*="mask"], div[class*="overlay"]');
            masks.forEach(m => { m.style.display = 'none'; m.style.pointerEvents = 'none'; });
            // 3. "New chat" parent-walk heuristic — DANGEROUS on narrow BrowserViews
            //    because the width range overlaps with the main chat container
            //    when 6 AIs share the window width. Guard rails:
            //    a) Skip entirely until the chat input is rendered.
            //    b) Never hide an ancestor that contains the chat input.
            //    c) Candidate must be positioned to the LEFT of the chat input
            //       (real sidebars are; the main chat container is not).
            const input = document.querySelector('#chat-input, textarea, div[contenteditable="true"][role="textbox"]');
            if (!input) return;
            const inputRect = input.getBoundingClientRect();
            if (inputRect.width === 0 && inputRect.height === 0) return;
            const btns = Array.from(document.querySelectorAll('div, button, a'))
              .filter(e => e.textContent && e.textContent.trim() === 'New chat');
            for (const btn of btns) {
              let p = btn.parentElement;
              for (let i = 0; i < 5; i++) {
                if (!p) break;
                if (p.contains(input)) break;
                const rect = p.getBoundingClientRect();
                const isLeftSidebar = rect.right <= inputRect.left + 2 && rect.left <= 8;
                if (
                  isLeftSidebar &&
                  rect.width > 100 && rect.width < 400 &&
                  rect.height > window.innerHeight * 0.5
                ) {
                  p.style.display = 'none';
                  break;
                }
                p = p.parentElement;
              }
            }
          };
          hideDeepSeekSidebar();
          setTimeout(hideDeepSeekSidebar, 1000);
          setTimeout(hideDeepSeekSidebar, 2000);
          setTimeout(hideDeepSeekSidebar, 4000);
        `).catch(() => {})
      })
    }

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
            void loadURLSafe(
              view.webContents,
              'https://accounts.google.com/signin',
              'gemini-502-redirect',
              { userAgent: DESKTOP_USER_AGENT },
            )
            return
          }
        } catch (err) {
          sendLog('warn', `[gemini] 502 probe failed: ${err instanceof Error ? err.message : String(err)}`)
        }
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
          void loadURLSafe(
            view.webContents,
            'https://gemini.google.com',
            'gemini-post-login',
            { userAgent: DESKTOP_USER_AGENT },
          )
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

// ── API Keys: get / set ───────────────────────────────────────────────────────
ipcMain.handle('get-api-keys', () => {
  return store.get('apiKeys') as StoreSchema['apiKeys']
})

ipcMain.handle('set-api-keys', (_e, keys: Partial<Record<AiName, string>> & { deepseek?: string }) => {
  // Trim whitespace and remove empty strings so store stays clean
  const cleaned: Record<string, string> = {}
  for (const [k, v] of Object.entries(keys)) {
    const trimmed = (v ?? '').trim()
    if (trimmed) cleaned[k] = trimmed
  }
  store.set('apiKeys', cleaned)
  return true
})

// ── API Key Order: get / set ──────────────────────────────────────────────────
ipcMain.handle('get-api-key-order', () => {
  return store.get('apiKeyOrder') as string[]
})

ipcMain.handle('set-api-key-order', (_e, order: string[]) => {
  store.set('apiKeyOrder', order)
  return true
})

// ── Real-time query analysis → Primary AI recommendation ──────────────────────
ipcMain.handle('analyze-query', async (_e, query: string) => {
  if (!query || query.trim().length < 5) return null
  try {
    const result = await analyzeQueryForPrimaryAi(query.trim())
    return result
  } catch (err) {
    sendLog('warn', `[analyze-query] ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
})

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

// ─── Accounts: Login / Logout / Status ───────────────────────────────────────

/**
 * Cookie domains to copy from the temp login session → main session per AI.
 * Using a separate "login:" partition during login prevents the Chrome header
 * spoof from interfering with the main AI panel's API connections.
 */
const LOGIN_COPY_DOMAINS: Record<AiName, string[]> = {
  gemini: ['.google.com', 'accounts.google.com'],
  claude: ['claude.ai', '.claude.ai'],
  chatgpt: ['.chatgpt.com', '.openai.com', 'auth.openai.com'],
  grok: ['.grok.com', 'grok.com', '.x.com', 'x.com', '.twitter.com', 'twitter.com'],
  deepseek: ['.deepseek.com', 'deepseek.com', 'chat.deepseek.com'],
  perplexity: ['.perplexity.ai'],
  kimi: ['.kimi.com', 'kimi.com', '.moonshot.cn', 'moonshot.cn'],
}

const LOGIN_START_URLS: Record<AiName, string> = {
  gemini: 'https://accounts.google.com/signin',
  claude: 'https://claude.ai/login',
  chatgpt: 'https://chatgpt.com/auth/login',
  grok: 'https://grok.com',
  deepseek: 'https://chat.deepseek.com',
  perplexity: 'https://www.perplexity.ai',
  kimi: 'https://kimi.com',
}

const LOGIN_TITLES = {
  gemini: 'Google Login — Gemini (AI Council)',
  claude: 'Claude Login — AI Council',
  chatgpt: 'ChatGPT Login — AI Council',
  perplexity: 'Perplexity Login — AI Council',
  grok: 'Grok Login — AI Council',
} as Record<AiName, string>
LOGIN_TITLES.deepseek = 'DeepSeek Login - AI Council'
LOGIN_TITLES.kimi = 'Kimi Login - AI Council'

/** Check whether the login session already has valid session cookies.
 *  Uses loginSes.cookies.get({}) (no domain filter) to catch cookies set on
 *  subdomains like www.perplexity.ai that a domain-filtered query would miss. */
async function isLoginComplete(aiName: AiName, loginSes: Electron.Session, url: string): Promise<boolean> {
  // Get ALL cookies in the temp session — avoids subdomain / exact-domain mismatches
  const all = await loginSes.cookies.get({})

  if (aiName === 'gemini') {
    return all.some((c) =>
      (c.domain.includes('google.com')) &&
      (c.name === 'SID' || c.name === '__Secure-1PSID')
    )
  }
  if (aiName === 'claude') {
    if (!url.startsWith('https://claude.ai') || url.includes('/login') || url.includes('/oauth')) return false
    const claudeCookies = all.filter((c) => c.domain.includes('claude.ai') || c.domain.includes('anthropic.com'))
    return claudeCookies.length > 0
  }
  if (aiName === 'chatgpt') {
    const relevant = all.filter((c) => c.domain.includes('chatgpt.com') || c.domain.includes('openai.com'))
    return relevant.length >= 3 &&
      relevant.some((c) => c.name.includes('session') || c.name.includes('token') || c.name === '__cf_bm')
  }
  if (aiName === 'perplexity') {
    const relevant = all.filter((c) => c.domain.includes('perplexity.ai'))
    return relevant.length >= 3 &&
      relevant.some((c) => c.name.includes('session') || c.name.includes('token') || c.name.startsWith('pplx'))
  }
  if (aiName === 'grok') {
    // Grok must complete its own SSO handshake on grok.com.
    // X auth cookies alone are too early: they can appear before grok.com
    // finishes establishing the actual product session, which makes the app
    // look "logged in" while the panel still behaves like a degraded visitor.
    const grokCookies = all.filter((c) => c.domain.includes('grok.com'))
    const hasGrokSSO = grokCookies.some((c) => c.name === 'sso' || c.name === 'sso-rw')
    return hasGrokSSO
  }
  if (aiName === 'deepseek') {
    const deepseekCookies = all.filter((c) => c.domain.includes('deepseek.com'))
    return deepseekCookies.some((c) =>
      c.name.toLowerCase().includes('session') || c.name.toLowerCase().includes('token') || c.name.toLowerCase().includes('user')
    )
  }
  if (aiName === 'kimi') {
    const kimiCookies = all.filter((c) => c.domain.includes('kimi.com') || c.domain.includes('moonshot.cn'))
    return kimiCookies.some((c) =>
      c.name.toLowerCase().includes('session') ||
      c.name.toLowerCase().includes('token') ||
      c.name.toLowerCase().includes('access') ||
      c.name.toLowerCase().includes('refresh') ||
      c.name.toLowerCase().includes('user')
    )
  }
  return false
}

/** Copy ALL cookies from the temp login session into the main persist session.
 *  Getting all cookies (no domain filter) avoids missing cookies set on
 *  subdomains (e.g. www.perplexity.ai vs .perplexity.ai). */
async function copyCookiesToMainSession(aiName: AiName, loginSes: Electron.Session): Promise<void> {
  const mainSes = session.fromPartition(`persist:${aiName}`)
  const allowedDomains = LOGIN_COPY_DOMAINS[aiName]

  // Fetch every cookie in the temp session without any domain filter
  const allCookies = await loginSes.cookies.get({})

  // Keep only cookies whose domain matches the AI's relevant domains
  const toCopy = allCookies.filter((c) =>
    allowedDomains.some((d) => c.domain.includes(d.replace(/^\./, '')))
  )

  for (const cookie of toCopy) {
    const protocol = cookie.secure ? 'https' : 'http'
    const host = cookie.domain.replace(/^\./, '')
    const url = `${protocol}://${host}${cookie.path || '/'}`
    try {
      await mainSes.cookies.set({
        url,
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        expirationDate: cookie.expirationDate,
        sameSite: cookie.sameSite as ('unspecified' | 'no_restriction' | 'lax' | 'strict') | undefined,
      })
    } catch { /* some cookies (e.g. httpOnly from other origins) may be rejected — ignore */ }
  }
  await mainSes.cookies.flushStore()
  sendLog('info', `[login] Copied ${toCopy.length} cookies to persist:${aiName}`)
}

/** Open a floating login window for the given AI using an isolated temp session */
function openLoginWindow(aiName: AiName): void {
  const loginPartition = `login:${aiName}`   // isolated — never affects persist:${aiName}
  const loginSes = session.fromPartition(loginPartition)
  loginSes.setUserAgent(DESKTOP_USER_AGENT)

  // Full Chrome spoof on the temp session — safe because it's isolated.
  // For Grok: also force Accept-Language to English so the X.com login page
  // and grok.com are displayed in English regardless of system locale.
  loginSes.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, (details, callback) => {
    const headers: Record<string, string> = {}
    const SKIP = new Set([
      'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform',
      'sec-ch-ua-full-version-list', 'user-agent', 'x-client-data',
    ])
    for (const [k, v] of Object.entries(details.requestHeaders)) {
      if (!SKIP.has(k.toLowerCase())) headers[k] = v as string
    }
    headers['user-agent'] = DESKTOP_USER_AGENT
    headers['sec-ch-ua'] = `"Chromium";v="${_CHROME_MAJOR}", "Google Chrome";v="${_CHROME_MAJOR}", "Not-A.Brand";v="24"`
    headers['sec-ch-ua-mobile'] = '?0'
    headers['sec-ch-ua-platform'] = '"Windows"'
    headers['sec-ch-ua-full-version-list'] = `"Chromium";v="${_CHROME_FULL}", "Google Chrome";v="${_CHROME_FULL}", "Not-A.Brand";v="24.0.0.0"`
    // Force English locale for Grok login window (covers grok.com + x.com pages)
    if (aiName === 'grok') {
      headers['Accept-Language'] = 'en-US,en;q=0.9'
    }
    callback({ requestHeaders: headers })
  })

  // Grok login window: use the locale-only preload so both grok.com and the
  // X.com sign-in page display in English.  Chrome-spoof preload is still
  // safe here (isolated session) but not needed for Grok, so prefer the
  // lighter locale preload to avoid any risk of patching X.com globals.
  const loginPreload = aiName === 'grok' ? EN_LOCALE_PRELOAD : CHROME_SPOOF_PRELOAD
  const loginWin = new BrowserWindow({
    width: 520,
    height: 720,
    title: LOGIN_TITLES[aiName],
    parent: mainWindow ?? undefined,
    webPreferences: {
      partition: loginPartition,
      preload: loginPreload,
      contextIsolation: false,
      nodeIntegration: false,
    },
  })
  loginWin.setMenuBarVisibility(false)
  loginWin.webContents.setUserAgent(DESKTOP_USER_AGENT)

  // Allow OAuth popups with same spoof applied
  loginWin.webContents.setWindowOpenHandler(({ url: popupUrl }) => {
    try {
      const hostname = new URL(popupUrl).hostname.replace(/^www\./, '')
      const ok = OAUTH_ALLOWED_DOMAINS.some((d) => hostname === d || hostname.endsWith('.' + d))
      if (!ok) return { action: 'deny' }
    } catch { return { action: 'deny' } }
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 500, height: 660,
        title: 'Sign in',
        webPreferences: { partition: loginPartition, preload: loginPreload, contextIsolation: false, nodeIntegration: false },
      },
    }
  })

  // 6-second grace period so pre-existing cookies don't trigger instant close
  const START = Date.now()
  const GRACE = 6_000
  let done = false

  const checkLogin = async (url: string) => {
    if (done) return
    if (Date.now() - START < GRACE) return
    const ok = await isLoginComplete(aiName, loginSes, url)
    if (!ok) return
    done = true

    // Copy cookies from temp session → main session
    await copyCookiesToMainSession(aiName, loginSes)

    // Reload the main AI panel
    const view = views.get(aiName)
    if (view) {
      const aiConfig = getSelectors(aiName)
      const reloadUrl = aiName === 'gemini' ? 'https://gemini.google.com' : aiConfig.newChatUrl
      void loadURLSafe(view.webContents, reloadUrl, `login-reload:${aiName}`, { userAgent: DESKTOP_USER_AGENT })
    }

    // Tell renderer to refresh login status display
    mainWindow?.webContents.send('login-status-changed')

    loginWin.setTitle('Login complete — closing in 3 s')
    loginWin.webContents.executeJavaScript(
      'document.body.style.cssText="margin:0";' +
      'document.body.innerHTML=\'<div style="font-family:sans-serif;text-align:center;padding:60px 30px;background:#0d0d1a;color:#e8e8f0">\' +' +
      '\'<div style="font-size:56px">&#x2705;</div>\' +' +
      '\'<h2 style="color:#6c63ff;margin:16px 0">Login complete!</h2>\' +' +
      '\'<p style="color:#9898b0">AI Council panel will reload automatically.</p>\' +' +
      '\'<p style="color:#5a5a78;font-size:12px;margin-top:20px">Closing in 3 seconds...</p>\' +' +
      '\'</div>\''
    ).catch(() => { })
    setTimeout(() => { if (!loginWin.isDestroyed()) loginWin.close() }, 3000)
  }

  // Listen on multiple events to catch all navigation types:
  // did-navigate      — full page navigation
  // did-finish-load   — page fully loaded (catches SPA post-login redirects)
  // did-navigate-in-page — hash / pushState navigation (SPA internal routing)
  const attachNavigationListeners = (wc: Electron.WebContents) => {
    wc.on('did-navigate', (_e, url) => checkLogin(url))
    wc.on('did-finish-load', () => checkLogin(wc.getURL()))
    wc.on('did-navigate-in-page', (_e, url) => checkLogin(url))
  }
  attachNavigationListeners(loginWin.webContents)

  loginWin.webContents.on('did-create-window', (popup) => {
    popup.setMenuBarVisibility(false)
    popup.webContents.setUserAgent(DESKTOP_USER_AGENT)
    attachNavigationListeners(popup.webContents)
  })

  loginWin.loadURL(LOGIN_START_URLS[aiName], { userAgent: DESKTOP_USER_AGENT })
  loginWin.on('closed', async () => {
    // Clean up the temp login session
    try { await loginSes.clearStorageData() } catch { /* ignore */ }
  })
}

/** Return login status for all 4 AIs based on their persist session cookies.
 *  Uses cookies.get({}) (no domain filter) to avoid missing cookies set on
 *  subdomains like www.chatgpt.com or www.perplexity.ai. */
async function getLoginStatus(): Promise<Record<AiName, boolean>> {
  const [geminiAll, claudeAll, chatgptAll, perplexityAll, grokAll, deepseekAll] = await Promise.all([
    session.fromPartition('persist:gemini').cookies.get({}),
    session.fromPartition('persist:claude').cookies.get({}),
    session.fromPartition('persist:chatgpt').cookies.get({}),
    session.fromPartition('persist:perplexity').cookies.get({}),
    session.fromPartition('persist:grok').cookies.get({}),
    session.fromPartition('persist:deepseek').cookies.get({}),
  ])

  const geminiC = geminiAll.filter((c) => c.domain.includes('google.com'))
  const claudeC = claudeAll.filter((c) => c.domain.includes('claude.ai') || c.domain.includes('anthropic.com'))
  const chatgptC = chatgptAll.filter((c) => c.domain.includes('chatgpt.com') || c.domain.includes('openai.com'))
  const perplexityC = perplexityAll.filter((c) => c.domain.includes('perplexity.ai'))
  const grokSiteC = grokAll.filter((c) => c.domain.includes('grok.com'))
  const deepseekC = deepseekAll.filter((c) => c.domain.includes('deepseek.com'))
  const grokHasSSO = grokSiteC.some((c) => c.name === 'sso' || c.name === 'sso-rw')
  const deepseekLoggedIn = deepseekC.some((c) =>
    c.name.toLowerCase().includes('session') || c.name.toLowerCase().includes('token') || c.name.toLowerCase().includes('user')
  )

  // ── ChatGPT ──────────────────────────────────────────────────────────────
  // Cookie-based detection is unreliable: every cookie on chatgpt.com /
  // openai.com is present in the anonymous state too.
  // URL-based detection also broke: ChatGPT now shows chatgpt.com/ with a
  // "Log in" button even when the user is NOT logged in (no auth redirect).
  //
  // Most reliable signal: DOM check.  When NOT logged in, the page contains
  // <a href="/auth/login">.  When logged in that link is absent.
  // We fall back to false if the view is unavailable or still loading.
  const chatgptView = views.get('chatgpt')
  let chatgptLoggedIn = false
  if (chatgptView && !chatgptView.webContents.isDestroyed()) {
    const chatgptUrl = chatgptView.webContents.getURL()
    if (chatgptUrl.startsWith('https://chatgpt.com/') && !chatgptUrl.includes('/auth/')) {
      try {
        chatgptLoggedIn = await Promise.race<boolean>([
          chatgptView.webContents.executeJavaScript(`
            (function() {
              if (document.readyState !== 'complete') return false
              // Presence of a login link means NOT logged in
              const loginLink = document.querySelector('a[href="/auth/login"]')
              return !loginLink
            })()
          `),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000)),
        ])
      } catch { chatgptLoggedIn = false }
    }
  }

  // ── Perplexity ────────────────────────────────────────────────────────────
  // Cookie dump confirms: pplx.visitor-id / pplx.metadata / pplx.edge-* are
  // set on first anonymous visit.  __Secure-next-auth.session-token is written
  // by next-auth only upon a *completed* sign-in (never for anonymous users).
  const perplexityLoggedIn = perplexityC.some((c) =>
    c.name === '__Secure-next-auth.session-token'
  )

  return {
    gemini: geminiC.some((c) => c.name === 'SID' || c.name === '__Secure-1PSID'),
    claude: claudeC.length > 0,
    chatgpt: chatgptLoggedIn,
    grok: grokHasSSO,
    deepseek: deepseekLoggedIn,
    perplexity: perplexityLoggedIn,
  }
}

/** Clear all session data for one AI and reload its panel */
async function logoutAi(aiName: AiName): Promise<void> {
  const ses = session.fromPartition(`persist:${aiName}`)
  await ses.clearStorageData()
  await ses.cookies.flushStore()

  const view = views.get(aiName)
  if (view && !view.webContents.isDestroyed()) {
    const loginUrl = aiName === 'gemini'
      ? 'https://accounts.google.com/signin'
      : getSelectors(aiName).url

    if (aiName === 'chatgpt') {
      // ChatGPT login detection is now DOM-based (checks for the login link).
      // We must wait for the page to finish loading so the DOM is ready before
      // login-status-changed triggers the check.
      await new Promise<void>((resolve) => {
        let done = false
        const finish = () => { if (!done) { done = true; resolve() } }
        const tid = setTimeout(finish, 5000)   // safety fallback
        view.webContents.once('did-finish-load', () => { clearTimeout(tid); finish() })
        view.webContents.loadURL(loginUrl, { userAgent: DESKTOP_USER_AGENT }).catch(finish)
      })
    } else {
      void loadURLSafe(view.webContents, loginUrl, `login-nav:${aiName}`, { userAgent: DESKTOP_USER_AGENT })
    }
  }
  mainWindow?.webContents.send('login-status-changed')
}

// ── Accounts IPC handlers ─────────────────────────────────────────────────────
ipcMain.handle('get-login-status', () => getLoginStatus())

const STANDALONE_LOGIN_SCRIPTS: Partial<Record<AiName, string>> = {
  gemini: 'google-login.mjs',
  claude: 'claude-login.mjs',
  chatgpt: 'chatgpt-login.mjs',
  grok: 'grok-login.mjs',
  deepseek: 'deepseek-login.mjs',
  perplexity: 'perplexity-login.mjs',
  kimi: 'kimi-login.mjs',
}

ipcMain.handle('open-login-window', (_e, aiName: AiName) => {
  if (!AI_NAMES.includes(aiName)) return false

  // Standalone login scripts avoid parent-window WebAuthn/passkey interference.
  const standaloneScript = STANDALONE_LOGIN_SCRIPTS[aiName]
  if (standaloneScript) {
    const script = path.join(app.getAppPath(), standaloneScript)
    // Pass our userData path via env so the spawned Electron process uses the
    // same persist:* session directories as the main app.  Without this the
    // child uses its own default userData ("Electron") and cookies are never
    // shared back to the main app.
    const child = spawn(process.execPath, [script], {
      detached: false,
      stdio: ['ignore', 'pipe', 'ignore'],   // capture stdout for cookie transfer
      env: { ...process.env, AI_COUNCIL_USERDATA: app.getPath('userData') },
    })
    let stdoutData = ''
    child.stdout?.on('data', (chunk: Buffer) => { stdoutData += chunk.toString() })
    child.on('close', async () => {
      // Import cookies output by the login script directly into our in-memory
      // session cache.  Chromium's cookie store is process-local — writing to
      // SQLite in the child does NOT update the parent's cache, so we must call
      // ses.cookies.set() here to make the cookies visible to the BrowserView.
      try {
        const cookieJson = stdoutData
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find((line) => line.startsWith('[') && line.endsWith(']'))
        if (!cookieJson) throw new Error('No cookie JSON emitted')
        const cookieList: Electron.Cookie[] = JSON.parse(cookieJson)
        const ses = session.fromPartition(`persist:${aiName}`)
        for (const c of cookieList) {
          const protocol = c.secure ? 'https' : 'http'
          const host = (c.domain ?? '').replace(/^\./, '')
          if (!host) continue
          await ses.cookies.set({
            url: `${protocol}://${host}${c.path ?? '/'}`,
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path,
            secure: c.secure,
            httpOnly: c.httpOnly,
            expirationDate: c.expirationDate,
            sameSite: c.sameSite as any,
          }).catch((err) => {
            sendLog('warn', `[${aiName}] cookie import failed for ${c.name}: ${err instanceof Error ? err.message : String(err)}`)
          })
        }
        await ses.cookies.flushStore()
      } catch (err) {
        sendLog('warn', `[${aiName}] login cookie import failed: ${err instanceof Error ? err.message : String(err)}`)
      }

      // Reload the BrowserView so it navigates with the newly imported cookies.
      const view = views.get(aiName)
      if (view && !view.webContents.isDestroyed()) {
        const url = getSelectors(aiName).url
        view.webContents.once('did-finish-load', () => {
          mainWindow?.webContents.send('login-status-changed')
        })
        view.webContents.loadURL(url, { userAgent: DESKTOP_USER_AGENT }).catch((err) => {
          const message = err instanceof Error ? err.message : String(err)
          if (!message.includes('ERR_ABORTED')) {
            sendLog('warn', `[post-login-reload:${aiName}] loadURL failed: ${message}`)
          }
          mainWindow?.webContents.send('login-status-changed')
        })
      } else {
        mainWindow?.webContents.send('login-status-changed')
      }
    })
    return true
  }

  openLoginWindow(aiName)
  return true
})

ipcMain.handle('logout-ai', async (_e, aiName: AiName) => {
  if (!AI_NAMES.includes(aiName)) return false
  await logoutAi(aiName)
  return true
})

ipcMain.handle('logout-all', async () => {
  for (const ai of AI_NAMES) await logoutAi(ai)
  return true
})

// ── Enabled AI panels → update BrowserView layout ────────────────────────────
ipcMain.handle('set-enabled-ais', (_e, ais: AiName[]) => {
  if (!Array.isArray(ais) || ais.length === 0) return false
  enabledAiNames = ais.filter((n) => AI_NAMES.includes(n))
  if (enabledAiNames.length === 0) enabledAiNames = [...DEFAULT_ENABLED_AI_NAMES]
  updateViewBounds()
  return true
})

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

ipcMain.handle('set-council-chat-visible', (_e, visible: boolean) => {
  councilChatVisible = !!visible
  updateViewBounds()
})

ipcMain.handle('switch-interaction-mode', (_e, payload: { mode: InteractionMode; participants: AiName[]; primaryAi: AiName }) => {
  return handoffInteractionMode(payload.mode, payload.participants, payload.primaryAi)
})

ipcMain.handle('get-council-room', () => {
  if (councilRoom.messages.length === 0) {
    return resetCouncilRoomContext(councilRoom.participants, councilRoom.primaryAi)
  }
  return cloneCouncilRoomState()
})

ipcMain.handle('get-council-ui-state', () => {
  return sanitizeCouncilUiState(store.get('councilUiState'))
})

ipcMain.handle('set-council-ui-state', (_e, payload?: Partial<CouncilUiState>) => {
  const nextState = sanitizeCouncilUiState(payload)
  store.set('councilUiState', nextState)
  return nextState
})

ipcMain.handle('get-council-snapshots', () => {
  return summarizeCouncilSnapshots(getCouncilSnapshots())
})

ipcMain.handle('save-council-snapshot', (_e, payload?: {
  room?: CouncilRoomState
  uiState?: CouncilUiState
  title?: string
  insight?: Partial<CouncilSnapshotInsight>
}) => {
  const baseRoom = loadPersistedCouncilRoomFromSnapshot(payload?.room ?? councilRoom)
  const roomState: CouncilRoomState = {
    participants: [...baseRoom.participants],
    primaryAi: baseRoom.primaryAi,
    status: 'idle',
    pendingAi: null,
    messages: baseRoom.messages.map((message) => ({ ...message, pending: false })),
    lastIntent: baseRoom.lastIntent ? { ...baseRoom.lastIntent } : null,
    failedTurn: baseRoom.failedTurn ? { ...baseRoom.failedTurn } : null,
  }
  const uiState = sanitizeCouncilUiState(payload?.uiState)
  const insight = sanitizeCouncilSnapshotInsight(payload?.insight)
  const snapshots = getCouncilSnapshots()
  const activeSnapshotId = getActiveCouncilSnapshotId()
  const existingActiveSnapshot = activeSnapshotId
    ? snapshots.find((snapshot) => snapshot.id === activeSnapshotId)
    : null
  const nextSnapshot: CouncilSnapshotRecord = sanitizeCouncilSnapshotRecord({
    id: existingActiveSnapshot?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: typeof payload?.title === 'string' && payload.title.trim().length > 0
      ? payload.title.trim()
      : existingActiveSnapshot?.title ?? defaultCouncilSnapshotTitle(roomState),
    label: existingActiveSnapshot?.label ?? null,
    note: existingActiveSnapshot?.note ?? null,
    savedAt: Date.now(),
    lastOpenedAt: existingActiveSnapshot?.lastOpenedAt ?? Date.now(),
    messageCount: roomState.messages.length,
    isFavorite: existingActiveSnapshot?.isFavorite ?? false,
    isArchived: existingActiveSnapshot?.isArchived ?? false,
    lifecycle: existingActiveSnapshot?.lifecycle ?? 'in-progress',
    room: roomState,
    uiState,
    insight,
  })
  const nextSnapshots = existingActiveSnapshot
    ? [nextSnapshot, ...snapshots.filter((snapshot) => snapshot.id !== existingActiveSnapshot.id)].slice(0, 24)
    : [nextSnapshot, ...snapshots].slice(0, 24)
  persistCouncilSnapshots(nextSnapshots)
  setActiveCouncilSnapshotId(nextSnapshot.id)
  return summarizeCouncilSnapshots(getCouncilSnapshots())
})

ipcMain.handle('load-council-snapshot', (_e, snapshotId: string) => {
  const snapshots = getCouncilSnapshots()
  const snapshot = snapshots.find((item) => item.id === snapshotId)
  if (!snapshot) return null

  const nextSnapshots = snapshots.map((item) =>
    item.id === snapshotId
      ? sanitizeCouncilSnapshotRecord({
          ...item,
          lastOpenedAt: Date.now(),
        })
      : item
  )
  persistCouncilSnapshots(nextSnapshots)
  const hydratedSnapshot = nextSnapshots.find((item) => item.id === snapshotId) ?? snapshot

  const runtime = loadPersistedCouncilRoomFromSnapshot(hydratedSnapshot.room)
  councilRoom = runtime
  enabledAiNames = [...runtime.participants]
  setActiveCouncilSnapshotId(hydratedSnapshot.id)
  store.set('councilRoomSnapshot', cloneCouncilRoomState())
  store.set('councilUiState', sanitizeCouncilUiState(hydratedSnapshot.uiState))
  updateViewBounds()
  emitCouncilRoomUpdate()

  return {
    room: cloneCouncilRoomState(),
    uiState: sanitizeCouncilUiState(hydratedSnapshot.uiState),
  }
})

ipcMain.handle('rename-council-snapshot', (_e, snapshotId: string, title: string) => {
  const normalizedTitle = typeof title === 'string' ? title.trim() : ''
  const nextSnapshots = getCouncilSnapshots().map((snapshot) =>
    snapshot.id === snapshotId
      ? sanitizeCouncilSnapshotRecord({
          ...snapshot,
          title: normalizedTitle.length > 0 ? normalizedTitle : snapshot.title,
        })
      : snapshot
  )
  persistCouncilSnapshots(nextSnapshots)
  return summarizeCouncilSnapshots(nextSnapshots)
})

ipcMain.handle('annotate-council-snapshot', (_e, snapshotId: string, meta?: {
  label?: string | null
  note?: string | null
}) => {
  const nextSnapshots = getCouncilSnapshots().map((snapshot) =>
    snapshot.id === snapshotId
      ? sanitizeCouncilSnapshotRecord({
          ...snapshot,
          label: sanitizeSnapshotLabel(meta?.label),
          note: sanitizeSnapshotNote(meta?.note),
        })
      : snapshot
  )
  persistCouncilSnapshots(nextSnapshots)
  return summarizeCouncilSnapshots(nextSnapshots)
})

ipcMain.handle('toggle-council-snapshot-lifecycle', (_e, snapshotId: string) => {
  const nextSnapshots = getCouncilSnapshots().map((snapshot) =>
    snapshot.id === snapshotId
      ? sanitizeCouncilSnapshotRecord({
          ...snapshot,
          lifecycle: snapshot.lifecycle === 'completed' ? 'in-progress' : 'completed',
        })
      : snapshot
  )
  persistCouncilSnapshots(nextSnapshots)
  return summarizeCouncilSnapshots(nextSnapshots)
})

ipcMain.handle('toggle-council-snapshot-archived', (_e, snapshotId: string) => {
  const nextSnapshots = getCouncilSnapshots().map((snapshot) =>
    snapshot.id === snapshotId
      ? sanitizeCouncilSnapshotRecord({
          ...snapshot,
          isArchived: !snapshot.isArchived,
        })
      : snapshot
  )
  persistCouncilSnapshots(nextSnapshots)
  return summarizeCouncilSnapshots(nextSnapshots)
})

ipcMain.handle('export-council-snapshot', async (_e, snapshotId: string) => {
  if (!mainWindow) return { ok: false, reason: 'window-unavailable' }

  const snapshot = getCouncilSnapshots().find((item) => item.id === snapshotId)
  if (!snapshot) return { ok: false, reason: 'snapshot-not-found' }

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Council Session',
    defaultPath: `${sanitizeSnapshotFilenamePart(snapshot.title)}.council-session.json`,
    filters: [
      { name: 'Council Session JSON', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })

  if (result.canceled || !result.filePath) {
    return { ok: false, reason: 'canceled' }
  }

  try {
    const envelope: CouncilSnapshotExportEnvelope = {
      version: 1,
      exportedAt: Date.now(),
      snapshot: sanitizeCouncilSnapshotRecord(snapshot),
    }
    fs.writeFileSync(result.filePath, JSON.stringify(envelope, null, 2), 'utf-8')
    return {
      ok: true,
      title: snapshot.title,
      filePath: result.filePath,
    }
  } catch (err) {
    sendLog('error', `Council snapshot export error: ${err instanceof Error ? err.message : String(err)}`)
    return { ok: false, reason: 'write-failed' }
  }
})

ipcMain.handle('import-council-snapshot', async () => {
  if (!mainWindow) {
    return { snapshots: summarizeCouncilSnapshots(getCouncilSnapshots()) }
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Council Session',
    properties: ['openFile'],
    filters: [
      { name: 'Council Session JSON', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { snapshots: summarizeCouncilSnapshots(getCouncilSnapshots()) }
  }

  try {
    const raw = fs.readFileSync(result.filePaths[0], 'utf-8')
    const parsed = JSON.parse(raw) as Partial<CouncilSnapshotExportEnvelope> | CouncilSnapshotRecord
    const importedRecord = 'snapshot' in parsed && parsed.snapshot
      ? parsed.snapshot
      : parsed as CouncilSnapshotRecord

    const nextImported = sanitizeCouncilSnapshotRecord({
      ...importedRecord,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      savedAt: Date.now(),
      lastOpenedAt: Date.now(),
      isFavorite: false,
      isArchived: false,
      lifecycle: importedRecord.lifecycle ?? 'in-progress',
    })

    const nextSnapshots = [nextImported, ...getCouncilSnapshots()].slice(0, 24)
    persistCouncilSnapshots(nextSnapshots)
    return {
      snapshots: summarizeCouncilSnapshots(nextSnapshots),
      importedTitle: nextImported.title,
    }
  } catch (err) {
    sendLog('error', `Council snapshot import error: ${err instanceof Error ? err.message : String(err)}`)
    return { snapshots: summarizeCouncilSnapshots(getCouncilSnapshots()) }
  }
})

ipcMain.handle('toggle-council-snapshot-favorite', (_e, snapshotId: string) => {
  const nextSnapshots = getCouncilSnapshots().map((snapshot) =>
    snapshot.id === snapshotId
      ? sanitizeCouncilSnapshotRecord({
          ...snapshot,
          isFavorite: !snapshot.isFavorite,
        })
      : snapshot
  )
  persistCouncilSnapshots(nextSnapshots)
  return summarizeCouncilSnapshots(getCouncilSnapshots())
})

ipcMain.handle('duplicate-council-snapshot', (_e, snapshotId: string) => {
  const snapshots = getCouncilSnapshots()
  const snapshot = snapshots.find((item) => item.id === snapshotId)
  if (!snapshot) return summarizeCouncilSnapshots(snapshots)

  const duplicated: CouncilSnapshotRecord = sanitizeCouncilSnapshotRecord({
    ...snapshot,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: `${snapshot.title} (Copy)`,
    savedAt: Date.now(),
    lastOpenedAt: Date.now(),
    isFavorite: false,
    isArchived: false,
    lifecycle: 'in-progress',
  })
  const nextSnapshots = [duplicated, ...snapshots].slice(0, 24)
  persistCouncilSnapshots(nextSnapshots)
  setActiveCouncilSnapshotId(duplicated.id)
  return summarizeCouncilSnapshots(nextSnapshots)
})

ipcMain.handle('delete-council-snapshot', (_e, snapshotId: string) => {
  const nextSnapshots = getCouncilSnapshots().filter((snapshot) => snapshot.id !== snapshotId)
  persistCouncilSnapshots(nextSnapshots)
  if (getActiveCouncilSnapshotId() === snapshotId) {
    setActiveCouncilSnapshotId(null)
  }
  return summarizeCouncilSnapshots(nextSnapshots)
})

ipcMain.handle('sync-council-room-context', (_e, payload: { participants: AiName[]; primaryAi: AiName }) => {
  return syncCouncilRoomContext(payload.participants, payload.primaryAi)
})

ipcMain.handle('bridge-workflow-to-council', (_e, payload: { participants: AiName[]; primaryAi: AiName }) => {
  return bridgeWorkflowToCouncil(payload.participants, payload.primaryAi)
})

ipcMain.handle('reset-council-room', (_e, payload?: { participants?: AiName[]; primaryAi?: AiName }) => {
  return resetCouncilRoomContext(payload?.participants, payload?.primaryAi ?? councilRoom.primaryAi)
})

ipcMain.handle('retry-council-turn', async () => {
  if (!councilRoom.failedTurn) return cloneCouncilRoomState()

  const { ai, promptText } = councilRoom.failedTurn
  clearFailedCouncilTurn(`Retrying ${AI_DISPLAY_NAMES[ai]}...`)
  emitCouncilRoomUpdate()

  try {
    await enqueueCouncilTurn(ai, promptText)
    clearFailedCouncilTurn(`${AI_DISPLAY_NAMES[ai]} recovered successfully.`)
    emitCouncilRoomUpdate()
  } catch (err) {
    recordCouncilTurnFailure(ai, promptText, err, {
      kind: 'mention',
      targetAi: ai,
      note: `${AI_DISPLAY_NAMES[ai]} failed again.`,
    })
  }

  return cloneCouncilRoomState()
})

ipcMain.handle('skip-council-turn', () => {
  if (!councilRoom.failedTurn) return cloneCouncilRoomState()
  const failedAi = councilRoom.failedTurn.ai
  clearFailedCouncilTurn(`Skipped recovery for ${AI_DISPLAY_NAMES[failedAi]}.`)
  councilRoom.messages.push(
    makeCouncilMessage(
      'system',
      `Skipped the failed turn for ${AI_DISPLAY_NAMES[failedAi]}. You can continue the discussion or address another AI.`,
    )
  )
  emitCouncilRoomUpdate()
  return cloneCouncilRoomState()
})

ipcMain.handle('send-council-message', async (_e, payload: { text: string; participants: AiName[]; primaryAi: AiName; attachedFiles?: Array<{ name: string; path: string; ext: string }> }) => {
  const text = typeof payload?.text === 'string' ? payload.text.trim() : ''
  if (!text) return cloneCouncilRoomState()

  const councilAttachedFiles = Array.isArray(payload.attachedFiles)
    ? payload.attachedFiles.filter((f) => typeof f.path === 'string' && f.path.length > 0)
    : []
  const councilFilePaths = councilAttachedFiles.map((f) => f.path)

  syncCouncilRoomContext(payload.participants, payload.primaryAi)
  clearFailedCouncilTurn()
  const userMessage = makeCouncilMessage('user', text)
  councilRoom.messages.push(userMessage)
  councilRoom.lastIntent = parseCouncilIntent(text)
  emitCouncilRoomUpdate()

  const intent = councilRoom.lastIntent
  if (!intent || intent.kind === 'none') {
    councilRoom.messages.push(
      makeCouncilMessage(
        'system',
        'Saved to the shared transcript. Mention one active AI like @Gemini, or use @all to broadcast in parallel.'
      )
    )
    emitCouncilRoomUpdate()
    return cloneCouncilRoomState()
  }

  if (intent.kind === 'unsupported') {
    councilRoom.messages.push(
      makeCouncilMessage(
        'system',
        intent.note,
        { error: true }
      )
    )
    emitCouncilRoomUpdate()
    return cloneCouncilRoomState()
  }

  // Multi-mention path: parser sets intent.targetAis to the user's explicit
  // list (in mention order).  Pure @all (no specific list) fans out to every
  // active participant — every target receives the SAME prompt in parallel.
  const targets = intent.kind === 'all'
    ? (intent.targetAis && intent.targetAis.length > 0
        ? intent.targetAis
        : getSequentialCouncilTargets(councilRoom.participants, councilRoom.primaryAi))
    : intent.targetAi
      ? [intent.targetAi]
      : []

  if (targets.length === 0) {
    councilRoom.messages.push(
      makeCouncilMessage(
        'system',
        'No valid active AI target was found for this message.',
        { error: true }
      )
    )
    emitCouncilRoomUpdate()
    return cloneCouncilRoomState()
  }

  const inactiveTarget = targets.find((ai) => !councilRoom.participants.includes(ai))
  if (inactiveTarget) {
    councilRoom.messages.push(
      makeCouncilMessage(
        'system',
        `${AI_DISPLAY_NAMES[inactiveTarget]} is not active right now. Activate that AI first, then try again.`,
        { error: true }
      )
    )
    emitCouncilRoomUpdate()
    return cloneCouncilRoomState()
  }

  if (intent.kind === 'all' && targets.length > 1) {
    councilRoom.messages.push(
      makeCouncilMessage(
        'system',
        `Broadcasting in parallel to ${targets.map((ai) => AI_DISPLAY_NAMES[ai]).join(', ')}. Each AI receives the same prompt with a summary of the previous round's answers.`
      )
    )
    emitCouncilRoomUpdate()
  }

  await runCouncilBroadcast(targets, text, councilFilePaths, councilAttachedFiles)

  return cloneCouncilRoomState()
})

ipcMain.handle('get-ai-list', () => AI_NAMES)

ipcMain.handle('get-history', () => store.get('chatHistory'))

ipcMain.handle('clear-history', () => {
  store.set('chatHistory', [])
  return true
})

// ── Workflow proceed (Next / Continue button) ─────────────────────────────────
// Called by the renderer when the user clicks Next or Continue.
// Optionally carries a new primaryAi if the user reassigned it at the pause point.
// Resolves the pending pause-point promise inside start-workflow.
ipcMain.handle('workflow-proceed', (_e, decision?: { primaryAi?: AiName }) => {
  if (workflowProceedResolver) {
    const resolve = workflowProceedResolver
    workflowProceedResolver = null
    resolve(decision ?? {})
  }
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
    if (visible && enabledAiNames.includes(name)) {
      try { mainWindow?.addBrowserView(view) } catch { /* already added */ }
    } else {
      try { mainWindow?.removeBrowserView(view) } catch { /* already removed */ }
    }
  })
  if (visible) updateViewBounds()
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
    const trimmedQuery = typeof query === 'string' ? query.trim() : ''
    const isReviewOnlyRound = trimmedQuery.length === 0

    if (!isReviewOnlyRound && query.length > QUERY_MAX_LENGTH) {
      return { success: false, error: `Query is too long. (Max ${QUERY_MAX_LENGTH} chars)` }
    }
    if (!AI_NAMES.includes(primaryAi)) {
      return { success: false, error: `Invalid AI selection: ${primaryAi}` }
    }
    if (isReviewOnlyRound && (!workflowSession || !workflowSession.latestFinalAnswer)) {
      return { success: false, error: 'There is no active session to continue.' }
    }
    if (!isReviewOnlyRound && !trimmedQuery) {
      return { success: false, error: 'Query is empty.' }
    }

    // Use caller-supplied enabled list (falls back to all AIs for backwards compat)
    // currentPrimary is a mutable tracker updated at each pause point when the
    // user reassigns the Primary AI. It starts as the caller-supplied primaryAi.
    let currentPrimary: AiName = primaryAi
    const hasFiles = Array.isArray(attachedFiles) && attachedFiles.length > 0

    try {
      // ── STEP 2.5: Extract attached file content ───────────────────────────
      const normalizedFiles: WorkflowAttachment[] = attachedFiles ? [...attachedFiles] : []
      const normalizedFilePaths = normalizedFiles.map((f) => f.path)
      let fileContext = workflowSession?.fileContext ?? ''
      let queryForRound = trimmedQuery || workflowSession?.lastUserQuery || ''
      let historyQuery = queryForRound
      let answerUnderReview = workflowSession?.latestFinalAnswer ?? ''

      if (!isReviewOnlyRound) {
        const relationDecision = await resolveSessionRelationDecision(trimmedQuery, workflowSession)
        const isNewTopic = !relationDecision.related
        if (isNewTopic) {
          sendStatus('Starting a new session...')
          sendLog(
            'info',
            `[session] New topic detected via ${relationDecision.finalSource} (scenario ${relationDecision.scenario}): ${relationDecision.reason} | overlap=${relationDecision.overlapCount} ratio=${relationDecision.overlapRatio.toFixed(2)} | "${trimmedQuery.slice(0, 120)}"`
          )
          await resetConversationThreads()
          workflowSession = null
          fileContext = ''
        } else {
          sendLog(
            'info',
            `[session] Related follow-up detected via ${relationDecision.finalSource} (scenario ${relationDecision.scenario}): ${relationDecision.reason} | overlap=${relationDecision.overlapCount} ratio=${relationDecision.overlapRatio.toFixed(2)}`
          )
        }
      } else {
        sendLog('info', '[session] Starting another reviewer round from the current final answer')
      }
      if (hasFiles) {
        sendStatus('Extracting attached file contents...')
        sendLog('info', `[Step 2.5] Extracting ${normalizedFiles.length} file(s)`)
        fileContext = await buildFileContext(normalizedFiles)
        sendLog('info', `[Step 2.5] File context ready (${fileContext.length} chars)`)
      }

      if (!workflowSession && !isReviewOnlyRound) {
        workflowSession = {
          topicSeed: trimmedQuery,
          lastUserQuery: trimmedQuery,
          currentPrimary,
          latestDraft: '',
          latestFinalAnswer: '',
          latestFeedbacks: [],
          fileContext,
          attachedFiles: normalizedFiles,
          participants: [],
          roundsCompleted: 0,
        }
      }

      if (!isReviewOnlyRound) {

      // ── STEP 3: Navigate primary AI to new chat, then inject query ────────
      const primaryView = views.get(currentPrimary)!
      const primaryConfig = getSelectors(currentPrimary)
      const isContinuingPrimaryThread = doesWorkflowOwnThread(currentPrimary)
      sendStatus(isContinuingPrimaryThread
        ? `Continuing conversation in ${currentPrimary}...`
        : `Preparing conversation in ${currentPrimary}...`)
      sendLog('info', isContinuingPrimaryThread
        ? `[Step 3] Reusing existing thread for ${currentPrimary}`
        : `[Step 3] Preparing fresh thread for ${currentPrimary}`)

      if (!isContinuingPrimaryThread) {
        await navigateToNewChat(primaryView, currentPrimary)
        markViewThreadOwner(currentPrimary, 'workflow')
      }

      sendStatus(MSG.injecting(currentPrimary))
      sendLog('info', `[Step 3] Injecting query into ${currentPrimary}`)

      const primaryBaseline = await capturePageBaseline(primaryView)
      sendLog('info', `[Step 3] Pre-injection page baseline captured (${primaryBaseline.length} chars)`)

      const inputResult = await execWithFallback(
        primaryView,
        primaryConfig.inputSelectors,
        (sel) => `!!document.querySelector(\`${sel}\`)`
      )

      if (!inputResult.success) {
        throw new Error(`Could not find input box in ${currentPrimary}. Please check login status.`)
      }

      let primaryFilesAttached = false
      if (normalizedFiles.length > 0 && normalizedFilePaths.length > 0) {
        sendLog('info', `[Step 3] ${currentPrimary}: Attempting CDP file attach (${normalizedFilePaths.length} file(s))`)
        primaryFilesAttached = await attachFilesViaCDP(primaryView, currentPrimary, normalizedFilePaths)
        if (primaryFilesAttached) {
          sendLog('info', `[Step 3] ${currentPrimary}: File attach succeeded — omitting file content from prompt`)
          await waitForFileUploadComplete(primaryView, currentPrimary)
        } else {
          sendLog('warn', `[Step 3] ${currentPrimary}: File attach failed — falling back to extracted file text`)
          primaryView.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' })
          primaryView.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' })
          await sleep(400)
        }
      }

      const needsContextBridge = Boolean(workflowSession?.latestFinalAnswer) && !doesWorkflowOwnThread(currentPrimary)
      const includeFileContext = normalizedFiles.length > 0 || !isContinuingPrimaryThread
      const primaryFileContext = primaryFilesAttached ? '' : (includeFileContext ? fileContext : '')
      const primaryPrompt = needsContextBridge
        ? buildContextBridgePrompt(trimmedQuery, workflowSession!.latestFinalAnswer, primaryFileContext)
        : buildPrimaryPrompt(trimmedQuery, primaryFileContext)
      await pasteText(primaryView, primaryPrompt, inputResult.selector!, currentPrimary)
      if (primaryFilesAttached) {
        sendLog('info', `[Step 3] ${currentPrimary}: Waiting for composer to become send-ready after attachment`)
        await waitForComposerReadyToSend(primaryView, currentPrimary, primaryConfig.sendButtonSelectors)
      }

      // small pause before send
      await sleep(CLICK_SEND_DELAY_MS)
      sendStatus(MSG.sending(currentPrimary))
      await clickSend(primaryView, primaryConfig.sendButtonSelectors, currentPrimary)

      // ── STEP 4: Wait for Primary AI response ─────────────────────────────
      sendStatus(MSG.waitingPrimary(currentPrimary))
      sendLog('info', `[Step 4] Waiting ${INITIAL_RESPONSE_WAIT_MS}ms then polling`)
      await sleep(INITIAL_RESPONSE_WAIT_MS)

      answerUnderReview = await waitForStableResponse(
        primaryView,
        primaryConfig.responseContainerSelectors,
        WORKFLOW_TIMEOUT_MS,
        STABLE_RESPONSE_MS,
        currentPrimary,
        primaryBaseline
      )

      sendLog('info', `[Step 4] Got draft (${answerUnderReview.length} chars)`)

      if (!answerUnderReview || answerUnderReview.trim().length === 0) {
        throw new Error(`No response received from ${currentPrimary}. Check login status or response timeout.`)
      }

      workflowSession!.latestDraft = answerUnderReview
      workflowSession!.lastUserQuery = trimmedQuery
      workflowSession!.currentPrimary = currentPrimary
      workflowSession!.fileContext = fileContext
      workflowSession!.attachedFiles = normalizedFiles.length > 0 ? normalizedFiles : workflowSession!.attachedFiles
      markSessionParticipant(currentPrimary)
      mainWindow?.webContents.send('draft-ready', { ai: currentPrimary, draft: answerUnderReview })

      // ── PAUSE POINT 1: Wait for user to click "Next" ──────────────────────
      sendStatus(`✅ ${currentPrimary} has finished. Review the answer above, then click Next to send to reviewers.`)
      sendLog('info', '[Pause 1] Waiting for user to click Next')
      const pause1Decision = await waitForUserProceed('after-draft')
      if (pause1Decision.primaryAi && pause1Decision.primaryAi !== currentPrimary) {
        sendLog('info', `[Pause 1] Primary AI reassigned: ${currentPrimary} → ${pause1Decision.primaryAi}`)
        currentPrimary = pause1Decision.primaryAi
        workflowSession!.currentPrimary = currentPrimary
      }
      sendLog('info', '[Pause 1] User clicked Next — proceeding to reviewer step')

      // ── STEP 5: Inject reviewer prompt into all reviewers simultaneously ──
      // Recompute reviewers based on currentPrimary (may have changed at Pause 1)
      } else {
        queryForRound = workflowSession!.lastUserQuery
        historyQuery = workflowSession!.lastUserQuery
        fileContext = workflowSession!.fileContext
        answerUnderReview = workflowSession!.latestFinalAnswer
        workflowSession!.currentPrimary = currentPrimary
      }

      const activeReviewers = enabledAiNames.filter((n) => n !== currentPrimary)
      sendStatus(MSG.sendingReviews())
      sendLog('info', `[Step 5] Injecting review requests to: ${activeReviewers.join(', ')}`)

      const effectiveFiles = normalizedFiles.length > 0 ? normalizedFiles : (workflowSession?.attachedFiles ?? [])
      const filePaths = effectiveFiles.map((f) => f.path)

      const reviewPromises = activeReviewers.map(async (reviewerName) => {
        const reviewerView = views.get(reviewerName)!
        const reviewerConfig = getSelectors(reviewerName)

        const reuseReviewerThread = doesWorkflowOwnThread(reviewerName)
        sendLog('info', reuseReviewerThread
          ? `[Step 5] Reusing existing thread for ${reviewerName}`
          : `[Step 5] Preparing fresh thread for ${reviewerName}`)
        if (!reuseReviewerThread) {
          await navigateToNewChat(reviewerView, reviewerName)
          markViewThreadOwner(reviewerName, 'workflow')
        }

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
        if (effectiveFiles.length > 0 && filePaths.length > 0) {
          sendLog('info', `[Step 5] ${reviewerName}: Attempting CDP file attach (${filePaths.length} file(s))`)
          filesAttached = await attachFilesViaCDP(reviewerView, reviewerName, filePaths)
          if (filesAttached) {
            await waitForFileUploadComplete(reviewerView, reviewerName)
          }
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
        const prompt = buildReviewerPromptV2(
          reviewerName,
          queryForRound,
          answerUnderReview,
          filesAttached ? '' : fileContext
        )

        sendLog('info', `[Step 5] ${reviewerName}: Starting prompt paste`)
        await pasteText(reviewerView, prompt, inputRes.selector!, reviewerName as AiName)
        if (filesAttached) {
          sendLog('info', `[Step 5] ${reviewerName}: Waiting for composer to become send-ready after attachment`)
          await waitForComposerReadyToSend(reviewerView, reviewerName, reviewerConfig.sendButtonSelectors)
        }

        // ── Capture baseline BEFORE clicking Send ─────────────────────────
        // This prevents old conversation text from being mistaken for the
        // new response. Same pattern used for the primary AI in Step 4.
        const reviewerBaseline = await captureCurrentText(
          reviewerView,
          reviewerConfig.responseContainerSelectors
        )
        sendLog('info', `[Step 5] ${reviewerName}: Pre-send baseline captured (${reviewerBaseline.length} chars)`)

        await sleep(REVIEWER_SEND_DELAY_MS)

        const sent = await clickSend(reviewerView, reviewerConfig.sendButtonSelectors, reviewerName as AiName)
        sendLog('info', `[Step 5] ${reviewerName}: Send ${sent ? 'succeeded' : 'failed'}`)

        if (!sent) {
          sendLog('warn', `[Step 5] ${reviewerName}: Send button not found — falling back to Enter key`)
        }

        sendStatus(MSG.waitingReviewer(reviewerName))
        await sleep(INITIAL_RESPONSE_WAIT_MS)
        const rawFeedback = await waitForStableResponse(
          reviewerView,
          reviewerConfig.responseContainerSelectors,
          WORKFLOW_TIMEOUT_MS,
          STABLE_RESPONSE_MS,
          reviewerName,
          reviewerBaseline    // ← prevent old-response bleed-through
        ).catch((err) => {
          sendLog('warn', `${reviewerName} timeout: ${err.message}`)
          return ''
        })

        // Claude's innerText includes sidebar chrome + echoed prompt + footer.
        // Strip all of that so only the actual feedback content is used.
        const feedback = reviewerName === 'claude'
          ? sanitizeClaudeFeedback(rawFeedback)
          : rawFeedback

        if (reviewerName === 'claude' && rawFeedback.length !== feedback.length) {
          sendLog('info', `[Step 5] claude: sanitized feedback ${rawFeedback.length}→${feedback.length} chars`)
        }

        markSessionParticipant(reviewerName)
        mainWindow?.webContents.send('feedback-ready', { ai: reviewerName, feedback })
        return { ai: reviewerName as AiName, feedback }
      })

      // ── STEP 6: Collect all reviewer feedbacks ────────────────────────────
      sendStatus(MSG.collectingFeedbacks())
      sendLog('info', '[Step 6] Collecting reviewer feedbacks')
      const feedbackResults = await Promise.all(reviewPromises)
      workflowSession!.latestFeedbacks = feedbackResults

      // ── PAUSE POINT 2: Wait for user to click "Continue" ──────────────────
      sendStatus('✅ All reviewer feedback is ready. Review the panels above, then click Continue to generate the final answer.')
      sendLog('info', '[Pause 2] Waiting for user to click Continue')
      const pause2Decision = await waitForUserProceed('after-reviews')
      if (pause2Decision.primaryAi && pause2Decision.primaryAi !== currentPrimary) {
        sendLog('info', `[Pause 2] Primary AI reassigned: ${currentPrimary} → ${pause2Decision.primaryAi}`)
        currentPrimary = pause2Decision.primaryAi
        workflowSession!.currentPrimary = currentPrimary
      }
      sendLog('info', '[Pause 2] User clicked Continue — proceeding to final revision')

      // ── STEP 7: Inject final revision prompt into (current) Primary AI ─────
      // currentPrimary may have been reassigned at Pause 2.
      const finalPrimaryConfig = getSelectors(currentPrimary)
      const finalPrimaryView = views.get(currentPrimary)!
      sendStatus(MSG.sendingRevision(currentPrimary))
      sendLog('info', `[Step 7] Sending final revision prompt to ${currentPrimary}`)

      if (!doesWorkflowOwnThread(currentPrimary)) {
        sendLog('info', `[Step 7] Preparing fresh workflow thread for ${currentPrimary}`)
        await navigateToNewChat(finalPrimaryView, currentPrimary)
        markViewThreadOwner(currentPrimary, 'workflow')
      }

      const attachedFileNames = effectiveFiles.map((f) => f.name)
      const finalPrompt = buildFinalRevisionPromptV2(
        queryForRound,
        answerUnderReview,
        feedbackResults,
        effectiveFiles.length > 0,
        attachedFileNames
      )

      const finalInputRes = await execWithFallback(
        finalPrimaryView,
        finalPrimaryConfig.inputSelectors,
        (sel) => `!!document.querySelector(\`${sel}\`)`
      )

      if (!finalInputRes.success) {
        throw new Error(`Could not find ${currentPrimary} input box for final revision request.`)
      }

      const finalBaseline = await captureCurrentText(
        finalPrimaryView,
        finalPrimaryConfig.responseContainerSelectors
      )
      sendLog('info', `[Step 7] Final baseline captured (${finalBaseline.length} chars)`)

      await pasteText(finalPrimaryView, finalPrompt, finalInputRes.selector!, currentPrimary)
      await sleep(CLICK_SEND_DELAY_MS)
      await clickSend(finalPrimaryView, finalPrimaryConfig.sendButtonSelectors, currentPrimary)

      // ── STEP 8: Extract final revised answer ──────────────────────────────
      sendStatus(MSG.waitingFinal(currentPrimary))
      sendLog('info', `[Step 8] Waiting ${INITIAL_RESPONSE_WAIT_MS}ms before polling...`)
      await sleep(INITIAL_RESPONSE_WAIT_MS)
      sendLog('info', '[Step 8] Polling final revised answer (ignoring baseline)')

      const finalAnswer = await waitForStableResponse(
        finalPrimaryView,
        finalPrimaryConfig.responseContainerSelectors,
        WORKFLOW_TIMEOUT_MS,
        STABLE_RESPONSE_MS,
        currentPrimary,
        finalBaseline
      )

      // Save to history — record the AI that actually produced the final answer
      workflowSession = {
        ...(workflowSession ?? {
          topicSeed: historyQuery,
          lastUserQuery: historyQuery,
          currentPrimary,
          latestDraft: answerUnderReview,
          latestFinalAnswer: finalAnswer,
          latestFeedbacks: feedbackResults,
          fileContext,
          attachedFiles: effectiveFiles,
          participants: [],
          roundsCompleted: 0,
        }),
        lastUserQuery: historyQuery,
        currentPrimary,
        latestDraft: answerUnderReview,
        latestFinalAnswer: finalAnswer,
        latestFeedbacks: feedbackResults,
        fileContext,
        attachedFiles: effectiveFiles,
        roundsCompleted: (workflowSession?.roundsCompleted ?? 0) + 1,
      }
      markSessionParticipant(currentPrimary)

      const historyEntry = {
        id: `${Date.now()}`,
        query: historyQuery,
        primaryAi: currentPrimary,
        result: finalAnswer,
        timestamp: Date.now(),
      }
      const history = store.get('chatHistory') as StoreSchema['chatHistory']
      store.set('chatHistory', [historyEntry, ...history].slice(0, HISTORY_MAX_ITEMS))

      // ── Parse per-file modified content from final answer ────────────────
      const fileContents = effectiveFiles.length > 0
        ? parseFileContents(finalAnswer, effectiveFiles.map((f) => ({ name: f.name, ext: f.ext })))
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
  const languageDirective = buildResponseLanguageDirective(query)
  if (!fileContext) return `${languageDirective}\n\n${query}`
  return `${languageDirective}\n\n${query}${fileContext}`
}

function buildContextBridgePrompt(
  query: string,
  previousFinalAnswer: string,
  fileContext: string
): string {
  const languageDirective = buildResponseLanguageDirective(query)

  return `${languageDirective}

You are joining an ongoing discussion. Read the current context first, then answer the follow-up naturally and directly.

[Previous Final Answer]
${previousFinalAnswer}

[Follow-up Question]
${query}${fileContext}`
}

const AI_REVIEWER_BRIEFS: Record<AiName, { role: string; focus: string; outputGuide: string }> = {
  gemini: {
    role: 'Multimodal Broad-Context Synthesizer',
    focus: 'Leverage multimodal synthesis and long-context integration. Connect dots across large bodies of information — text, data, and complex workflows. Surface missing context, identify system-level patterns, and check audience and constraint fit.',
    outputGuide: `Respond with three short sections:
- Context connections
- Missing context
- System fit`,
  },
  claude: {
    role: 'Long-Document Reasoner and Careful Drafter',
    focus: 'Apply deep document reasoning and careful drafting. Weigh tradeoffs, preserve nuance, check correctness and subtle risks especially in analysis, summaries, contracts, and long-form content. Flag ethical, safety, or human-impact concerns without losing practical direction.',
    outputGuide: `Respond with three short sections:
- Nuance to preserve
- Correctness or risk concerns
- Better tradeoff framing`,
  },
  chatgpt: {
    role: 'Versatile Creative and Communication Generalist',
    focus: 'Apply broad versatility to improve framing, creativity, and practical clarity. Make the answer engaging, well-structured, and actionable for general audiences across writing, brainstorming, and everyday tasks. Improve tone, structure, and next steps.',
    outputGuide: `Respond with three short sections:
- What will land well
- What feels impractical or vague
- A stronger version`,
  },
  perplexity: {
    role: 'Source-Grounded Fact Verifier with Citations',
    focus: 'Verify factual claims with current, credible sources and explicit citations. Flag outdated or unsupported assumptions, distinguish evidence from inference, and add citation-backed additions where claims lack grounding.',
    outputGuide: `Respond with three short sections:
- Verified or supportable (with sources)
- Needs evidence
- Source-grounded additions`,
  },
  grok: {
    role: 'Real-Time Trend and Adversarial Reality Critic',
    focus: 'Challenge assumptions from the lens of current events, real-world social dynamics, and trending cultural context. Expose what is outdated, overconfident, or culturally tone-deaf. Surface practical and social failure modes. Be direct and grounded in what is happening now.',
    outputGuide: `Respond with three short sections:
- Current reality check (trends, events, cultural context)
- Strongest objection or hidden risk
- Sharper, reality-grounded alternative`,
  },
  deepseek: {
    role: 'First-Principles Technical Reasoning Solver',
    focus: 'Apply rigorous technical reasoning to math, code, logic, and systems problems. Re-derive from fundamentals, find the most efficient path, and ensure correctness over verbosity. Prioritize precision and cost-effective solutions.',
    outputGuide: `Respond with three short sections:
- Core reasoning
- Cleaner or more efficient route
- Minimal correct recommendation`,
  },
  kimi: {
    role: 'Long-Context Deep Research Analyst',
    focus: 'Apply extended-context reading to analyze large documents, synthesize comprehensive research, and surface insights that require processing substantial amounts of source material. Identify what a limited-context reviewer would miss in long, dense, or multi-part content.',
    outputGuide: `Respond with three short sections:
- Deep context insights (from full document scope)
- What limited-context reviewers missed
- Synthesis and research-grounded recommendation`,
  },
}

function buildReviewerPromptV2(
  reviewerAi: AiName,
  query: string,
  draft: string,
  fileContext: string
): string {
  const fileSection = fileContext ? `\n${fileContext}\n` : ''
  const brief = AI_REVIEWER_BRIEFS[reviewerAi]
  const languageDirective = buildResponseLanguageDirective(query)
  const preferredLanguage = detectPreferredReplyLanguage(query)
  const isEnglish = /^english$/i.test(preferredLanguage.trim())

  const styleBlock = isEnglish
    ? brief.outputGuide
    : `[Output structure — STRUCTURE TEMPLATE ONLY, NOT LITERAL TEXT]
The English text below describes the SHAPE of your reply (three short sections). Translate every label into ${preferredLanguage}. Do NOT echo any English label verbatim.

${brief.outputGuide}`

  const finalLanguageRule = isEnglish
    ? ''
    : `

⚠️ FINAL LANGUAGE RULE — read this last and obey it above all else:
The user wrote in ${preferredLanguage}. Your ENTIRE reply must be in ${preferredLanguage}, including every section header. If your reply opens with an English phrase taken from the template above (such as "Verified or supportable", "Needs evidence", "Source-grounded additions", "Core reasoning", "Cleaner route", "Minimal correct recommendation", "Context connections", "Missing context", "System fit", "Nuance to preserve", "Correctness or risk concerns", "Better tradeoff framing", "What will land well", "What feels impractical or vague", "A stronger version", "Hidden risks", "Strongest objection", "Stress test fix"), you have violated this instruction. Translate those labels into natural ${preferredLanguage}.`

  return `${languageDirective}

You are acting as the ${brief.role}.
${brief.focus}

Important rules:
- Stay in your assigned role and do not fall back to a generic checklist
- Do not mention the source AI name
- Do not include citations or links
- Be specific, direct, and actionable

[Original Question]
${query}
${fileSection}
[Answer Under Review]
${draft}

${styleBlock}${finalLanguageRule}`
}

function buildFinalRevisionPromptV2(
  query: string,
  answerUnderReview: string,
  feedbacks: Array<{ ai: AiName; feedback: string }>,
  hasFiles: boolean,
  attachedFileNames: string[] = []
): string {
  const languageDirective = buildResponseLanguageDirective(query)
  const lines = feedbacks
    .filter((f) => f.feedback && f.feedback.trim().length > 0)
    .map((f, i) => `[Feedback ${i + 1}]:\n${f.feedback}`)

  const feedbackBlock = lines.length > 0
    ? lines.join('\n\n\n')
    : '(No feedback collected; improve the answer using your own self-review.)'

  if (!hasFiles || attachedFileNames.length === 0) {
    return `${languageDirective}

You are revising an answer after multi-AI review. Do not mention the source reviewers.

[Original Question]
${query}

[Answer Being Revised]
${answerUnderReview}

${feedbackBlock}

[FINAL TASK]
Incorporate the above feedback comprehensively. If you disagree with any part, explain why, and write the strongest final answer possible.`
  }

  const fileBlocks = attachedFileNames
    .map((name) => `<<<FILE:${name}>>>\n(Write the complete revised content of this file here)\n<<<END_FILE>>>`)
    .join('\n\n')

  return `${languageDirective}

You are revising a file-focused answer after multi-AI review. Do not mention the source reviewers.

[Original Question]
${query}

[Answer Being Revised]
${answerUnderReview}

${feedbackBlock}

[FINAL TASK]
Incorporate the above feedback comprehensively. If you disagree with any part, briefly explain why.
Then output the complete revised content of each file in the following format, without omission.
(Follow the delimiters around file content exactly)

${fileBlocks}`
}

// ─── AI Persona Roles ─────────────────────────────────────────────────────────
// Each AI reviewer gets a role that matches its native strengths so feedback
// is diverse and complementary rather than echo-chamber repetitions.
const AI_REVIEWER_PERSONAS: Record<AiName, { role: string; focus: string; outputGuide: string }> = {
  gemini: {
    role: 'Broad-Context Systems Synthesizer',
    focus: 'Connect dots across large bodies of information, surface missing context, identify system-level patterns, and check audience, workflow, and constraint fit.',
    outputGuide: `Respond with three short sections:
- Context connections
- Missing context
- System fit`,
  },
  claude: {
    role: 'Nuanced Reasoner and Safety Analyst',
    focus: 'Weigh tradeoffs, preserve subtle distinctions, check correctness, and flag ethical, safety, reputational, or human-impact concerns without losing practical direction.',
    outputGuide: `Respond with three short sections:
- Nuance to preserve
- Correctness or risk concerns
- Better tradeoff framing`,
  },
  chatgpt: {
    role: 'Practical UX and Communication Coach',
    focus: 'Make the answer clear, useful, actionable, and easy for a real user to follow. Improve framing, tone, structure, and next steps.',
    outputGuide: `Respond with three short sections:
- What will land well
- What feels impractical or vague
- A stronger version`,
  },
  perplexity: {
    role: 'Source-Grounded Fact Verifier',
    focus: 'Verify factual claims with current, credible sources. Flag outdated or unsupported assumptions, distinguish evidence from inference, and identify where citations are needed.',
    outputGuide: `Respond with three short sections:
- Verified or supportable
- Needs evidence
- Source-grounded additions`,
  },
  grok: {
    role: 'Adversarial Reality Critic',
    focus: 'Challenge assumptions, expose weak points, identify practical and social failure modes, and offer sharper alternatives. Be direct, skeptical, and useful.',
    outputGuide: `Respond with three short sections:
- Hidden risks
- Strongest objection
- Stress test fix`,
  },
  deepseek: {
    role: 'First-Principles Reasoning Solver',
    focus: 'Re-derive the problem from fundamentals, especially for logic, math, code, systems, and optimization questions. Find the cleanest route and be concise without becoming shallow.',
    outputGuide: `Respond with three short sections:
- Core reasoning
- Cleaner route
- Minimal correct recommendation`,
  },
  kimi: {
    role: 'Agentic Execution Architect',
    focus: 'Decompose the request into a concrete agentic execution plan — ordered steps, tool calls, file/state dependencies, and recovery paths. Surface where multi-step automation would actually break down (race conditions, missed prerequisites, brittle ordering, unhandled failure modes) that single-shot reasoners ignore.',
    outputGuide: `Respond with three short sections:
- Execution plan (ordered steps with tools)
- Failure modes (where the agent loop breaks)
- Tighter sequence (refined order, dependencies, recovery)`,
  },
}

function buildReviewerPrompt(
  reviewerAi: AiName,
  query: string,
  draft: string,
  fileContext: string
): string {
  const fileSection = fileContext ? `\n${fileContext}\n` : ''
  const persona = AI_REVIEWER_PERSONAS[reviewerAi]

  return `You are acting as a **${persona.role}**.
${persona.focus}

**Important rules:**
- Provide feedback from the perspective of your assigned role above
- Do not mention the source AI name of the original analysis
- Do not include web search citations, source links, or reference numbers ([1][2], etc.)
- Write only the feedback — do not attribute anything to any source

[Original Question]
${query}
${fileSection}
[Analysis Result]
${draft}

Please review the above analysis based on the following criteria:
1. Accuracy (are there any factual errors, based on your role?)
2. Completeness (is any important content missing from your perspective?)
3. Clarity (are there any parts that are hard to understand?)
4. Suggestions for improvement (specific, actionable recommendations from your role's viewpoint)`
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
    ? lines.join('\n\n\n')   // 2 blank lines between feedbacks
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
    chatgpt: 'ChatGPT',
    claude: 'Claude',
    gemini: 'Gemini',
    grok: 'Grok',
    deepseek: 'DeepSeek',
    perplexity: 'Perplexity',
    kimi: 'Kimi',
  }
  return map[ai] ?? ai
}

// ─── AI Recommendation Engine ─────────────────────────────────────────────────
// Uses the Gemini API (if key is set) to analyze the user's query and
// recommend the best Primary AI and per-round suggestions.

interface AiRecommendationResult {
  recommended: AiName
  reason: string
  roundSuggestions: Array<{ ai: AiName; reason: string }>
}

const ROUTING_PROFILE_DETAILS: Record<AiName, AiRecommendationResult> = {
  chatgpt: {
    recommended: 'chatgpt',
    reason: 'Recommended for practical UX, communication, writing, and turning the answer into clear next steps.',
    roundSuggestions: [
      { ai: 'claude', reason: 'Nuance, correctness, and tradeoff review' },
      { ai: 'grok', reason: 'Reality check for weak spots' },
    ],
  },
  claude: {
    recommended: 'claude',
    reason: 'Recommended for nuanced reasoning, correctness, safety, ethics, and careful tradeoff analysis.',
    roundSuggestions: [
      { ai: 'grok', reason: 'Adversarial failure-mode pressure' },
      { ai: 'chatgpt', reason: 'Practical communication polish' },
    ],
  },
  gemini: {
    recommended: 'gemini',
    reason: 'Recommended for broad-context synthesis across documents, systems, workflows, and large bodies of information.',
    roundSuggestions: [
      { ai: 'claude', reason: 'Nuance, correctness, and tradeoff critique' },
      { ai: 'perplexity', reason: 'Source-grounded fact verification' },
    ],
  },
  grok: {
    recommended: 'grok',
    reason: 'Recommended for adversarial critique, contrarian review, hidden assumptions, and real-world failure modes.',
    roundSuggestions: [
      { ai: 'claude', reason: 'Balanced nuance and safety analysis' },
      { ai: 'perplexity', reason: 'Source-grounded claim verification' },
    ],
  },
  deepseek: {
    recommended: 'deepseek',
    reason: 'Recommended for first-principles reasoning in logic, math, code, systems, and optimization problems.',
    roundSuggestions: [
      { ai: 'claude', reason: 'Correctness, edge-case, and safety review' },
      { ai: 'chatgpt', reason: 'Practical implementation and communication polish' },
    ],
  },
  perplexity: {
    recommended: 'perplexity',
    reason: 'Recommended for current facts, source-grounded verification, citations, and freshness-sensitive claims.',
    roundSuggestions: [
      { ai: 'gemini', reason: 'Broad-context synthesis of the findings' },
      { ai: 'claude', reason: 'Nuanced tradeoff and correctness analysis' },
    ],
  },
  kimi: {
    recommended: 'kimi',
    reason: 'Recommended for tasks that require a concrete agentic execution plan — multi-step automation, tool-use sequences, long-horizon coding, and failure-mode analysis across complex workflows.',
    roundSuggestions: [
      { ai: 'deepseek', reason: 'First-principles correctness check on the execution logic' },
      { ai: 'claude', reason: 'Nuance, correctness, and safety review of the plan' },
    ],
  },
}

function countRoutingMatches(query: string, patterns: RegExp[]): number {
  return patterns.reduce((score, pattern) => score + (pattern.test(query) ? 1 : 0), 0)
}

/**
 * Rule-based fallback recommendation — used when no API key is configured
 * or when the API call fails. Keep this aligned with the AI Council roles:
 * DeepSeek solves, Gemini connects, Claude nuances, Grok attacks,
 * Perplexity verifies, and ChatGPT makes it usable.
 */
function ruleBasedRecommendation(query: string): AiRecommendationResult {
  const q = query.toLowerCase()
  const scores: Record<AiName, number> = {
    chatgpt: 0,
    claude: 0,
    gemini: 0,
    grok: 0,
    deepseek: 0,
    perplexity: 0,
    kimi: 0,
  }

  scores.kimi += countRoutingMatches(q, [
    /\b(agent|agentic|autonomous|execution[-\s]?plan|workflow|automation|pipeline|tool[-\s]?use|tool[-\s]?call|orchestrat|step[-\s]?by[-\s]?step|failure[-\s]?mode|recovery|dependency|multi[-\s]?step|long[-\s]?horizon|repo|repository|codebase|monorepo|multi[-\s]?file)\b/i,
    /에이전트|자동화|파이프라인|툴\s*사용|단계별|실패\s*모드|복구|의존성|다단계|장기간|레포|레포지토리|코드베이스|다중\s*파일/i,
  ]) * 2

  scores.perplexity += countRoutingMatches(q, [
    /\b(news|latest|recent|today|yesterday|current|trending|stock|price|weather|event|happen|source|sources|citation|cite|verify|fact-?check|evidence)\b/i,
    /\b(2024|2025|2026)\b/i,
    /최신|최근|오늘|어제|현재|뉴스|트렌드|주가|가격|날씨|일정|사실\s*확인|검증|출처|근거|인용|증거/i,
  ]) * 3

  scores.deepseek += countRoutingMatches(q, [
    /\b(code|coding|program|function|bug|error|debug|algorithm|api|typescript|javascript|python|react|node|sql|database|refactor|implement|class|module|async|await|math|logic|proof|optimi[sz]e|complexity)\b/i,
    /코드|코딩|프로그래밍|버그|디버그|알고리즘|수학|계산|논리|추론|증명|최적화|복잡도|구현|리팩터|타입스크립트|자바스크립트|파이썬|데이터베이스/i,
  ]) * 3

  scores.gemini += countRoutingMatches(q, [
    /\b(long|large|document|documents|file|files|report|spreadsheet|dataset|analyze|analysis|summari[sz]e|synthesis|synthesize|system|workflow|architecture|compare|context|multimodal|pdf|csv|xlsx)\b/i,
    /긴|장문|대량|문서|자료|파일|보고서|스프레드시트|데이터셋|분석|요약|종합|시스템|워크플로우|아키텍처|비교|맥락|컨텍스트/i,
  ]) * 2

  scores.claude += countRoutingMatches(q, [
    /\b(nuance|nuanced|trade-?off|ethical|ethics|moral|safety|policy|correctness|careful|subtle|ambiguous|risk assessment|human impact|reputation|review)\b/i,
    /뉘앙스|미묘|트레이드오프|윤리|도덕|안전|정책|정확성|신중|애매|모호|품질|검토|리뷰|인간적|평판/i,
  ]) * 2

  scores.grok += countRoutingMatches(q, [
    /\b(adversarial|critic|critique|contrarian|devil'?s advocate|stress test|objection|weakness|failure mode|assumption|skeptical|debate|controversial|pros.*cons|cons.*pros|versus|vs\.?)\b/i,
    /반박|비판|허점|약점|실패\s*모드|가정|회의적|논쟁|논란|찬반|반대|현실적|스트레스\s*테스트/i,
  ]) * 2

  scores.chatgpt += countRoutingMatches(q, [
    /\b(write|writing|email|message|copy|blog|essay|marketing|brand|story|script|explain|communicat(e|ion)|ux|user|practical|actionable|plan|next step|tone|rewrite|polish)\b/i,
    /글쓰기|이메일|메시지|카피|블로그|에세이|마케팅|브랜드|스토리|스크립트|설명|커뮤니케이션|소통|사용자|UX|실용|실행|계획|다음\s*단계|말투|톤|고쳐쓰기|다듬/i,
  ]) * 2

  // High-signal tie breakers that reflect the upgraded role ownership.
  if (/출처|인용|최신|현재|today|latest|source|citation/i.test(q)) scores.perplexity += 2
  if (/코드|알고리즘|수학|logic|algorithm|code|math/i.test(q)) scores.deepseek += 2
  if (/윤리|안전|trade-?off|nuance|ethical|safety/i.test(q)) scores.claude += 2
  if (/반박|허점|실패|contrarian|adversarial|failure mode/i.test(q)) scores.grok += 2
  if (/문서|자료|종합|시스템|document|synthesis|system|context/i.test(q)) scores.gemini += 1
  if (/실행|사용자|글쓰기|communication|actionable|ux|writing/i.test(q)) scores.chatgpt += 1

  const priority: AiName[] = ['perplexity', 'deepseek', 'kimi', 'gemini', 'claude', 'grok', 'chatgpt']
  const recommended = priority.reduce((best, ai) => {
    if (scores[ai] > scores[best]) return ai
    return best
  }, 'gemini' as AiName)

  return scores[recommended] > 0
    ? ROUTING_PROFILE_DETAILS[recommended]
    : ROUTING_PROFILE_DETAILS.gemini
}

/**
 * Use the Gemini API to intelligently recommend the best Primary AI for a query.
 * Falls back to rule-based logic if the API call fails or no key is set.
 */
async function analyzeQueryForPrimaryAi(query: string): Promise<AiRecommendationResult> {
  const apiKeys = store.get('apiKeys') as StoreSchema['apiKeys']
  const defaultOrder = ['chatgpt', 'claude', 'gemini', 'grok', 'deepseek', 'perplexity', 'kimi']
  const apiKeyOrder: string[] = (store.get('apiKeyOrder') as string[] | undefined) ?? defaultOrder

  // Shared routing prompt — compact enough for fast/cheap models
  const ROUTING_PROMPT = `You are an AI routing expert. A user submitted this query to a multi-AI review system.
Analyze the query and recommend the BEST Primary AI from: chatgpt, claude, gemini, grok, deepseek, perplexity, kimi.

AI strengths:
- chatgpt: Practical UX and communication; clear, actionable, human-facing guidance
- claude: Nuanced reasoning, long-form analysis, correctness, ethics, and safety tradeoffs
- gemini: Broad-context synthesis across long documents, multimodal context, and system-level patterns
- grok: Adversarial reality critique; assumptions, objections, incentives, and failure modes
- deepseek: First-principles reasoning for logic, math, code, systems, and optimization
- perplexity: Source-grounded fact verification, current information, citations, and freshness checks
- kimi: Agentic execution planning — decomposing complex tasks into ordered steps with tool calls, dependencies, failure modes, and recovery paths

Routing rules:
- Choose deepseek for code, algorithms, math, logic, debugging, implementation, optimization, or first-principles problem solving.
- Choose gemini for long documents, many files, broad-context synthesis, multimodal context, systems, workflows, architecture, or cross-source integration.
- Choose claude for nuanced tradeoffs, correctness, safety, ethics, policy, ambiguity, careful review, or human-impact analysis.
- Choose grok for adversarial critique, contrarian review, hidden assumptions, objections, debates, incentives, or real-world failure modes.
- Choose perplexity for latest/current information, factual verification, source-grounding, citations, or freshness-sensitive claims.
- Choose chatgpt for practical UX, writing, communication, tone, user-facing explanation, action plans, or making the answer easy to use.
- Choose kimi for agentic execution planning: multi-step automation, tool-use sequences, failure-mode analysis of complex workflows, or long-horizon coding tasks that require decomposing dependencies and recovery paths.
- If a query matches multiple roles, pick the AI whose unique strength is most central to producing the first draft. Put complementary reviewers in roundSuggestions.

User Query: "${query.slice(0, 500)}"

Respond ONLY with valid JSON (no markdown, no explanation):
{"recommended":"<ai_name>","reason":"<one sentence>","roundSuggestions":[{"ai":"<ai_name>","reason":"<brief>"},{"ai":"<ai_name>","reason":"<brief>"}]}`

  const validAis: AiName[] = ['chatgpt', 'claude', 'gemini', 'grok', 'deepseek', 'perplexity', 'kimi']

  /** Parse LLM text -> AiRecommendationResult or null */
  const parseResult = (text: string): AiRecommendationResult | null => {
    try {
      const jsonText = text.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim()
      const parsed = JSON.parse(jsonText) as AiRecommendationResult
      if (!validAis.includes(parsed.recommended)) return null
      const fallback = ROUTING_PROFILE_DETAILS[parsed.recommended]
      const suggestions = Array.isArray(parsed.roundSuggestions)
        ? parsed.roundSuggestions
            .filter((item) => validAis.includes(item.ai) && item.ai !== parsed.recommended)
            .slice(0, 2)
        : []
      return {
        recommended: parsed.recommended,
        reason: typeof parsed.reason === 'string' && parsed.reason.trim().length > 0
          ? parsed.reason.trim()
          : fallback.reason,
        roundSuggestions: suggestions.length > 0 ? suggestions : fallback.roundSuggestions,
      }
    } catch {
      return null
    }
  }

  // Iterate providers in user-defined order
  for (const provider of apiKeyOrder) {
    const key = (apiKeys as Record<string, string | undefined>)?.[provider]
    if (!key) continue  // no key for this provider -> skip

    try {
      let responseText = ''

      if (provider === 'gemini') {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: ROUTING_PROMPT }] }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 300 },
            }),
          }
        )
        if (res.ok) {
          const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
          responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        }

      } else if (provider === 'claude') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 300,
            messages: [{ role: 'user', content: ROUTING_PROMPT }],
          }),
        })
        if (res.ok) {
          const data = await res.json() as { content?: Array<{ text?: string }> }
          responseText = data?.content?.[0]?.text ?? ''
        }

      } else if (provider === 'chatgpt') {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 300,
            temperature: 0.1,
            messages: [{ role: 'user', content: ROUTING_PROMPT }],
          }),
        })
        if (res.ok) {
          const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
          responseText = data?.choices?.[0]?.message?.content ?? ''
        }

      } else if (provider === 'deepseek') {
        const res = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: 'llama3-8b-8192',
            max_tokens: 300,
            temperature: 0.1,
            messages: [{ role: 'user', content: ROUTING_PROMPT }],
          }),
        })
        if (res.ok) {
          const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
          responseText = data?.choices?.[0]?.message?.content ?? ''
        }

      } else {
        // perplexity / grok (xAI) — no routing completion endpoint configured; skip
        continue
      }

      if (responseText) {
        const result = parseResult(responseText)
        if (result) {
          sendLog('info', `[recommend] ${provider} -> ${result.recommended}: ${result.reason}`)
          return result
        }
      }
    } catch (err) {
      sendLog('warn', `[recommend] ${provider} failed: ${err instanceof Error ? err.message : String(err)} — trying next`)
    }
  }

  // All providers failed or no key available -> rule-based fallback
  sendLog('info', '[recommend] Rule-based fallback (no working API key)')
  return ruleBasedRecommendation(query)
}

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
    // Most specific first — exact aria-labels for Gemini's "+" / upload menu.
    // The previous "*='Add' i" wildcard was too greedy and would click any
    // unrelated "Add to favorites" / "Add account" button, then return early
    // and never reach the proper Gemini DOM heuristic at the bottom.
    'button[aria-label="Open upload file menu"]',
    'button[aria-label="Upload and use files"]',
    'button[aria-label="Add files"]',
    'button[aria-label*="dd files" i]',
    'button[aria-label*="dd file" i]',
    'button[aria-label*="upload" i]',
    'button[aria-label*="attach" i]',
    'button[aria-label*="ttachment" i]',
    'button[aria-label*="insert" i]',
    'button[mattooltip*="upload" i]',
    'button[mattooltip*="file" i]',
    'button[jsaction*="upload"]',
  ],
  deepseek: [
    // DeepSeek paperclip / attachment icon button
    'div.ds-icon-button[aria-label*="attach" i]',
    'div.ds-icon-button[aria-label*="upload" i]',
    'div.ds-icon-button[aria-label*="file" i]',
    'div.ds-icon-button[aria-label*="image" i]',
    'div.ds-icon-button[aria-label*="上传"]',
    'div.ds-icon-button[aria-label*="附件"]',
    'button[aria-label*="attach" i]',
    'button[aria-label*="upload" i]',
    'button[aria-label*="上传"]',
    'button[aria-label*="附件"]',
  ],
  grok: [
    'button[aria-label*="attach" i]',
    'button[aria-label*="upload" i]',
    'button[aria-label*="file" i]',
    'button[aria-label*="image" i]',
    'button[aria-label*="media" i]',
  ],
  perplexity: [],   // no reliable file upload in free tier
  kimi: [
    // Kimi composer attachment button (paperclip / "+")
    'button[aria-label*="attach" i]',
    'button[aria-label*="upload" i]',
    'button[aria-label*="file" i]',
    'button[aria-label*="附件"]',
    'button[aria-label*="上传"]',
    'div[role="button"][aria-label*="attach" i]',
    'div[role="button"][aria-label*="upload" i]',
    'div[role="button"][aria-label*="附件"]',
    'div[role="button"][aria-label*="上传"]',
    'div[data-testid*="upload" i]',
    'div[data-testid*="attach" i]',
  ],
}

/**
 * Attach files to an AI BrowserView.
 *
 * Strategy order (default):
 *   A. CDP file-input: click upload button → find <input type="file"> → setFileInputFiles
 *      - Gemini: two-step (click "+" → click "Upload file" menu item)
 *   B. Clipboard paste fallback: write image to clipboard → paste
 *
 * DeepSeek exception: DeepSeek's paperclip button reveals a DOCUMENT uploader
 * (shows "No text extracted" for images, and opens Windows Explorer dialog).
 * For image files, we use JavaScript drop/paste injection instead: read the
 * image as base64, create a File object in the page context, and dispatch
 * drop/paste events on the input area.  Non-image files go through CDP.
 *
 * Returns true when files were attached successfully, false on total failure.
 */
async function attachFilesViaCDP(
  view: BrowserView,
  ai: AiName,
  filePaths: string[]
): Promise<boolean> {
  if (!filePaths || filePaths.length === 0) return true

  const IMAGE_EXTS_SET = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'])
  const imageFiles = filePaths.filter((fp) => IMAGE_EXTS_SET.has(path.extname(fp).replace('.', '').toLowerCase()))
  const nonImageFiles = filePaths.filter((fp) => !IMAGE_EXTS_SET.has(path.extname(fp).replace('.', '').toLowerCase()))

  // ── DeepSeek: web interface does NOT support image uploads ────────────────
  // DeepSeek's web UI only has a document uploader (📎 paperclip).  ALL image
  // attachment methods fail:
  //   - CDP file-input: opens Windows Explorer + shows "No text extracted"
  //   - clipboard paste: routes through document uploader → "No text extracted"
  //     AND blocks Send button with "Remove failed files to submit"
  //   - JS drop injection: duplicates + opens file dialog
  // For images, we skip attachment and return false so the caller uses the
  // text-extraction fallback (which is empty for images — DeepSeek gets
  // text-only).  Non-image document files (PDF, DOCX, etc.) still work via CDP.
  if (ai === 'deepseek' && imageFiles.length > 0) {
    sendLog('warn', `[file-attach] deepseek: web interface does not support image uploads — skipping ${imageFiles.length} image(s)`)

    // Attach non-image files via CDP (document uploader works for docs)
    if (nonImageFiles.length > 0) {
      const cdpResult = await attachFilesViaCDPFileInput(view, ai, nonImageFiles)
      if (!cdpResult) {
        sendLog('warn', `[file-attach] deepseek: CDP file-input failed for ${nonImageFiles.length} non-image file(s)`)
      }
    }

    // Return false to signal image attachment failed — caller will use text fallback
    return false
  }

  // ── Standard path: CDP file-input first, clipboard paste fallback ────────
  // ── Strategy A: CDP file-input approach ──────────────────────────────────
  if (ai === 'chatgpt') {
    const jsDropResult = await attachFilesViaJSDrop(view, ai, filePaths)
    if (jsDropResult) return true
    sendLog('info', `[file-attach] ${ai}: JS drop failed ??falling back to CDP file-input`)
  }

  const cdpResult = await attachFilesViaCDPFileInput(view, ai, filePaths)
  if (cdpResult) return true

  // ── Strategy B: clipboard paste fallback (images only) ───────────────────
  sendLog('info', `[file-attach] ${ai}: CDP file-input failed — trying clipboard paste fallback`)
  const pasteResult = await attachFilesViaClipboardPaste(view, ai, filePaths)
  if (pasteResult) return true

  sendLog('warn', `[file-attach] ${ai}: All attach strategies failed`)
  return false
}

/**
 * Strategy C (DeepSeek priority): Inject image via JavaScript drop/paste events.
 *
 * Reads the image file as base64, injects it into the page context as a File
 * object, and dispatches drop/paste events on the input area.  This bypasses
 * the native file dialog entirely and works reliably in Electron BrowserViews.
 */
async function attachFilesViaJSDrop(
  view: BrowserView,
  ai: AiName,
  filePaths: string[]
): Promise<boolean> {
  const config = getSelectors(ai)
  let successCount = 0

  try {
    // Ensure the input area is available
    const inputRes = await execWithFallback(
      view, config.inputSelectors,
      (sel) => `(() => { const el = document.querySelector(\`${sel}\`); if (el) { el.focus(); el.click(); return true; } return false; })()`
    )
    if (!inputRes.success) {
      sendLog('warn', `[file-attach] ${ai}: could not focus input for JS drop injection`)
      return false
    }
    await sleep(300)

    for (const filePath of filePaths) {
      try {
        const fileBuffer = fs.readFileSync(filePath)
        const base64 = fileBuffer.toString('base64')
        const mimeType = getMimeTypeForFile(filePath)
        const fileName = path.basename(filePath)

        const getAttachmentSnapshot = async () => {
          return await view.webContents.executeJavaScript(`
            (() => {
              const input = document.querySelector('#prompt-textarea')
                || document.querySelector('textarea')
                || document.querySelector('[contenteditable="true"]');
              const composer = input?.closest('form') || input?.parentElement || document.body;

              const isVisible = (el) => {
                if (!(el instanceof HTMLElement)) return false;
                const rect = el.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) return false;
                const style = window.getComputedStyle(el);
                return style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
              };

              const seenText = new Set();
              const names = [];
              let count = 0;
              for (const el of composer.querySelectorAll('*')) {
                if (!isVisible(el)) continue;
                const text = (el.textContent || '').trim();
                if (!text || text.length > 160) continue;
                if (!/[.][a-z0-9]{1,8}$/i.test(text)) continue;
                const normalized = text.toLowerCase();
                if (seenText.has(normalized)) continue;
                seenText.add(normalized);
                count += 1;
                names.push(normalized);
              }
              return { count, names };
            })()
          `).catch(() => ({ count: 0, names: [] as string[] }))
        }

        const baselineSnapshot = await getAttachmentSnapshot()

        const injectedPaste = await view.webContents.executeJavaScript(`
          (async () => {
            try {
              const base64 = ${JSON.stringify(base64)};
              const binaryStr = atob(base64);
              const bytes = new Uint8Array(binaryStr.length);
              for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
              const blob = new Blob([bytes], { type: ${JSON.stringify(mimeType)} });
              const file = new File([blob], ${JSON.stringify(fileName)}, { type: ${JSON.stringify(mimeType)}, lastModified: Date.now() });

              const inputArea = document.querySelector('#prompt-textarea')
                || document.querySelector('textarea#chat-input')
                || document.querySelector('textarea')
                || document.querySelector('[contenteditable="true"]')
                || document.querySelector('.chat-input')
                || document.activeElement;
              if (!inputArea) return 'no-input';

              const dt = new DataTransfer();
              dt.items.add(file);
              const pasteEvent = new ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
                clipboardData: dt
              });
              inputArea.dispatchEvent(pasteEvent);
              return 'paste-dispatched';
            } catch (err) {
              return 'error: ' + (err.message || String(err));
            }
          })()
        `)

        const waitForChip = async () => {
          const deadline = Date.now() + 5000
          while (Date.now() < deadline) {
            const snapshot = await getAttachmentSnapshot()
            const countIncreased = (snapshot?.count ?? 0) > (baselineSnapshot?.count ?? 0)
            const target = fileName.toLowerCase()
            const matchedName = Array.isArray(snapshot?.names)
              ? snapshot.names.some((text) => text.includes(target) || target.includes(text))
              : false
            if (countIncreased || matchedName) return true
            await sleep(250)
          }
          return false
        }

        let attached = await waitForChip()
        if (!attached && ai !== 'chatgpt') {
          const injectedDrop = await view.webContents.executeJavaScript(`
            (async () => {
              try {
                const base64 = ${JSON.stringify(base64)};
                const binaryStr = atob(base64);
                const bytes = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
                const blob = new Blob([bytes], { type: ${JSON.stringify(mimeType)} });
                const file = new File([blob], ${JSON.stringify(fileName)}, { type: ${JSON.stringify(mimeType)}, lastModified: Date.now() });

                const inputArea = document.querySelector('#prompt-textarea')
                  || document.querySelector('textarea#chat-input')
                  || document.querySelector('textarea')
                  || document.querySelector('[contenteditable="true"]')
                  || document.querySelector('.chat-input')
                  || document.activeElement;
                if (!inputArea) return 'no-input';

                const dt = new DataTransfer();
                dt.items.add(file);
                const seedTarget = inputArea.closest('form') || inputArea.parentElement || inputArea;
                seedTarget.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }));
                seedTarget.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));

                const isVisible = (el) => {
                  if (!(el instanceof HTMLElement)) return false;
                  const rect = el.getBoundingClientRect();
                  return rect.width > 0 && rect.height > 0;
                }
                const candidates = Array.from(document.querySelectorAll('div, section, form, [role="dialog"]'));
                const overlay = candidates.find((el) => {
                  const text = (el.textContent || '').toLowerCase();
                  return isVisible(el) && text.includes('drop any file here') && text.includes('conversation');
                });

                const dropTarget = overlay || seedTarget;
                dropTarget.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }));
                dropTarget.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
                dropTarget.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
                return overlay ? 'drop-overlay' : 'drop-seed';
              } catch (err) {
                return 'error: ' + (err.message || String(err));
              }
            })()
          `)
          sendLog('info', `[file-attach] ${ai}: JS drop fallback result for ${fileName}: ${injectedDrop}`)
          attached = await waitForChip()
        }

        if (!attached) {
          try {
            view.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' })
            view.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' })
          } catch {
            // best effort to dismiss drop overlay or duplicate modal
          }
        }

        if (attached) {
          if (ai === 'chatgpt') {
            await dismissChatgptUploadOverlay(view)
          }
          sendLog('info', `[file-attach] ${ai}: JS drop attached ${fileName} (${(fileBuffer.length / 1024).toFixed(0)}KB)`)
          successCount++
        } else {
          sendLog('warn', `[file-attach] ${ai}: JS drop did not create attachment chip for ${fileName}; paste=${injectedPaste}`)
        }
      } catch (err) {
        sendLog('warn', `[file-attach] ${ai}: JS drop failed for ${path.basename(filePath)}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    return successCount === filePaths.length && successCount > 0
  } catch (err) {
    sendLog('warn', `[file-attach] ${ai}: JS drop strategy failed: ${err instanceof Error ? err.message : String(err)}`)
    return false
  }
}

async function dismissChatgptUploadOverlay(view: BrowserView): Promise<void> {
  try {
    const result = await view.webContents.executeJavaScript(`
      (() => {
        const isVisible = (el) => {
          if (!(el instanceof HTMLElement)) return false;
          const rect = el.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return false;
          const style = window.getComputedStyle(el);
          return style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
        };

        const candidates = Array.from(document.querySelectorAll('div, section, form, [role="dialog"]'));
        const overlay = candidates.find((el) => {
          const text = (el.textContent || '').toLowerCase();
          return isVisible(el) && text.includes('add anything') && text.includes('drop any file here');
        });

        const duplicateDialog = candidates.find((el) => {
          const text = (el.textContent || '').toLowerCase();
          return isVisible(el) && text.includes('already uploaded this file');
        });

        let clickedOk = false;
        if (duplicateDialog) {
          const buttons = Array.from(duplicateDialog.querySelectorAll('button'));
          const okButton = buttons.find((btn) => isVisible(btn) && (btn.textContent || '').trim().toLowerCase() === 'ok');
          if (okButton instanceof HTMLElement) {
            okButton.click();
            clickedOk = true;
          }
        }

        const input = document.querySelector('#prompt-textarea')
          || document.querySelector('textarea')
          || document.querySelector('[contenteditable="true"]');
        if (input instanceof HTMLElement) {
          input.focus();
          input.click();
        }

        return {
          hadOverlay: !!overlay,
          hadDuplicateDialog: !!duplicateDialog,
          clickedOk,
        };
      })()
    `).catch(() => null)

    try {
      view.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' })
      view.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' })
    } catch {
      // best-effort only
    }

    await sleep(150)

    if (result?.hadOverlay || result?.hadDuplicateDialog) {
      sendLog('info', `[file-attach] chatgpt: dismissed upload overlay state ${JSON.stringify(result)}`)
    }
  } catch (err) {
    sendLog('warn', `[file-attach] chatgpt: failed to dismiss upload overlay: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * Wait for any active file uploads to complete.
 * Many AIs (especially ChatGPT) take time to process uploaded files and show
 * a spinner or progress bar. If we send the message before this finishes,
 * the send action either fails or the message is sent without the file.
 */
async function waitForFileUploadComplete(view: BrowserView, ai: AiName): Promise<void> {
  // ChatGPT document uploads can take noticeably longer than image chips.
  const maxWaitMs = ai === 'chatgpt' ? 90000 : 30000
  const pollIntervalMs = 500
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const isUploading = await view.webContents.executeJavaScript(`
        (() => {
          // Check for common progress indicators or spinners
          const loaders = document.querySelectorAll(
            '[role="progressbar"], ' + 
            'progress, ' +
            '.animate-spin, ' +
            'svg[class*="spin"], ' +
            '.spinner, ' + 
            '.loading, ' + 
            '[aria-busy="true"]'
          );
          
          if (loaders.length > 0) {
            // Filter out hidden loaders
            for (const el of loaders) {
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) return true;
            }
          }

          // For ChatGPT specifically: document uploads often show their spinner
          // only inside the attachment pill instead of a global progress bar.
          const chatgptPills = document.querySelectorAll('[data-testid^="file-"], [data-testid*="attachment"], [data-testid*="file-pill"]');
          for (const pill of chatgptPills) {
            const text = (pill.textContent || '').toLowerCase();
            if (/upload|processing|analy|index|extract|reading/.test(text)) {
              return true;
            }
            if (pill.querySelector('[role="progressbar"], progress, [aria-busy="true"], .animate-spin, svg[class*="spin"]')) {
              return true;
            }
          }

          return false;
        })()
      `)

      if (!isUploading) {
        // Additional small buffer after spinner disappears just to be safe
        await sleep(1000)
        return
      }

      await sleep(pollIntervalMs)
    } catch (err) {
      sendLog('warn', `[file-attach] ${ai}: error polling for upload status: ${err instanceof Error ? err.message : String(err)}`)
      break
    }
  }

  sendLog('warn', `[file-attach] ${ai}: timed out waiting for file upload to complete after ${maxWaitMs}ms`)
}

async function triggerFileInputEvents(
  dbg: Electron.Debugger,
  nodeId: number,
  ai: AiName
): Promise<void> {
  try {
    const resolved = await dbg.sendCommand('DOM.resolveNode', { nodeId }) as {
      object?: { objectId?: string }
    }
    const objectId = resolved?.object?.objectId
    if (!objectId) {
      sendLog('warn', `[file-attach] ${ai}: could not resolve file input node ${nodeId} for event dispatch`)
      return
    }

    const result = await dbg.sendCommand('Runtime.callFunctionOn', {
      objectId,
      returnByValue: true,
      functionDeclaration: `
        function() {
          const input = this;
          if (!(input instanceof HTMLInputElement)) {
            return { ok: false, reason: 'not-input' };
          }

          const fire = (type) => {
            const ev = new Event(type, { bubbles: true, cancelable: false, composed: true });
            input.dispatchEvent(ev);
          };

          // ChatGPT appears to react badly when we replay multiple upload-ish
          // signals. A single change event is enough for React-based uploaders.
          fire('change');

          return {
            ok: true,
            fileCount: input.files ? input.files.length : 0,
            firstFile: input.files && input.files[0] ? input.files[0].name : null,
            connected: !!input.isConnected,
            disabled: !!input.disabled,
          };
        }
      `,
    }) as { result?: { value?: unknown } }

    sendLog('info', `[file-attach] ${ai}: dispatched file input events on nodeId=${nodeId} result=${JSON.stringify(result?.result?.value ?? null)}`)

    try {
      await dbg.sendCommand('Runtime.releaseObject', { objectId })
    } catch {
      // best-effort cleanup
    }
  } catch (err) {
    sendLog('warn', `[file-attach] ${ai}: failed to dispatch file input events: ${err instanceof Error ? err.message : String(err)}`)
  }
}

function prepareUploadFilePaths(ai: AiName, filePaths: string[]): string[] {
  return filePaths
}

function shouldResetFileInputBeforeAttach(ai: AiName): boolean {
  // chatgpt: JS-drop strategy is used first; CDP reset is N/A.
  // claude: setFileInputFiles already fires a native change event.
  //         A redundant empty-reset triggers a spurious upload cycle
  //         that causes the file to appear twice in the composer.
  return ai !== 'chatgpt' && ai !== 'claude'
}

function shouldDispatchFileInputEvents(ai: AiName): boolean {
  // chatgpt: JS-drop strategy handles its own events.
  // claude: setFileInputFiles natively fires change; an extra manual
  //         dispatch causes Claude's React uploader to process the
  //         file a second time, resulting in duplicate attachment chips.
  return ai !== 'chatgpt' && ai !== 'claude'
}

function getMimeTypeForFile(filePath: string): string {
  const ext = path.extname(filePath).replace('.', '').toLowerCase()
  switch (ext) {
    case 'png': return 'image/png'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'webp': return 'image/webp'
    case 'gif': return 'image/gif'
    case 'bmp': return 'image/bmp'
    case 'pdf': return 'application/pdf'
    case 'txt': return 'text/plain'
    case 'md': return 'text/markdown'
    case 'csv': return 'text/csv'
    case 'json': return 'application/json'
    case 'doc': return 'application/msword'
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    case 'xls': return 'application/vnd.ms-excel'
    case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    case 'ppt': return 'application/vnd.ms-powerpoint'
    case 'pptx': return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    default: return 'application/octet-stream'
  }
}

/** Strategy A: Find <input type="file"> via CDP and set files on it. */
async function attachFilesViaCDPFileInput(
  view: BrowserView,
  ai: AiName,
  filePaths: string[]
): Promise<boolean> {
  const dbg = view.webContents.debugger
  const wasAlreadyAttached = dbg.isAttached()
  const uploadFilePaths = prepareUploadFilePaths(ai, filePaths)

  try {
    if (!wasAlreadyAttached) dbg.attach('1.3')

    const findFileInputs = async (): Promise<number[]> => {
      const { root } = await dbg.sendCommand('DOM.getDocument', { depth: -1 }) as { root: { nodeId: number } }
      const { nodeIds } = await dbg.sendCommand('DOM.querySelectorAll', {
        nodeId: root.nodeId,
        selector: 'input[type="file"]',
      }) as { nodeIds: number[] }
      return nodeIds ?? []
    }

    // Step 1: click the upload-trigger button to reveal <input type="file">
    const revealUploadInput = async () => {
      const selectors = FILE_UPLOAD_BUTTON_SELECTORS[ai] ?? []
      for (const selector of selectors) {
        try {
          const clicked = await executeWithTimeout(view.webContents, `
            (() => {
              const button = document.querySelector(${JSON.stringify(selector)});
              if (!(button instanceof HTMLElement)) return false;
              if (button.disabled) return false;
              if (button.getAttribute('aria-disabled') === 'true') return false;
              const rect = button.getBoundingClientRect();
              if (rect.width < 4 || rect.height < 4) return false;
              button.click();
              return true;
            })()
          `)
          if (!clicked) continue
          sendLog('info', `[file-attach] ${ai}: clicked upload trigger via ${selector}`)
          await sleep(900)

          // Check if file input already appeared
          let postClickInputs = await findFileInputs()
          if (postClickInputs.length > 0) return

          // Two-step: many composers open a menu → click an "Upload file" item
          sendLog('info', `[file-attach] ${ai}: no file input yet — trying menu item click`)
          try {
            await executeWithTimeout(view.webContents, `
              (() => {
                const KEY = /(upload from device|upload from this|upload file|upload image|attach file|from your device|from device|기기에서|업로드|파일 업로드|이미지 업로드)/i;
                const sels = ['[role="menuitem"]','[role="option"]','mat-menu-item','.mat-mdc-menu-item','li[role="menuitem"]','li','button','a','div[role="button"]'];
                const seen = new Set();
                for (const s of sels) {
                  for (const item of document.querySelectorAll(s)) {
                    if (seen.has(item)) continue; seen.add(item);
                    const t = (item.textContent||'').trim();
                    const aria = (item.getAttribute('aria-label')||'').trim();
                    if (t.length > 0 && t.length < 60 && (KEY.test(t) || KEY.test(aria))) {
                      item.click(); return true;
                    }
                  }
                }
                return false;
              })()
            `)
            sendLog('info', `[file-attach] ${ai}: clicked upload menu item (two-step reveal)`)
            await sleep(900)
            postClickInputs = await findFileInputs()
            if (postClickInputs.length > 0) return
          } catch { /* menu click optional */ }

          // Don't bail — the click might have hit an unrelated button.  Try
          // the next selector instead of returning early.
        } catch (err) {
          sendLog('warn', `[file-attach] ${ai}: selector ${selector} failed: ${err instanceof Error ? err.message : String(err)}`)
        }
      }

      // DeepSeek DOM heuristic: find the paperclip SVG icon button by position
      if (ai === 'deepseek') {
        try {
          const clicked = await executeWithTimeout(view.webContents, `
            (() => {
              const inputArea = document.querySelector('#chat-input, textarea');
              if (!inputArea) return false;
              const container = inputArea.closest('form') || inputArea.parentElement?.parentElement;
              if (!container) return false;
              const btns = container.querySelectorAll('.ds-icon-button, [class*="icon-button"]');
              for (const btn of btns) {
                const svg = btn.querySelector('svg');
                const text = btn.textContent?.trim() || '';
                if (svg && !text.includes('DeepThink') && !text.includes('Search') &&
                    !text.includes('搜索') && !text.includes('深度思考') && text.length < 3) {
                  btn.click(); return true;
                }
              }
              return false;
            })()
          `)
          if (clicked) {
            sendLog('info', `[file-attach] deepseek: clicked attachment via DOM heuristic`)
            await sleep(900)
          }
        } catch { /* ignore */ }
      }

      // Gemini DOM heuristic: find the "+" button near the input area
      if (ai === 'gemini') {
        try {
          const clicked = await executeWithTimeout(view.webContents, `
            (() => {
              const inputArea = document.querySelector('rich-textarea, div[contenteditable]');
              if (!inputArea) return false;
              const container = inputArea.closest('form') || inputArea.parentElement?.parentElement?.parentElement;
              if (!container) return false;
              for (const btn of container.querySelectorAll('button')) {
                const label = (btn.getAttribute('aria-label')||'').toLowerCase();
                const text = (btn.textContent||'').trim();
                if (text === '+' || text === '' || label.includes('add') || label.includes('upload') || label.includes('추가')) {
                  btn.click(); return true;
                }
              }
              return false;
            })()
          `)
          if (clicked) {
            sendLog('info', `[file-attach] gemini: clicked add button via DOM heuristic`)
            await sleep(900)
            // Now click the Upload file menu item
            try {
              await executeWithTimeout(view.webContents, `
                (() => {
                  for (const item of document.querySelectorAll('[role="menuitem"],[role="option"],button,li,a')) {
                    const t = (item.textContent||'').trim().toLowerCase();
                    if ((t.includes('upload') || t.includes('file') || t.includes('파일')) && t.length < 40) {
                      item.click(); return true;
                    }
                  }
                  return false;
                })()
              `)
              await sleep(900)
            } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
      }
    }

    let nodeIds = await findFileInputs()
    if (nodeIds.length === 0) {
      await revealUploadInput()
      nodeIds = await findFileInputs()
    }

    if (nodeIds.length === 0) {
      sendLog('warn', `[file-attach] ${ai}: No <input type="file"> found after reveal attempts`)
      return false
    }

    // Use the LAST input found.  When a trigger click mounts a fresh input,
    // it is appended to the document, so the last index is the most likely
    // active uploader (the first index is often a stale or hidden one used
    // for an avatar / settings picker elsewhere on the page).
    const targetNodeId = nodeIds[nodeIds.length - 1]
    sendLog('info', `[file-attach] ${ai}: setting files on input nodeId=${targetNodeId} (of ${nodeIds.length} candidate inputs)`)
    if (shouldResetFileInputBeforeAttach(ai)) {
      try {
        await dbg.sendCommand('DOM.setFileInputFiles', {
          nodeId: targetNodeId,
          files: [],
        })
      } catch {
        // Reset is best-effort. Some inputs reject empty resets through CDP.
      }
    }
    await dbg.sendCommand('DOM.setFileInputFiles', {
      nodeId: targetNodeId,
      files: uploadFilePaths,
    })
    if (shouldDispatchFileInputEvents(ai)) {
      await triggerFileInputEvents(dbg, targetNodeId, ai)
    }

    sendLog('info', `[file-attach] ${ai}: ${uploadFilePaths.length} file(s) attached via CDP`)
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

/**
 * Strategy B: Paste images via clipboard (Ctrl+V) as a universal fallback.
 * Works for any AI site that supports pasting images from clipboard.
 */
async function attachFilesViaClipboardPaste(
  view: BrowserView,
  ai: AiName,
  filePaths: string[]
): Promise<boolean> {
  const { clipboard, nativeImage } = require('electron')
  const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'])
  const imageFiles = filePaths.filter((fp) => IMAGE_EXTS.has(path.extname(fp).replace('.', '').toLowerCase()))
  if (imageFiles.length === 0) return false

  try {
    // Focus the input area
    const config = getSelectors(ai)
    const inputRes = await execWithFallback(
      view, config.inputSelectors,
      (sel) => `(() => { const el = document.querySelector(\`${sel}\`); if (el) { el.focus(); el.click(); return true; } return false; })()`
    )
    if (!inputRes.success) {
      sendLog('warn', `[file-attach] ${ai}: could not focus input for clipboard paste`)
      return false
    }
    // CRITICAL: Focus the BrowserView itself before dispatching keyboard input.
    try { view.webContents.focus() } catch { /* view may be detached */ }
    await sleep(300)

    for (const imgPath of imageFiles) {
      try {
        const image = nativeImage.createFromPath(imgPath)
        if (image.isEmpty()) { sendLog('warn', `[file-attach] ${ai}: nativeImage empty for ${path.basename(imgPath)}`); continue }
        clipboard.writeImage(image)
        await sleep(200)
        // Use Electron's built-in paste command — more reliable than sendInputEvent
        // for triggering Chromium's paste pipeline (which handles image clipboard data)
        view.webContents.paste()
        await sleep(2000)
        sendLog('info', `[file-attach] ${ai}: pasted ${path.basename(imgPath)} via clipboard`)
      } catch (err) {
        sendLog('warn', `[file-attach] ${ai}: clipboard paste failed for ${path.basename(imgPath)}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    return true
  } catch (err) {
    sendLog('warn', `[file-attach] ${ai}: clipboard paste strategy failed: ${err instanceof Error ? err.message : String(err)}`)
    return false
  }
}

// ─── File Content Extraction ──────────────────────────────────────────────────
const FILE_CONTENT_MAX_CHARS = 80_000   // ~40-50 pages — prevents token overflow
const IMAGE_FILE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'])

async function extractFileContent(filePath: string, ext: string): Promise<string> {
  // Images can't be meaningfully reduced to text — return empty so the caller
  // skips them and relies on attachFilesViaCDP / clipboard paste to deliver
  // the actual binary to the AI.  Without this, the prompt would otherwise
  // contain "[Unsupported file type: .png]" which confuses the AI into
  // thinking nothing was attached when in fact the upload pipeline succeeded.
  if (IMAGE_FILE_EXTS.has(ext)) return ''

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

const RELATION_STOP_WORDS = new Set([
  'about', 'after', 'again', 'all', 'also', 'another', 'because', 'before',
  'being', 'between', 'could', 'does', 'from', 'have', 'into', 'just', 'more',
  'only', 'over', 'same', 'some', 'than', 'that', 'their', 'them', 'then',
  'there', 'these', 'they', 'this', 'those', 'through', 'under', 'using',
  'very', 'want', 'what', 'when', 'where', 'which', 'while', 'with', 'would',
  'your', 'into', 'onto', 'need', 'make', 'made',
])

interface SessionRelationDecision {
  related: boolean
  scenario: 1 | 2 | 3 | 4 | 5
  reason: string
  overlapCount: number
  overlapRatio: number
}

interface AiSessionRelationResult {
  related: boolean
  confidence: number
  reason: string
}

function tokenizeForRelation(text: string, limit = 1600): string[] {
  return text
    .slice(0, limit)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !RELATION_STOP_WORDS.has(token))
}

function hasFollowUpLanguage(query: string): boolean {
  return /^(and|also|then|next|follow up|follow-up|what about|how about|can you|could you|please|based on|using that|in that case)\b/i.test(query.trim())
    || /\b(this|that|it|they|them|those|these|above|previous|earlier)\b/i.test(query)
}

function hasMetaContinuationLanguage(query: string): boolean {
  return /\b(shorter|longer|expand|deeper|clarify|rewrite|rephrase|improve|refine|polish|summarize|summarise|translate|compare|critique|review|fix|continue|elaborate|examples|turn this into|based on your answer|from your answer|using the answer)\b/i.test(query)
    || /\b(answer|response|draft|feedback|final answer|that explanation|that summary)\b/i.test(query)
}

function tokenizeSessionFileNames(currentSession: WorkflowSessionState): string[] {
  return currentSession.attachedFiles.flatMap((file) =>
    tokenizeForRelation(file.name.replace(/\.[^.]+$/, ''), 120)
  )
}

function classifySessionRelation(query: string, currentSession: WorkflowSessionState | null): SessionRelationDecision {
  if (!currentSession) {
    return {
      related: false,
      scenario: 5,
      reason: 'No active session exists',
      overlapCount: 0,
      overlapRatio: 0,
    }
  }

  const trimmed = query.trim()
  if (!trimmed) {
    return {
      related: true,
      scenario: 1,
      reason: 'Empty prompt means continue the current round',
      overlapCount: 0,
      overlapRatio: 0,
    }
  }

  const queryTokens = tokenizeForRelation(trimmed)
  if (queryTokens.length === 0) {
    return {
      related: true,
      scenario: 1,
      reason: 'Short prompt is treated as a continuation',
      overlapCount: 0,
      overlapRatio: 0,
    }
  }

  const contextTokens = new Set([
    ...tokenizeForRelation(currentSession.topicSeed),
    ...tokenizeForRelation(currentSession.lastUserQuery),
    ...tokenizeForRelation(currentSession.latestFinalAnswer),
    ...tokenizeSessionFileNames(currentSession),
  ])

  let overlapCount = 0
  for (const token of queryTokens) {
    if (contextTokens.has(token)) overlapCount++
  }

  const overlapRatio = overlapCount / Math.max(queryTokens.length, 1)
  const hasFollowUpCue = hasFollowUpLanguage(trimmed)
  const hasMetaCue = hasMetaContinuationLanguage(trimmed)
  const sessionFileTokens = new Set(tokenizeSessionFileNames(currentSession))
  const hasFileCue = queryTokens.some((token) => sessionFileTokens.has(token))

  // Scenario 1: explicit conversational follow-up markers
  if (hasFollowUpCue) {
    return {
      related: true,
      scenario: 1,
      reason: 'Explicit follow-up wording or pronoun reference to prior context',
      overlapCount,
      overlapRatio,
    }
  }

  // Scenario 2: refinement/meta request about the prior answer
  if (hasMetaCue && (currentSession.latestFinalAnswer.length > 0 || overlapCount >= 1)) {
    return {
      related: true,
      scenario: 2,
      reason: 'Meta request to revise, expand, compare, or improve the current answer',
      overlapCount,
      overlapRatio,
    }
  }

  // Scenario 3: topical continuity through shared anchor keywords
  if (overlapCount >= 2 && overlapRatio >= 0.25) {
    return {
      related: true,
      scenario: 3,
      reason: 'Shared topic keywords strongly overlap with the active session',
      overlapCount,
      overlapRatio,
    }
  }

  // Scenario 4: same project/file/artifact context even if phrasing changes
  if (hasFileCue || (currentSession.attachedFiles.length > 0 && overlapCount >= 1 && queryTokens.length <= 8)) {
    return {
      related: true,
      scenario: 4,
      reason: 'Query refers to the same file, artifact, or working context',
      overlapCount,
      overlapRatio,
    }
  }

  // Scenario 5: insufficient continuity, treat as a new topic
  return {
    related: false,
    scenario: 5,
    reason: 'Low continuity with the active session, so start a new conversation',
    overlapCount,
    overlapRatio,
  }
}

async function classifySessionRelationWithAi(
  query: string,
  currentSession: WorkflowSessionState | null,
  heuristicDecision: SessionRelationDecision
): Promise<AiSessionRelationResult | null> {
  if (!currentSession || !query.trim()) return null

  const apiKeys = store.get('apiKeys') as StoreSchema['apiKeys']
  const defaultOrder = ['chatgpt', 'claude', 'gemini', 'grok', 'deepseek', 'perplexity', 'kimi']
  const apiKeyOrder: string[] = (store.get('apiKeyOrder') as string[] | undefined) ?? defaultOrder

  const RELATION_PROMPT = `You are classifying whether a user's new message should continue the current AI conversation or start a brand-new session.

Return ONLY valid JSON:
{"related":true|false,"confidence":0.00-1.00,"reason":"one short sentence"}

Decision rules:
- related=true when the new message is a follow-up, refinement, continuation, same file/project/artifact, or clearly the same topic.
- related=false when it is a genuinely different topic and should reset the conversation.
- Be conservative about switching to a new session unless topic continuity is weak.

[Current Session Topic Seed]
${currentSession.topicSeed.slice(0, 500)}

[Last User Query]
${currentSession.lastUserQuery.slice(0, 500)}

[Latest Final Answer Excerpt]
${currentSession.latestFinalAnswer.slice(0, 1200)}

[Attached Files]
${currentSession.attachedFiles.map((file) => file.name).join(', ') || '(none)'}

[Heuristic Precheck]
related=${heuristicDecision.related}
scenario=${heuristicDecision.scenario}
reason=${heuristicDecision.reason}
overlapCount=${heuristicDecision.overlapCount}
overlapRatio=${heuristicDecision.overlapRatio.toFixed(2)}

[New User Message]
${query.slice(0, 500)}`

  const parseResult = (text: string): AiSessionRelationResult | null => {
    try {
      const jsonText = text.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim()
      const parsed = JSON.parse(jsonText) as Partial<AiSessionRelationResult>
      if (typeof parsed.related !== 'boolean') return null
      const confidence = Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.5)))
      const reason = String(parsed.reason ?? '').trim() || 'AI relation check'
      return { related: parsed.related, confidence, reason }
    } catch {
      return null
    }
  }

  for (const provider of apiKeyOrder) {
    const key = (apiKeys as Record<string, string | undefined>)?.[provider]
    if (!key) continue

    try {
      let responseText = ''

      if (provider === 'gemini') {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: RELATION_PROMPT }] }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 200 },
            }),
          }
        )
        if (res.ok) {
          const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
          responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        }
      } else if (provider === 'claude') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 200,
            messages: [{ role: 'user', content: RELATION_PROMPT }],
          }),
        })
        if (res.ok) {
          const data = await res.json() as { content?: Array<{ text?: string }> }
          responseText = data?.content?.[0]?.text ?? ''
        }
      } else if (provider === 'chatgpt') {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 200,
            temperature: 0.1,
            messages: [{ role: 'user', content: RELATION_PROMPT }],
          }),
        })
        if (res.ok) {
          const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
          responseText = data?.choices?.[0]?.message?.content ?? ''
        }
      } else if (provider === 'deepseek') {
        const res = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: 'llama3-8b-8192',
            max_tokens: 200,
            temperature: 0.1,
            messages: [{ role: 'user', content: RELATION_PROMPT }],
          }),
        })
        if (res.ok) {
          const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
          responseText = data?.choices?.[0]?.message?.content ?? ''
        }
      } else {
        continue
      }

      const parsed = responseText ? parseResult(responseText) : null
      if (parsed) {
        sendLog('info', `[session-ai] ${provider} -> related=${parsed.related} confidence=${parsed.confidence.toFixed(2)} reason=${parsed.reason}`)
        return parsed
      }
    } catch (err) {
      sendLog('warn', `[session-ai] ${provider} failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return null
}

async function resolveSessionRelationDecision(
  query: string,
  currentSession: WorkflowSessionState | null
): Promise<SessionRelationDecision & { aiVerification?: AiSessionRelationResult | null; finalSource: 'heuristic' | 'ai-confirmed' | 'ai-overrode' }> {
  const heuristicDecision = classifySessionRelation(query, currentSession)
  const aiVerification = await classifySessionRelationWithAi(query, currentSession, heuristicDecision)

  if (!aiVerification) {
    return { ...heuristicDecision, aiVerification: null, finalSource: 'heuristic' }
  }

  if (aiVerification.related === heuristicDecision.related) {
    return {
      ...heuristicDecision,
      reason: `${heuristicDecision.reason}; AI agreed: ${aiVerification.reason}`,
      aiVerification,
      finalSource: 'ai-confirmed',
    }
  }

  const shouldAiOverride = aiVerification.confidence >= 0.88
  if (shouldAiOverride) {
    return {
      ...heuristicDecision,
      related: aiVerification.related,
      scenario: aiVerification.related ? heuristicDecision.scenario : 5,
      reason: `${heuristicDecision.reason}; AI override: ${aiVerification.reason}`,
      aiVerification,
      finalSource: 'ai-overrode',
    }
  }

  return {
    ...heuristicDecision,
    reason: `${heuristicDecision.reason}; AI disagreed with low confidence: ${aiVerification.reason}`,
    aiVerification,
    finalSource: 'ai-confirmed',
  }
}

async function resetConversationThreads(targetAis: AiName[] = AI_NAMES): Promise<void> {
  for (const ai of targetAis) {
    const view = views.get(ai)
    if (!view) continue
    try {
      await navigateToNewChat(view, ai)
      markViewThreadOwner(ai, null)
      delete councilRoom.threadPrepared[ai]
    } catch (err) {
      sendLog('warn', `[session] Failed to reset ${ai}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}

function markSessionParticipant(ai: AiName): void {
  if (!workflowSession) return
  if (!workflowSession.participants.includes(ai)) {
    workflowSession.participants.push(ai)
  }
}

async function collectReviewerFeedbacksForAnswer(params: {
  currentPrimary: AiName
  query: string
  answerUnderReview: string
  hasFiles: boolean
  attachedFiles: WorkflowAttachment[]
  fileContext: string
}): Promise<Array<{ ai: AiName; feedback: string }>> {
  const { currentPrimary, query, answerUnderReview, hasFiles, attachedFiles, fileContext } = params
  const activeReviewers = enabledAiNames.filter((n) => n !== currentPrimary)

  sendStatus(MSG.sendingReviews())
  sendLog('info', `[Step 5] Injecting review requests to: ${activeReviewers.join(', ')}`)

  const filePaths = hasFiles ? attachedFiles.map((f) => f.path) : []

  const reviewPromises = activeReviewers.map(async (reviewerName) => {
    const reviewerView = views.get(reviewerName)!
    const reviewerConfig = getSelectors(reviewerName)

    const needsReset = !doesWorkflowOwnThread(reviewerName)
    if (needsReset) {
      sendLog('info', `[Step 5] Preparing fresh reviewer thread for ${reviewerName}`)
      await navigateToNewChat(reviewerView, reviewerName)
      markViewThreadOwner(reviewerName, 'workflow')
    } else {
      sendLog('info', `[Step 5] Reusing existing reviewer thread for ${reviewerName}`)
    }

    const inputRes = await execWithFallback(
      reviewerView,
      reviewerConfig.inputSelectors,
      (sel) => `!!document.querySelector(\`${sel}\`)`
    )

    if (!inputRes.success) {
      sendLog('error', `[Step 5] ${reviewerName}: Input box not found, skipping feedback`)
      return { ai: reviewerName as AiName, feedback: '' }
    }

    let filesAttached = false
    if (hasFiles && filePaths.length > 0) {
      sendLog('info', `[Step 5] ${reviewerName}: Attempting CDP file attach (${filePaths.length} file(s))`)
      filesAttached = await attachFilesViaCDP(reviewerView, reviewerName, filePaths)
      if (!filesAttached) {
        sendLog('warn', `[Step 5] ${reviewerName}: File attach failed, falling back to text method`)
        reviewerView.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' })
        reviewerView.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' })
        await sleep(400)
      }
    }

    const prompt = buildReviewerPromptV2(
      reviewerName,
      query,
      answerUnderReview,
      filesAttached ? '' : fileContext
    )

    sendLog('info', `[Step 5] ${reviewerName}: Starting prompt paste`)
    await pasteText(reviewerView, prompt, inputRes.selector!, reviewerName)

    const reviewerBaseline = await captureCurrentText(
      reviewerView,
      reviewerConfig.responseContainerSelectors
    )
    sendLog('info', `[Step 5] ${reviewerName}: Pre-send baseline captured (${reviewerBaseline.length} chars)`)

    await sleep(REVIEWER_SEND_DELAY_MS)

    const sent = await clickSend(reviewerView, reviewerConfig.sendButtonSelectors, reviewerName)
    sendLog('info', `[Step 5] ${reviewerName}: Send ${sent ? 'succeeded' : 'failed'}`)

    sendStatus(MSG.waitingReviewer(reviewerName))
    await sleep(INITIAL_RESPONSE_WAIT_MS)
    const rawFeedback = await waitForStableResponse(
      reviewerView,
      reviewerConfig.responseContainerSelectors,
      WORKFLOW_TIMEOUT_MS,
      STABLE_RESPONSE_MS,
      reviewerName,
      reviewerBaseline
    ).catch((err) => {
      sendLog('warn', `${reviewerName} timeout: ${err.message}`)
      return ''
    })

    const feedback = reviewerName === 'claude'
      ? sanitizeClaudeFeedback(rawFeedback)
      : rawFeedback

    markSessionParticipant(reviewerName)
    mainWindow?.webContents.send('feedback-ready', { ai: reviewerName, feedback })
    return { ai: reviewerName as AiName, feedback }
  })

  sendStatus(MSG.collectingFeedbacks())
  sendLog('info', '[Step 6] Collecting reviewer feedbacks')
  return Promise.all(reviewPromises)
}

async function requestFinalRevisionFromPrimary(params: {
  currentPrimary: AiName
  query: string
  answerUnderReview: string
  feedbackResults: Array<{ ai: AiName; feedback: string }>
  hasFiles: boolean
  attachedFiles: WorkflowAttachment[]
}): Promise<string> {
  const { currentPrimary, query, answerUnderReview, feedbackResults, hasFiles, attachedFiles } = params
  const finalPrimaryConfig = getSelectors(currentPrimary)
  const finalPrimaryView = views.get(currentPrimary)!

  sendStatus(MSG.sendingRevision(currentPrimary))
  sendLog('info', `[Step 7] Sending final revision prompt to ${currentPrimary}`)

  if (!doesWorkflowOwnThread(currentPrimary)) {
    sendLog('info', `[Step 7] Preparing fresh workflow thread for ${currentPrimary}`)
    await navigateToNewChat(finalPrimaryView, currentPrimary)
    markViewThreadOwner(currentPrimary, 'workflow')
  }

  const attachedFileNames = hasFiles ? attachedFiles.map((f) => f.name) : []
  const finalPrompt = buildFinalRevisionPromptV2(
    query,
    answerUnderReview,
    feedbackResults,
    hasFiles,
    attachedFileNames
  )

  const finalInputRes = await execWithFallback(
    finalPrimaryView,
    finalPrimaryConfig.inputSelectors,
    (sel) => `!!document.querySelector(\`${sel}\`)`
  )

  if (!finalInputRes.success) {
    throw new Error(`Could not find ${currentPrimary} input box for final revision request.`)
  }

  const finalBaseline = await captureCurrentText(
    finalPrimaryView,
    finalPrimaryConfig.responseContainerSelectors
  )
  sendLog('info', `[Step 7] Final baseline captured (${finalBaseline.length} chars)`)

  await pasteText(finalPrimaryView, finalPrompt, finalInputRes.selector!, currentPrimary)
  await sleep(CLICK_SEND_DELAY_MS)
  await clickSend(finalPrimaryView, finalPrimaryConfig.sendButtonSelectors, currentPrimary)

  sendStatus(MSG.waitingFinal(currentPrimary))
  sendLog('info', `[Step 8] Waiting ${INITIAL_RESPONSE_WAIT_MS}ms before polling...`)
  await sleep(INITIAL_RESPONSE_WAIT_MS)

  const finalAnswer = await waitForStableResponse(
    finalPrimaryView,
    finalPrimaryConfig.responseContainerSelectors,
    WORKFLOW_TIMEOUT_MS,
    STABLE_RESPONSE_MS,
    currentPrimary,
    finalBaseline
  )

  markSessionParticipant(currentPrimary)
  return finalAnswer
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
  'accounts.google.com',       // Google OAuth
  'oauth2.googleapis.com',
  'accounts.youtube.com',
  'auth0.com',                 // Auth0 SSO
  'cdn.auth0.com',
  'login.microsoftonline.com', // Microsoft / Azure AD SSO
  'login.live.com',
  'twitter.com',               // X/Twitter auth
  'api.twitter.com',
  'abs.twimg.com',
  'appleid.apple.com',         // Apple Sign-In
  'apple.com',
  'github.com',                // GitHub OAuth
  'discord.com',               // Discord OAuth
  'claude.ai',                 // Claude OAuth return
  'chatgpt.com',               // ChatGPT OAuth return
  'openai.com',
  'auth.openai.com',
  'perplexity.ai',             // Perplexity OAuth return
  'grok.com',                  // Grok OAuth return
  'chat.deepseek.com',          // DeepSeek chat / login
  'x.com',                     // X (Twitter) SSO for Grok login
  'api.x.com',
  'abs.twimg.com',             // X/Twitter static assets (login UI)
  'pbs.twimg.com',
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
            // Full Chrome spoofing: Google OAuth popups must be treated the same 
            // so accounts.google.com can bypass Electron detection.
            webPreferences: {
              partition,
              preload: CHROME_SPOOF_PRELOAD,
              contextIsolation: false,   // Required for MAIN world injection
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

  // Explicitly set UA immediately after OAuth popup creation
  // (partition's setUserAgent already applies, but this is a belt-and-suspenders approach)
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

// --- Telegram API exports ---
export function apiResetCouncilRoom(participants?: AiName[], primaryAi?: AiName) {
  return resetCouncilRoomContext(participants, primaryAi ?? councilRoom.primaryAi)
}

export function apiGetCouncilRoom() {
  if (councilRoom.messages.length === 0) {
    return resetCouncilRoomContext(councilRoom.participants, councilRoom.primaryAi)
  }
  return cloneCouncilRoomState()
}

export function apiSaveCouncilSnapshot(title?: string) {
  const baseRoom = loadPersistedCouncilRoomFromSnapshot(councilRoom)
  const roomState: CouncilRoomState = {
    participants: [...baseRoom.participants],
    primaryAi: baseRoom.primaryAi,
    status: 'idle',
    pendingAi: null,
    messages: baseRoom.messages.map((message) => ({ ...message, pending: false })),
    lastIntent: baseRoom.lastIntent ? { ...baseRoom.lastIntent } : null,
    failedTurn: baseRoom.failedTurn ? { ...baseRoom.failedTurn } : null,
  }
  const uiState = sanitizeCouncilUiState(store.get('councilUiState'))
  const insight = sanitizeCouncilSnapshotInsight(undefined)
  const snapshots = getCouncilSnapshots()
  const activeSnapshotId = getActiveCouncilSnapshotId()
  const existingActiveSnapshot = activeSnapshotId
    ? snapshots.find((snapshot) => snapshot.id === activeSnapshotId)
    : null
  const nextSnapshot: CouncilSnapshotRecord = sanitizeCouncilSnapshotRecord({
    id: existingActiveSnapshot?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: typeof title === 'string' && title.trim().length > 0
      ? title.trim()
      : existingActiveSnapshot?.title ?? defaultCouncilSnapshotTitle(roomState),
    label: existingActiveSnapshot?.label ?? null,
    note: existingActiveSnapshot?.note ?? null,
    savedAt: Date.now(),
    lastOpenedAt: existingActiveSnapshot?.lastOpenedAt ?? Date.now(),
    messageCount: roomState.messages.length,
    isFavorite: existingActiveSnapshot?.isFavorite ?? false,
    isArchived: existingActiveSnapshot?.isArchived ?? false,
    lifecycle: existingActiveSnapshot?.lifecycle ?? 'in-progress',
    room: roomState,
    uiState,
    insight,
  })
  const nextSnapshots = existingActiveSnapshot
    ? [nextSnapshot, ...snapshots.filter((snapshot) => snapshot.id !== existingActiveSnapshot.id)].slice(0, 24)
    : [nextSnapshot, ...snapshots].slice(0, 24)
  persistCouncilSnapshots(nextSnapshots)
  setActiveCouncilSnapshotId(nextSnapshot.id)
  return summarizeCouncilSnapshots(getCouncilSnapshots())
}

export function apiGetCouncilSnapshots() {
  return summarizeCouncilSnapshots(getCouncilSnapshots())
}

export function apiLoadCouncilSnapshot(snapshotId: string) {
  const snapshots = getCouncilSnapshots()
  const snapshot = snapshots.find((item) => item.id === snapshotId)
  if (!snapshot) return null

  const nextSnapshots = snapshots.map((item) =>
    item.id === snapshotId
      ? sanitizeCouncilSnapshotRecord({
          ...item,
          lastOpenedAt: Date.now(),
        })
      : item
  )
  persistCouncilSnapshots(nextSnapshots)
  const hydratedSnapshot = nextSnapshots.find((item) => item.id === snapshotId) ?? snapshot

  const runtime = loadPersistedCouncilRoomFromSnapshot(hydratedSnapshot.room)
  councilRoom = runtime
  enabledAiNames = [...runtime.participants]
  setActiveCouncilSnapshotId(hydratedSnapshot.id)
  store.set('councilRoomSnapshot', cloneCouncilRoomState())
  store.set('councilUiState', sanitizeCouncilUiState(hydratedSnapshot.uiState))
  updateViewBounds()
  emitCouncilRoomUpdate()

  return {
    room: cloneCouncilRoomState(),
    uiState: sanitizeCouncilUiState(hydratedSnapshot.uiState),
  }
}

export async function apiSendCouncilMessage(text: string, attachedFiles: Array<{ name: string; path: string; ext: string }> = []) {
  const payload = { text, participants: councilRoom.participants, primaryAi: councilRoom.primaryAi }
  const trimmedText = typeof payload?.text === 'string' ? payload.text.trim() : ''
  if (!trimmedText) return cloneCouncilRoomState()

  const councilAttachedFiles = attachedFiles.filter((f) => typeof f.path === 'string' && f.path.length > 0)
  const councilFilePaths = councilAttachedFiles.map((f) => f.path)

  syncCouncilRoomContext(payload.participants, payload.primaryAi)
  clearFailedCouncilTurn()
  const userMessage = makeCouncilMessage('user', trimmedText)
  councilRoom.messages.push(userMessage)
  councilRoom.lastIntent = parseCouncilIntent(trimmedText)
  emitCouncilRoomUpdate()

  const intent = councilRoom.lastIntent
  if (!intent || intent.kind === 'none') {
    councilRoom.messages.push(
      makeCouncilMessage(
        'system',
        'Saved to the shared transcript. Mention one active AI like @Gemini, or use @all to broadcast in parallel.'
      )
    )
    emitCouncilRoomUpdate()
    return cloneCouncilRoomState()
  }

  if (intent.kind === 'unsupported') {
    councilRoom.messages.push(
      makeCouncilMessage(
        'system',
        intent.note,
        { error: true }
      )
    )
    emitCouncilRoomUpdate()
    return cloneCouncilRoomState()
  }

  // Multi-mention path: parser sets intent.targetAis to the user's explicit
  // list (in mention order).  Pure @all (no specific list) fans out to every
  // active participant — every target receives the SAME prompt in parallel.
  const targets = intent.kind === 'all'
    ? (intent.targetAis && intent.targetAis.length > 0
        ? intent.targetAis
        : getSequentialCouncilTargets(councilRoom.participants, councilRoom.primaryAi))
    : intent.targetAi
      ? [intent.targetAi]
      : []

  if (targets.length === 0) {
    councilRoom.messages.push(
      makeCouncilMessage(
        'system',
        'No valid active AI target was found for this message.',
        { error: true }
      )
    )
    emitCouncilRoomUpdate()
    return cloneCouncilRoomState()
  }

  const inactiveTarget = targets.find((ai) => !councilRoom.participants.includes(ai))
  if (inactiveTarget) {
    councilRoom.messages.push(
      makeCouncilMessage(
        'system',
        `${AI_DISPLAY_NAMES[inactiveTarget]} is not active right now. Activate that AI first, then try again.`,
        { error: true }
      )
    )
    emitCouncilRoomUpdate()
    return cloneCouncilRoomState()
  }

  if (intent.kind === 'all' && targets.length > 1) {
    councilRoom.messages.push(
      makeCouncilMessage(
        'system',
        `Broadcasting in parallel to ${targets.map((ai) => AI_DISPLAY_NAMES[ai]).join(', ')}. Each AI receives the same prompt with a summary of the previous round's answers.`
      )
    )
    emitCouncilRoomUpdate()
  }

  await runCouncilBroadcast(targets, trimmedText, councilFilePaths, councilAttachedFiles)

  return cloneCouncilRoomState()
}

export function apiSwitchInteractionModeToWorkflow() {
  return handoffInteractionMode('workflow', councilRoom.participants, councilRoom.primaryAi)
}

export function apiGetPrimaryAi() {
  return councilRoom.primaryAi
}

export let telegramAiReplyCallback: ((aiName: string, text: string) => void) | null = null
export function setTelegramAiReplyCallback(cb: (aiName: string, text: string) => void) {
  telegramAiReplyCallback = cb
}

// ─── Pre-flight session health check ─────────────────────────────────────────
// Probes whether each target AI's BrowserView has a usable composer (input
// selector present in the DOM).  When an AI is logged out / hit a captcha /
// stuck on a billing wall, the input selector won't render — letting Telegram
// flows fail fast rather than wait for the full broadcast timeout.
export type AiSessionHealth = 'ok' | 'unavailable' | 'no-view'
export async function apiCheckAiSessions(targets: AiName[]): Promise<Record<string, AiSessionHealth>> {
  const result: Record<string, AiSessionHealth> = {}
  await Promise.all(
    targets.map(async (ai) => {
      const view = views.get(ai)
      if (!view) {
        result[ai] = 'no-view'
        return
      }
      try {
        const inputSelectors = getSelectors(ai).inputSelectors
        const found = await Promise.race([
          view.webContents.executeJavaScript(`
            (() => {
              const sels = ${JSON.stringify(inputSelectors)};
              for (const s of sels) {
                try {
                  const el = document.querySelector(s);
                  if (el instanceof HTMLElement) {
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) return true;
                  }
                } catch (e) {}
              }
              return false;
            })()
          `),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000)),
        ])
        result[ai] = found ? 'ok' : 'unavailable'
      } catch (err) {
        sendLog('warn', `[health-check] ${ai}: ${err instanceof Error ? err.message : String(err)}`)
        result[ai] = 'unavailable'
      }
    })
  )
  return result
}

import { startTelegramBridge, getTelegramConfig, setTelegramConfig } from './telegram/bridge.js'

// Start Telegram Bridge if enabled
startTelegramBridge()

ipcMain.handle('get-telegram-config', () => {
  return getTelegramConfig()
})

ipcMain.handle('set-telegram-config', (_e, config) => {
  return setTelegramConfig(config)
})


