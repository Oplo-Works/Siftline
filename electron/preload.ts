import { contextBridge, ipcRenderer } from 'electron'
import type { AiName } from '../src/types.js'

export type { AiName } from '../src/types.js'

export interface WorkflowResult {
  success: boolean
  finalAnswer?: string
  feedbacks?: Array<{ ai: AiName; feedback: string }>
  error?: string
}

export interface LogEntry {
  level: 'info' | 'warn' | 'error'
  msg: string
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

export interface CouncilRoomState {
  participants: AiName[]
  primaryAi: AiName
  status: 'idle' | 'running'
  pendingAi: AiName | null
  messages: CouncilMessage[]
  lastIntent: {
    kind: 'mention' | 'all' | 'none' | 'unsupported'
    targetAi?: AiName
    targetAis?: AiName[]
    note: string
  } | null
  failedTurn: {
    ai: AiName
    promptText: string
    errorMessage: string
  } | null
}

export interface CouncilUiState {
  pinnedCandidateIds: string[]
  selectedCandidateId: string | null
}

export interface WorkflowCouncilBridgeResult {
  room: CouncilRoomState
  bridged: boolean
  note: string
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

contextBridge.exposeInMainWorld('electronAPI', {
  getAiList: (): Promise<AiName[]> => ipcRenderer.invoke('get-ai-list'),
  getHistory: () => ipcRenderer.invoke('get-history'),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  reloadAi: (ai: AiName) => ipcRenderer.invoke('reload-ai', ai),
  openViewDevTools: (ai: AiName) => ipcRenderer.invoke('open-view-devtools', ai),

  startWorkflow: (params: {
    primaryAi: AiName
    query: string
    attachedFiles?: Array<{ name: string; path: string; ext: string }>
  }): Promise<WorkflowResult> => ipcRenderer.invoke('start-workflow', params),

  workflowProceed: (decision?: { primaryAi?: AiName }): Promise<void> =>
    ipcRenderer.invoke('workflow-proceed', decision),

  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  saveFile: (params: { content: string; defaultName: string; ext: string }) =>
    ipcRenderer.invoke('save-file', params),

  getLoginStatus: (): Promise<Record<AiName, boolean>> =>
    ipcRenderer.invoke('get-login-status'),
  openLoginWindow: (ai: AiName) =>
    ipcRenderer.invoke('open-login-window', ai),
  logoutAi: (ai: AiName) =>
    ipcRenderer.invoke('logout-ai', ai),
  logoutAll: () =>
    ipcRenderer.invoke('logout-all'),
  onLoginStatusChanged: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('login-status-changed', handler)
    return () => ipcRenderer.removeListener('login-status-changed', handler)
  },

  getApiKeys: (): Promise<Partial<Record<AiName, string>> & { deepseek?: string }> =>
    ipcRenderer.invoke('get-api-keys'),
  setApiKeys: (keys: Partial<Record<AiName, string>> & { deepseek?: string }): Promise<boolean> =>
    ipcRenderer.invoke('set-api-keys', keys),

  getApiKeyOrder: (): Promise<string[]> =>
    ipcRenderer.invoke('get-api-key-order'),
  setApiKeyOrder: (order: string[]): Promise<boolean> =>
    ipcRenderer.invoke('set-api-key-order', order),

  analyzeQuery: (query: string): Promise<{
    recommended: AiName
    reason: string
    roundSuggestions: Array<{ ai: AiName; reason: string }>
  } | null> => ipcRenderer.invoke('analyze-query', query),

  setEnabledAis: (ais: AiName[]) =>
    ipcRenderer.invoke('set-enabled-ais', ais),
  setAttachmentBarVisible: (visible: boolean) =>
    ipcRenderer.invoke('set-attachment-bar-visible', visible),
  setFinalPanelExpanded: (expanded: boolean) =>
    ipcRenderer.invoke('set-final-panel-expanded', expanded),

  getCouncilRoom: (): Promise<CouncilRoomState> => ipcRenderer.invoke('get-council-room'),
  getCouncilUiState: (): Promise<CouncilUiState> => ipcRenderer.invoke('get-council-ui-state'),
  setCouncilUiState: (state: CouncilUiState): Promise<CouncilUiState> => ipcRenderer.invoke('set-council-ui-state', state),
  getCouncilSnapshots: (): Promise<CouncilSnapshotSummary[]> => ipcRenderer.invoke('get-council-snapshots'),
  saveCouncilSnapshot: (payload: { room: CouncilRoomState; uiState: CouncilUiState; title?: string; insight?: Partial<CouncilSnapshotInsight> }): Promise<CouncilSnapshotSummary[]> =>
    ipcRenderer.invoke('save-council-snapshot', payload),
  loadCouncilSnapshot: (snapshotId: string): Promise<{ room: CouncilRoomState; uiState: CouncilUiState } | null> =>
    ipcRenderer.invoke('load-council-snapshot', snapshotId),
  toggleCouncilSnapshotFavorite: (snapshotId: string): Promise<CouncilSnapshotSummary[]> =>
    ipcRenderer.invoke('toggle-council-snapshot-favorite', snapshotId),
  renameCouncilSnapshot: (snapshotId: string, title: string): Promise<CouncilSnapshotSummary[]> =>
    ipcRenderer.invoke('rename-council-snapshot', snapshotId, title),
  annotateCouncilSnapshot: (snapshotId: string, meta: { label?: string | null; note?: string | null }): Promise<CouncilSnapshotSummary[]> =>
    ipcRenderer.invoke('annotate-council-snapshot', snapshotId, meta),
  toggleCouncilSnapshotLifecycle: (snapshotId: string): Promise<CouncilSnapshotSummary[]> =>
    ipcRenderer.invoke('toggle-council-snapshot-lifecycle', snapshotId),
  toggleCouncilSnapshotArchived: (snapshotId: string): Promise<CouncilSnapshotSummary[]> =>
    ipcRenderer.invoke('toggle-council-snapshot-archived', snapshotId),
  exportCouncilSnapshot: (snapshotId: string): Promise<CouncilSnapshotTransferResult> =>
    ipcRenderer.invoke('export-council-snapshot', snapshotId),
  importCouncilSnapshot: (): Promise<{ snapshots: CouncilSnapshotSummary[]; importedTitle?: string }> =>
    ipcRenderer.invoke('import-council-snapshot'),
  duplicateCouncilSnapshot: (snapshotId: string): Promise<CouncilSnapshotSummary[]> =>
    ipcRenderer.invoke('duplicate-council-snapshot', snapshotId),
  deleteCouncilSnapshot: (snapshotId: string): Promise<CouncilSnapshotSummary[]> =>
    ipcRenderer.invoke('delete-council-snapshot', snapshotId),
  syncCouncilRoomContext: (payload: { participants: AiName[]; primaryAi: AiName }): Promise<CouncilRoomState> =>
    ipcRenderer.invoke('sync-council-room-context', payload),
  sendCouncilMessage: (payload: {
    text: string
    participants: AiName[]
    primaryAi: AiName
    attachedFiles?: Array<{ name: string; path: string; ext: string }>
  }): Promise<CouncilRoomState> =>
    ipcRenderer.invoke('send-council-message', payload),
  bridgeWorkflowToCouncil: (payload: { participants: AiName[]; primaryAi: AiName }): Promise<WorkflowCouncilBridgeResult> =>
    ipcRenderer.invoke('bridge-workflow-to-council', payload),
  resetCouncilRoom: (payload?: { participants?: AiName[]; primaryAi?: AiName }): Promise<CouncilRoomState> =>
    ipcRenderer.invoke('reset-council-room', payload),
  retryCouncilTurn: (): Promise<CouncilRoomState> => ipcRenderer.invoke('retry-council-turn'),
  skipCouncilTurn: (): Promise<CouncilRoomState> => ipcRenderer.invoke('skip-council-turn'),
  setCouncilChatVisible: (visible: boolean) =>
    ipcRenderer.invoke('set-council-chat-visible', visible),
  getFocusSplitRatio: (): Promise<number> => ipcRenderer.invoke('get-focus-split-ratio'),
  setFocusSplitRatio: (ratio: number): Promise<number> =>
    ipcRenderer.invoke('set-focus-split-ratio', ratio),
  switchInteractionMode: (payload: { mode: 'workflow' | 'chat'; participants: AiName[]; primaryAi: AiName }): Promise<CouncilRoomState> =>
    ipcRenderer.invoke('switch-interaction-mode', payload),

  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  setViewsVisible: (v: boolean) => ipcRenderer.invoke('set-views-visible', v),

  getTelegramConfig: () => ipcRenderer.invoke('get-telegram-config'),
  setTelegramConfig: (config: any) => ipcRenderer.invoke('set-telegram-config', config),

  onStatusUpdate: (cb: (msg: string) => void) => {
    const handler = (_: unknown, msg: string) => cb(msg)
    ipcRenderer.on('status-update', handler)
    return () => ipcRenderer.removeListener('status-update', handler)
  },
  onLog: (cb: (entry: LogEntry) => void) => {
    const handler = (_: unknown, entry: LogEntry) => cb(entry)
    ipcRenderer.on('log', handler)
    return () => ipcRenderer.removeListener('log', handler)
  },
  onViewLoaded: (cb: (data: { ai: AiName }) => void) => {
    const handler = (_: unknown, data: { ai: AiName }) => cb(data)
    ipcRenderer.on('view-loaded', handler)
    return () => ipcRenderer.removeListener('view-loaded', handler)
  },
  onViewLoadError: (cb: (data: { ai: AiName; errCode: number; errDesc: string }) => void) => {
    const handler = (_: unknown, data: { ai: AiName; errCode: number; errDesc: string }) => cb(data)
    ipcRenderer.on('view-load-error', handler)
    return () => ipcRenderer.removeListener('view-load-error', handler)
  },
  onDraftReady: (cb: (data: { ai: AiName; draft: string }) => void) => {
    const handler = (_: unknown, data: { ai: AiName; draft: string }) => cb(data)
    ipcRenderer.on('draft-ready', handler)
    return () => ipcRenderer.removeListener('draft-ready', handler)
  },
  onFeedbackReady: (cb: (data: { ai: AiName; feedback: string }) => void) => {
    const handler = (_: unknown, data: { ai: AiName; feedback: string }) => cb(data)
    ipcRenderer.on('feedback-ready', handler)
    return () => ipcRenderer.removeListener('feedback-ready', handler)
  },
  onWaitingForUser: (cb: (data: { stage: 'after-draft' | 'after-reviews' }) => void) => {
    const handler = (_: unknown, data: { stage: 'after-draft' | 'after-reviews' }) => cb(data)
    ipcRenderer.on('workflow-waiting', handler)
    return () => ipcRenderer.removeListener('workflow-waiting', handler)
  },
  onCouncilRoomUpdate: (cb: (room: CouncilRoomState) => void) => {
    const handler = (_: unknown, room: CouncilRoomState) => cb(room)
    ipcRenderer.on('council-room-updated', handler)
    return () => ipcRenderer.removeListener('council-room-updated', handler)
  },
  onCouncilStreamChunk: (cb: (data: { ai: AiName; messageId: string; text: string }) => void) => {
    const handler = (_: unknown, data: { ai: AiName; messageId: string; text: string }) => cb(data)
    ipcRenderer.on('council-stream-chunk', handler)
    return () => ipcRenderer.removeListener('council-stream-chunk', handler)
  },
})
