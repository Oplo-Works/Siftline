import { contextBridge, ipcRenderer } from 'electron'

export type AiName = 'gemini' | 'claude' | 'chatgpt' | 'perplexity' | 'grok'

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

// Expose a safe, typed API to the renderer via window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', {
  // Queries
  getAiList: (): Promise<AiName[]> => ipcRenderer.invoke('get-ai-list'),
  getHistory: () => ipcRenderer.invoke('get-history'),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  reloadAi: (ai: AiName) => ipcRenderer.invoke('reload-ai', ai),
  openViewDevTools: (ai: AiName) => ipcRenderer.invoke('open-view-devtools', ai),

  // Workflow
  startWorkflow: (params: {
    primaryAi: AiName
    query: string
    attachedFiles?: Array<{ name: string; path: string; ext: string }>
  }): Promise<WorkflowResult> => ipcRenderer.invoke('start-workflow', params),

  // Proceed past a workflow pause point (Next / Continue buttons).
  // Optionally pass a new primaryAi to reassign the Primary AI at the pause point.
  workflowProceed: (decision?: { primaryAi?: AiName }): Promise<void> =>
    ipcRenderer.invoke('workflow-proceed', decision),

  // File attachment
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  saveFile: (params: { content: string; defaultName: string; ext: string }) =>
    ipcRenderer.invoke('save-file', params),
  // Accounts
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

  // API Keys — stored in electron-store (never sent anywhere except the designated AI API)
  getApiKeys: (): Promise<Partial<Record<AiName, string>> & { groq?: string }> =>
    ipcRenderer.invoke('get-api-keys'),
  setApiKeys: (keys: Partial<Record<AiName, string>> & { groq?: string }): Promise<boolean> =>
    ipcRenderer.invoke('set-api-keys', keys),

  getApiKeyOrder: (): Promise<string[]> =>
    ipcRenderer.invoke('get-api-key-order'),
  setApiKeyOrder: (order: string[]): Promise<boolean> =>
    ipcRenderer.invoke('set-api-key-order', order),

  // Real-time query analysis → Primary AI recommendation
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

  // Window controls
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  setViewsVisible: (v: boolean) => ipcRenderer.invoke('set-views-visible', v),

  // Event listeners (return cleanup function)
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

  // Fired when the workflow pauses and waits for the user to click Next/Continue
  // stage: 'after-draft'   → Primary AI answered; waiting for Next
  //        'after-reviews' → Reviewers done; waiting for Continue
  onWaitingForUser: (cb: (data: { stage: 'after-draft' | 'after-reviews' }) => void) => {
    const handler = (_: unknown, data: { stage: 'after-draft' | 'after-reviews' }) => cb(data)
    ipcRenderer.on('workflow-waiting', handler)
    return () => ipcRenderer.removeListener('workflow-waiting', handler)
  },
})
