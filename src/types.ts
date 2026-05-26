export type AiName = 'chatgpt' | 'claude' | 'gemini' | 'grok' | 'deepseek' | 'perplexity' | 'kimi'

export interface TelegramConfig {
  enabled: boolean
  botToken: string
  chatId: string
  /** Comma-separated additional whitelisted chat IDs.  Empty = only `chatId` is allowed. */
  allowedChatIds?: string
  lastUpdateId: number
}

export type InteractionMode = 'workflow' | 'chat'

export interface AttachedFile {
  name: string
  path: string
  ext: string
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

export type WorkflowStage = 'idle' | 'running' | 'waiting-next' | 'waiting-continue' | 'ready-next-round'

export interface LogEntry {
  level: 'info' | 'warn' | 'error'
  msg: string
  timestamp?: number
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

export interface AiRolePreset {
  title: string
  detail: string
}

export interface CouncilMessage {
  id: string
  kind: 'user' | 'assistant' | 'system'
  text: string
  createdAt: number
  source?: 'chat' | 'workflow-bridge'
  ai?: AiName
  pending?: boolean
  error?: boolean
}

export interface CouncilIntentState {
  kind: 'mention' | 'all' | 'none' | 'unsupported'
  targetAi?: AiName
  targetAis?: AiName[]
  note: string
}

export interface CouncilFailedTurn {
  ai: AiName
  promptText: string
  errorMessage: string
}

export interface CouncilRoomState {
  participants: AiName[]
  primaryAi: AiName
  status: 'idle' | 'running'
  pendingAi: AiName | null
  messages: CouncilMessage[]
  lastIntent: CouncilIntentState | null
  failedTurn: CouncilFailedTurn | null
}

export interface CouncilSendPayload {
  text: string
  participants: AiName[]
  primaryAi: AiName
  attachedFiles?: AttachedFile[]
}

export interface WorkflowCouncilBridgeResult {
  room: CouncilRoomState
  bridged: boolean
  note: string
}

export interface CouncilContextPayload {
  participants: AiName[]
  primaryAi: AiName
}

export interface CouncilUiState {
  pinnedCandidateIds: string[]
  selectedCandidateId: string | null
}

export interface CouncilSnapshotInsight {
  workflowReady: boolean
  workflowPreview: string | null
  moderatorConsensus: string | null
  moderatorNextSpeaker: AiName | null
  moderatorNextPrompt: string | null
}

export type CouncilSnapshotLifecycle = 'in-progress' | 'completed'

export interface CouncilSnapshotSummary {
  id: string
  title: string
  label: string | null
  note: string | null
  savedAt: number
  lastOpenedAt: number
  messageCount: number
  isActive: boolean
  isDirty: boolean
  isFavorite: boolean
  isArchived: boolean
  lifecycle: CouncilSnapshotLifecycle
  primaryAi: AiName
  participants: AiName[]
  insight: CouncilSnapshotInsight
}

export interface CouncilSnapshotTransferResult {
  ok: boolean
  title?: string
  filePath?: string
  reason?: string
}

export interface CouncilSnapshotPayload {
  room: CouncilRoomState
  uiState: CouncilUiState
  insight?: Partial<CouncilSnapshotInsight>
}

export const AI_NAMES: AiName[] = ['chatgpt', 'claude', 'deepseek', 'gemini', 'grok', 'kimi', 'perplexity']

export const DEFAULT_ENABLED_AIS: AiName[] = ['chatgpt', 'claude', 'gemini']

export const AI_DISPLAY_NAMES: Record<AiName, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
  grok: 'Grok',
  deepseek: 'DeepSeek',
  perplexity: 'Perplexity',
  kimi: 'Kimi',
}

export const AI_COLORS: Record<AiName, { primary: string; glow: string; badge: string }> = {
  chatgpt: { primary: '#10a37f', glow: 'rgba(16,163,127,0.35)', badge: '#10a37f' },
  claude: { primary: '#cc785c', glow: 'rgba(204,120,92,0.35)', badge: '#cc785c' },
  gemini: { primary: '#4285f4', glow: 'rgba(66,133,244,0.35)', badge: '#4285f4' },
  grok: { primary: '#7c3aed', glow: 'rgba(124,58,237,0.35)', badge: '#7c3aed' },
  deepseek: { primary: '#4D6BFE', glow: 'rgba(77,107,254,0.35)', badge: '#4D6BFE' },
  perplexity: { primary: '#20b2aa', glow: 'rgba(32,178,170,0.35)', badge: '#20b2aa' },
  kimi: { primary: '#1d6dff', glow: 'rgba(29,109,255,0.35)', badge: '#1d6dff' },
}

export const AI_ICONS: Record<AiName, string> = {
  chatgpt: 'C',
  claude: 'A',
  gemini: 'G',
  grok: 'X',
  deepseek: 'D',
  perplexity: 'P',
  kimi: 'K',
}

export const AI_ROLE_PRESETS: Record<AiName, AiRolePreset> = {
  chatgpt: {
    title: 'Versatile Creative Generalist',
    detail: 'Brings broad versatility to writing, brainstorming, coding, and general tasks — refines framing, tone, and practical clarity for any audience.',
  },
  claude: {
    title: 'Long-Document Analyst',
    detail: 'Delivers careful drafting, deep analysis, and nuanced reasoning for contracts, summaries, and complex long-form content.',
  },
  gemini: {
    title: 'Multimodal Context Synthesizer',
    detail: 'Synthesizes large bodies of context with multimodal awareness — integrating text, data, and long-document patterns across complex workflows.',
  },
  grok: {
    title: 'Real-Time Reality Critic',
    detail: 'Stress-tests assumptions against current events, social dynamics, trending cultural context, and real-world failure modes.',
  },
  deepseek: {
    title: 'Technical Reasoning Solver',
    detail: 'Re-derives logic, math, code, and systems problems from first principles for precise, efficient technical answers.',
  },
  perplexity: {
    title: 'Source-Grounded Verifier',
    detail: 'Verifies factual claims with citations, distinguishes evidence from inference, and grounds every assertion in current, credible sources.',
  },
  kimi: {
    title: 'Long-Context Deep Analyst',
    detail: 'Processes and synthesizes large documents and extended-context research, surfacing insights that limited-context reviewers would miss.',
  },
}

export const STATUS_MESSAGES = {
  INITIAL: 'Loading AI websites... Please log in to each service.',
  WORKFLOW_START: 'Starting workflow...',
  WORKFLOW_DONE: 'Done! Final answer is ready.',
  NO_QUERY: 'Please enter a question.',
  injecting: (ai: AiName) => `Typing question into ${ai}...`,
  sending: (ai: AiName) => `Sending question to ${ai}...`,
  waitingPrimary: (ai: AiName) => `${ai} is generating a response... (up to 2 min)`,
  sendingReviews: () => 'Sending review requests to reviewer AIs...',
  waitingReviewer: (ai: AiName) => `Waiting for ${ai}'s review...`,
  collectingFeedbacks: () => 'Collecting feedback from all reviewers...',
  sendingRevision: (ai: AiName) => `Sending final revision request to ${ai}...`,
  waitingFinal: (ai: AiName) => `Waiting for ${ai}'s final revised answer...`,
  error: (msg: string) => `Error: ${msg}`,
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
      getApiKeys: () => Promise<Partial<Record<AiName, string>> & { deepseek?: string }>
      setApiKeys: (keys: Partial<Record<AiName, string>> & { deepseek?: string }) => Promise<boolean>
      getApiKeyOrder: () => Promise<string[]>
      setApiKeyOrder: (order: string[]) => Promise<boolean>
      analyzeQuery: (query: string) => Promise<AiRecommendation | null>
      setEnabledAis: (ais: AiName[]) => Promise<boolean>
      setAttachmentBarVisible: (visible: boolean) => Promise<void>
      setFinalPanelExpanded: (expanded: boolean) => Promise<void>
      getCouncilRoom: () => Promise<CouncilRoomState>
      getCouncilUiState: () => Promise<CouncilUiState>
      setCouncilUiState: (state: CouncilUiState) => Promise<CouncilUiState>
      getCouncilSnapshots: () => Promise<CouncilSnapshotSummary[]>
      saveCouncilSnapshot: (payload: CouncilSnapshotPayload & { title?: string }) => Promise<CouncilSnapshotSummary[]>
      loadCouncilSnapshot: (snapshotId: string) => Promise<CouncilSnapshotPayload | null>
      toggleCouncilSnapshotFavorite: (snapshotId: string) => Promise<CouncilSnapshotSummary[]>
      renameCouncilSnapshot: (snapshotId: string, title: string) => Promise<CouncilSnapshotSummary[]>
      annotateCouncilSnapshot: (snapshotId: string, meta: {
        label?: string | null
        note?: string | null
      }) => Promise<CouncilSnapshotSummary[]>
      toggleCouncilSnapshotLifecycle: (snapshotId: string) => Promise<CouncilSnapshotSummary[]>
      toggleCouncilSnapshotArchived: (snapshotId: string) => Promise<CouncilSnapshotSummary[]>
      exportCouncilSnapshot: (snapshotId: string) => Promise<CouncilSnapshotTransferResult>
      importCouncilSnapshot: () => Promise<{
        snapshots: CouncilSnapshotSummary[]
        importedTitle?: string
      }>
      duplicateCouncilSnapshot: (snapshotId: string) => Promise<CouncilSnapshotSummary[]>
      deleteCouncilSnapshot: (snapshotId: string) => Promise<CouncilSnapshotSummary[]>
      syncCouncilRoomContext: (payload: CouncilContextPayload) => Promise<CouncilRoomState>
      sendCouncilMessage: (payload: CouncilSendPayload) => Promise<CouncilRoomState>
      bridgeWorkflowToCouncil: (payload: {
        participants: AiName[]
        primaryAi: AiName
      }) => Promise<WorkflowCouncilBridgeResult>
      resetCouncilRoom: (payload?: Partial<CouncilContextPayload>) => Promise<CouncilRoomState>
      retryCouncilTurn: () => Promise<CouncilRoomState>
      skipCouncilTurn: () => Promise<CouncilRoomState>
      setCouncilChatVisible: (visible: boolean) => Promise<void>
      switchInteractionMode: (payload: {
        mode: InteractionMode
        participants: AiName[]
        primaryAi: AiName
      }) => Promise<CouncilRoomState>
      minimize: () => Promise<void>
      maximize: () => Promise<void>
      close: () => Promise<void>
      setViewsVisible: (v: boolean) => Promise<void>
      getTelegramConfig: () => Promise<TelegramConfig>
      setTelegramConfig: (config: Partial<TelegramConfig>) => Promise<TelegramConfig>
      onStatusUpdate: (cb: (msg: string) => void) => () => void
      onLog: (cb: (entry: LogEntry) => void) => () => void
      onViewLoaded: (cb: (data: { ai: AiName }) => void) => () => void
      onViewLoadError: (cb: (data: { ai: AiName; errCode: number; errDesc: string }) => void) => () => void
      onDraftReady: (cb: (data: { ai: AiName; draft: string }) => void) => () => void
      onFeedbackReady: (cb: (data: { ai: AiName; feedback: string }) => void) => () => void
      onWaitingForUser: (cb: (data: { stage: 'after-draft' | 'after-reviews' }) => void) => () => void
      onCouncilRoomUpdate: (cb: (room: CouncilRoomState) => void) => () => void
      onCouncilStreamChunk: (cb: (data: { ai: AiName; messageId: string; text: string }) => void) => () => void
    }
  }
}
