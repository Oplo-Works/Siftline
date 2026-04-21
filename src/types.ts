export type AiName = 'gemini' | 'claude' | 'chatgpt' | 'perplexity' | 'grok'

export interface AttachedFile {
  name: string
  path: string
  ext: string   // lowercase, e.g. 'pdf', 'docx', 'xlsx', 'txt', 'csv', 'md'
}

export interface ParsedFileContent {
  name: string
  ext: string
  content: string
}

export interface WorkflowResult {
  success: boolean
  finalAnswer?: string
  feedbacks?: Array<{ ai: AiName; feedback: string }>
  fileContents?: ParsedFileContent[]
  error?: string
}

/**
 * Tracks which manual gate the UI is currently at.
 * - 'idle'           : workflow not running
 * - 'running'        : workflow running automatically (no user action needed)
 * - 'waiting-next'   : Primary AI answered; button should show "Next"
 * - 'waiting-continue': Reviewers done; button should show "Continue"
 */
export type WorkflowStage = 'idle' | 'running' | 'waiting-next' | 'waiting-continue'

export interface LogEntry {
  level: 'info' | 'warn' | 'error'
  msg: string
}

export interface HistoryItem {
  id: string
  query: string
  primaryAi: AiName
  result: string
  timestamp: number
}

export interface AiRecommendation {
  recommended: AiName
  reason: string
  roundSuggestions: Array<{ ai: AiName; reason: string }>
}

export interface AiPanelState {
  name: AiName
  loaded: boolean
  error: boolean
  feedback: string
  role: 'primary' | 'reviewer' | 'idle'
}

export interface AppState {
  primaryAi: AiName
  query: string
  status: string
  isRunning: boolean
  panels: AiPanelState[]
  draftAnswer: string
  finalAnswer: string
  logs: LogEntry[]
  history: HistoryItem[]
  showHistory: boolean
}

export const AI_DISPLAY_NAMES: Record<AiName, string> = {
  gemini: 'Gemini',
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  grok: 'Grok',
}

export const AI_COLORS: Record<AiName, { primary: string; glow: string; badge: string }> = {
  gemini: { primary: '#4285f4', glow: 'rgba(66,133,244,0.35)', badge: '#4285f4' },
  claude: { primary: '#cc785c', glow: 'rgba(204,120,92,0.35)', badge: '#cc785c' },
  chatgpt: { primary: '#10a37f', glow: 'rgba(16,163,127,0.35)', badge: '#10a37f' },
  perplexity: { primary: '#20b2aa', glow: 'rgba(32,178,170,0.35)', badge: '#20b2aa' },
  grok: { primary: '#7c3aed', glow: 'rgba(124,58,237,0.35)', badge: '#7c3aed' },
}

export const AI_ICONS: Record<AiName, string> = {
  gemini: '✦',
  claude: '◎',
  chatgpt: '⊕',
  perplexity: '◈',
  grok: '⚡',
}

/** UI status messages — centralised for easy editing/i18n */
export const STATUS_MESSAGES = {
  INITIAL: 'Loading AI websites... Please log in to each service.',
  WORKFLOW_START: 'Starting workflow...',
  WORKFLOW_DONE: '✅ Done! Final answer is ready.',
  NO_QUERY: '❗ Please enter a question.',
  injecting: (ai: AiName) => `Typing question into ${ai}...`,
  sending: (ai: AiName) => `Sending question to ${ai}...`,
  waitingPrimary: (ai: AiName) => `${ai} is generating a response... (up to 2 min)`,
  sendingReviews: () => 'Sending review requests to reviewer AIs...',
  waitingReviewer: (ai: AiName) => `Waiting for ${ai}'s review...`,
  collectingFeedbacks: () => 'Collecting feedback from all reviewers...',
  sendingRevision: (ai: AiName) => `Sending final revision request to ${ai}...`,
  waitingFinal: (ai: AiName) => `Waiting for ${ai}'s final revised answer...`,
  error: (msg: string) => `❌ Error: ${msg}`,
} as const

declare global {
  interface Window {
    electronAPI: {
      getAiList: () => Promise<AiName[]>
      getHistory: () => Promise<HistoryItem[]>
      clearHistory: () => Promise<boolean>
      reloadAi: (ai: AiName) => Promise<boolean>
      openViewDevTools: (ai: AiName) => Promise<boolean>
      startWorkflow: (params: {
        primaryAi: AiName
        query: string
        attachedFiles?: AttachedFile[]
      }) => Promise<WorkflowResult>
      workflowProceed: (decision?: { primaryAi?: AiName }) => Promise<void>
      openFileDialog: () => Promise<AttachedFile[]>
      saveFile: (params: {
        content: string
        defaultName: string
        ext: string
      }) => Promise<{ saved: boolean; filePath?: string }>
      getLoginStatus: () => Promise<Record<AiName, boolean>>
      openLoginWindow: (ai: AiName) => Promise<boolean>
      logoutAi: (ai: AiName) => Promise<boolean>
      logoutAll: () => Promise<boolean>
      onLoginStatusChanged: (cb: () => void) => () => void
      getApiKeys: () => Promise<Partial<Record<AiName, string>> & { groq?: string }>
      setApiKeys: (keys: Partial<Record<AiName, string>> & { groq?: string }) => Promise<boolean>
      getApiKeyOrder: () => Promise<string[]>
      setApiKeyOrder: (order: string[]) => Promise<boolean>
      analyzeQuery: (query: string) => Promise<AiRecommendation | null>
      setEnabledAis: (ais: AiName[]) => Promise<boolean>
      setAttachmentBarVisible: (visible: boolean) => Promise<void>
      setFinalPanelExpanded: (expanded: boolean) => Promise<void>
      minimize: () => Promise<void>
      maximize: () => Promise<void>
      close: () => Promise<void>
      setViewsVisible: (v: boolean) => Promise<void>
      onStatusUpdate: (cb: (msg: string) => void) => () => void
      onLog: (cb: (entry: LogEntry) => void) => () => void
      onViewLoaded: (cb: (data: { ai: AiName }) => void) => () => void
      onViewLoadError: (cb: (data: { ai: AiName; errCode: number; errDesc: string }) => void) => () => void
      onDraftReady: (cb: (data: { ai: AiName; draft: string }) => void) => () => void
      onFeedbackReady: (cb: (data: { ai: AiName; feedback: string }) => void) => () => void
      onWaitingForUser: (cb: (data: { stage: 'after-draft' | 'after-reviews' }) => void) => () => void
    }
  }
}
