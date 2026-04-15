import { useState, useEffect, useCallback, useRef } from 'react'
import {
  AiName,
  AiPanelState,
  AttachedFile,
  ParsedFileContent,
  LogEntry,
  HistoryItem,
  WorkflowStage,
  AI_DISPLAY_NAMES,
  AI_COLORS,
  AI_ICONS,
} from './types'
import TitleBar from './components/TitleBar'
import Toolbar from './components/Toolbar'
import StatusBar from './components/StatusBar'
import PanelGrid from './components/PanelGrid'
import FinalResultPanel from './components/FinalResultPanel'
import LogDrawer from './components/LogDrawer'
import HistoryDrawer from './components/HistoryDrawer'
import AccountsPanel from './components/AccountsPanel'

const AI_NAMES: AiName[] = ['gemini', 'claude', 'chatgpt', 'perplexity', 'grok']
const LOG_MAX_ITEMS = 200

function initPanels(): AiPanelState[] {
  return AI_NAMES.map((name) => ({
    name,
    loaded: false,
    error: false,
    feedback: '',
    role: 'idle' as const,
  }))
}

export default function App() {
  const [primaryAi, setPrimaryAi] = useState<AiName>('gemini')
  const [enabledAis, setEnabledAis] = useState<AiName[]>([...AI_NAMES])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('Loading AI websites... Please log in to each service.')
  const [isRunning, setIsRunning] = useState(false)
  const [workflowStage, setWorkflowStage] = useState<WorkflowStage>('idle')
  const [panels, setPanels] = useState<AiPanelState[]>(initPanels)
  const [draftAnswer, setDraftAnswer] = useState('')
  const [finalAnswer, setFinalAnswer] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [fileContents, setFileContents] = useState<ParsedFileContent[]>([])
  const [finalPanelExpanded, setFinalPanelExpanded] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [showLogs, setShowLogs] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showAccounts, setShowAccounts] = useState(false)
  const isRunningRef = useRef(false)

  const addLog = useCallback((entry: LogEntry) => {
    setLogs((prev) => [{ ...entry, msg: `[${new Date().toLocaleTimeString()}] ${entry.msg}` }, ...prev].slice(0, LOG_MAX_ITEMS))
  }, [])

  // ── Register IPC listeners ────────────────────────────────────────────────
  useEffect(() => {
    const cleanups: Array<() => void> = []

    cleanups.push(
      window.electronAPI.onStatusUpdate((msg) => setStatus(msg))
    )

    cleanups.push(
      window.electronAPI.onLog((entry) => addLog(entry))
    )

    cleanups.push(
      window.electronAPI.onViewLoaded(({ ai }) => {
        setPanels((prev) =>
          prev.map((p) => (p.name === ai ? { ...p, loaded: true, error: false } : p))
        )
        setStatus((s) =>
          s.includes('Loading') ? `${AI_DISPLAY_NAMES[ai]} loaded` : s
        )
      })
    )

    cleanups.push(
      window.electronAPI.onViewLoadError(({ ai, errDesc }) => {
        setPanels((prev) =>
          prev.map((p) => (p.name === ai ? { ...p, error: true } : p))
        )
        addLog({ level: 'error', msg: `${ai} load error: ${errDesc}` })
      })
    )

    cleanups.push(
      window.electronAPI.onDraftReady(({ ai, draft }) => {
        setDraftAnswer(draft)
        addLog({ level: 'info', msg: `[${AI_DISPLAY_NAMES[ai]}] Draft ready (${draft.length} chars)` })
      })
    )

    cleanups.push(
      window.electronAPI.onFeedbackReady(({ ai, feedback }) => {
        setPanels((prev) =>
          prev.map((p) => (p.name === ai ? { ...p, feedback } : p))
        )
        addLog({ level: 'info', msg: `[${AI_DISPLAY_NAMES[ai]}] Feedback ready (${feedback.length} chars)` })
      })
    )

    cleanups.push(
      window.electronAPI.onWaitingForUser(({ stage }) => {
        if (stage === 'after-draft') setWorkflowStage('waiting-next')
        else if (stage === 'after-reviews') setWorkflowStage('waiting-continue')
      })
    )

    // Load history
    window.electronAPI.getHistory().then(setHistory)

    return () => cleanups.forEach((fn) => fn())
  }, [addLog])

  // ── Notify main process when enabled AIs change ──────────────────────────
  const handleEnabledAisChange = useCallback((ais: AiName[]) => {
    // Primary AI must always be in the enabled list
    const next = ais.includes(primaryAi) ? ais : [primaryAi, ...ais]
    setEnabledAis(next)
    window.electronAPI.setEnabledAis(next)
  }, [primaryAi])

  // ── Notify main process when attachment bar visibility changes ────────────
  useEffect(() => {
    window.electronAPI.setAttachmentBarVisible(attachedFiles.length > 0)
  }, [attachedFiles.length])

  // ── Update panel roles when primaryAi changes ────────────────────────────
  useEffect(() => {
    setPanels((prev) =>
      prev.map((p) => ({
        ...p,
        role: isRunningRef.current
          ? p.name === primaryAi
            ? 'primary'
            : 'reviewer'
          : 'idle',
      }))
    )
    // Ensure primary AI is always in the enabled list
    setEnabledAis((prev) => {
      if (prev.includes(primaryAi)) return prev
      const next = [primaryAi, ...prev]
      window.electronAPI.setEnabledAis(next)
      return next
    })
  }, [primaryAi])

  // ── File attachment handlers ─────────────────────────────────────────────
  const handleAttach = useCallback(async () => {
    const files = await window.electronAPI.openFileDialog()
    if (files.length === 0) return
    setAttachedFiles((prev) => {
      // deduplicate by path
      const existing = new Set(prev.map((f) => f.path))
      const newFiles = files.filter((f) => !existing.has(f.path))
      return [...prev, ...newFiles]
    })
  }, [])

  const handleRemoveFile = useCallback((index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // ── Start workflow ────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    if (!query.trim()) {
      setStatus('❗ Please enter a question.')
      return
    }
    if (isRunning) return

    setIsRunning(true)
    isRunningRef.current = true
    setWorkflowStage('running')
    setDraftAnswer('')
    setFinalAnswer('')
    setFileContents([])
    setStatus('Starting workflow...')

    // Update roles
    setPanels((prev) =>
      prev.map((p) => ({
        ...p,
        feedback: '',
        role: p.name === primaryAi ? 'primary' : 'reviewer',
      }))
    )

    try {
      const result = await window.electronAPI.startWorkflow({
        primaryAi,
        query,
        attachedFiles: attachedFiles.length > 0 ? attachedFiles : undefined,
      })
      if (result.success && result.finalAnswer) {
        setFinalAnswer(result.finalAnswer)
        setFileContents(result.fileContents ?? [])
        // Auto-expand the final panel so user sees the result
        setFinalPanelExpanded(true)
        window.electronAPI.setFinalPanelExpanded(true)
        // refresh history
        window.electronAPI.getHistory().then(setHistory)
      } else {
        setStatus(`❌ Error: ${result.error}`)
      }
    } finally {
      setIsRunning(false)
      isRunningRef.current = false
      setWorkflowStage('idle')
      setPanels((prev) => prev.map((p) => ({ ...p, role: 'idle' })))
    }
  }, [query, primaryAi, isRunning, attachedFiles])

  const handleReloadAi = useCallback((ai: AiName) => {
    window.electronAPI.reloadAi(ai)
    setPanels((prev) =>
      prev.map((p) => (p.name === ai ? { ...p, loaded: false, error: false } : p))
    )
  }, [])

  // ── Proceed past a workflow pause point (Next / Continue) ────────────────
  const handleProceed = useCallback(() => {
    setWorkflowStage('running')
    window.electronAPI.workflowProceed()
  }, [])

  const handleDevTools = useCallback((ai: AiName) => {
    window.electronAPI.openViewDevTools(ai)
  }, [])

  const handleToggleFinalPanel = useCallback(() => {
    setFinalPanelExpanded((prev) => {
      const next = !prev
      window.electronAPI.setFinalPanelExpanded(next)
      return next
    })
  }, [])

  const handleClearHistory = useCallback(async () => {
    await window.electronAPI.clearHistory()
    setHistory([])
  }, [])

  return (
    <div className="app-root">
      {/* Custom title bar */}
      <TitleBar
        onMinimize={() => window.electronAPI.minimize()}
        onMaximize={() => window.electronAPI.maximize()}
        onClose={() => window.electronAPI.close()}
        onToggleAccounts={() => {
          const next = !showAccounts
          setShowAccounts(next)
          // BrowserViews always render on top of HTML — hide them so the panel
          // is not covered (same approach used for Logs / History drawers)
          window.electronAPI.setViewsVisible(!next)
        }}
        onToggleLogs={() => {
          const next = !showLogs
          setShowLogs(next)
          if (next) setShowHistory(false)
          window.electronAPI.setViewsVisible(!next)
        }}
        onToggleHistory={() => {
          const next = !showHistory
          setShowHistory(next)
          if (next) setShowLogs(false)
          window.electronAPI.setViewsVisible(!next)
        }}
        logCount={logs.length}
        historyCount={history.length}
        showAccounts={showAccounts}
      />

      {/* Toolbar: primary AI selector + query input + attach + start */}
      <Toolbar
        primaryAi={primaryAi}
        enabledAis={enabledAis}
        query={query}
        isRunning={isRunning}
        workflowStage={workflowStage}
        attachedFiles={attachedFiles}
        onPrimaryAiChange={setPrimaryAi}
        onEnabledAisChange={handleEnabledAisChange}
        onQueryChange={setQuery}
        onAttach={handleAttach}
        onRemoveFile={handleRemoveFile}
        onStart={handleStart}
        onProceed={handleProceed}
      />

      {/* Status bar */}
      <StatusBar status={status} isRunning={isRunning} />

      {/* Panel headers — only show enabled AIs */}
      <PanelGrid
        panels={panels.filter((p) => enabledAis.includes(p.name))}
        primaryAi={primaryAi}
        onReload={handleReloadAi}
        onDevTools={handleDevTools}
        draftAnswer={draftAnswer}
      />

      {/* Spacer for BrowserViews */}
      <div className="browser-view-spacer" />

      {/* Final result panel — collapsible */}
      <FinalResultPanel
        finalAnswer={finalAnswer}
        isRunning={isRunning}
        primaryAi={primaryAi}
        attachedFiles={attachedFiles}
        fileContents={fileContents}
        expanded={finalPanelExpanded}
        onToggleExpand={handleToggleFinalPanel}
      />

      {/* Accounts panel */}
      {showAccounts && (
        <AccountsPanel onClose={() => {
          setShowAccounts(false)
          window.electronAPI.setViewsVisible(true)
        }} />
      )}

      {/* Log drawer */}
      {showLogs && (
        <LogDrawer
          logs={logs}
          onClose={() => { setShowLogs(false); window.electronAPI.setViewsVisible(true) }}
          onClear={() => setLogs([])}
        />
      )}

      {/* History drawer */}
      {showHistory && (
        <HistoryDrawer
          history={history}
          onClose={() => { setShowHistory(false); window.electronAPI.setViewsVisible(true) }}
          onClear={handleClearHistory}
          onSelect={(item) => {
            setFinalAnswer(item.result)
            setQuery(item.query)
            setPrimaryAi(item.primaryAi)
            setShowHistory(false)
            window.electronAPI.setViewsVisible(true)
          }}
        />
      )}
    </div>
  )
}
