import { useState, useEffect, useCallback, useRef } from 'react'
import {
  AiName,
  AiPanelState,
  AttachedFile,
  ParsedFileContent,
  LogEntry,
  HistoryItem,
  WorkflowStage,
  AiRecommendation,
  CouncilRoomState,
  CouncilSnapshotSummary,
  CouncilUiState,
  WorkflowCouncilBridgeResult,
  DEFAULT_ENABLED_AIS,
  AI_NAMES,
  AI_DISPLAY_NAMES,
} from './types'
import TitleBar from './components/TitleBar'
import Toolbar from './components/Toolbar'
import StatusBar from './components/StatusBar'
import PanelGrid from './components/PanelGrid'
import FinalResultPanel from './components/FinalResultPanel'
import LogDrawer from './components/LogDrawer'
import HistoryDrawer from './components/HistoryDrawer'
import AccountsPanel from './components/AccountsPanel'
import TelegramSettings from './components/TelegramSettings'
import CouncilChatPanel from './components/CouncilChatPanel'
import UiErrorBoundary from './components/UiErrorBoundary'
import {
  buildCouncilWorkflowHandoffPrompt,
  hasCouncilWorkflowSource,
} from './councilWorkflowHandoff'
import { buildCouncilMergedCandidate } from './councilCandidateCompare'
import { buildCouncilModeratorSnapshot } from './councilModerator'

const LOG_MAX_ITEMS = 200
const COUNCIL_AUTOSAVE_DEBOUNCE_MS = 3000

const EMPTY_COUNCIL_ROOM: CouncilRoomState = {
  participants: [...DEFAULT_ENABLED_AIS],
  primaryAi: 'gemini',
  status: 'idle',
  pendingAi: null,
  messages: [],
  lastIntent: null,
  failedTurn: null,
}

function hasCouncilDiscussionBeyondWorkflowBridge(room: CouncilRoomState): boolean {
  return room.messages.some((message) =>
    message.kind !== 'system'
    && message.text.trim().length > 0
    && message.source !== 'workflow-bridge'
  )
}

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
  const [interactionMode, setInteractionMode] = useState<'workflow' | 'chat'>('workflow')
  const [modeSwitchPending, setModeSwitchPending] = useState(false)
  const [primaryAi, setPrimaryAi] = useState<AiName>('gemini')
  const [enabledAis, setEnabledAis] = useState<AiName[]>([...DEFAULT_ENABLED_AIS])
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
  const [showTelegram, setShowTelegram] = useState(false)
  const [telegramEnabled, setTelegramEnabled] = useState(false)
  const [councilRoom, setCouncilRoom] = useState<CouncilRoomState>(EMPTY_COUNCIL_ROOM)
  const [councilSnapshots, setCouncilSnapshots] = useState<CouncilSnapshotSummary[]>([])
  const [pinnedCouncilCandidateIds, setPinnedCouncilCandidateIds] = useState<string[]>([])
  const [selectedCouncilCandidateId, setSelectedCouncilCandidateId] = useState<string | null>(null)
  const [councilUiLoaded, setCouncilUiLoaded] = useState(false)
  const [isCouncilAutoSaving, setIsCouncilAutoSaving] = useState(false)
  const [councilAttachedFiles, setCouncilAttachedFiles] = useState<AttachedFile[]>([])
  const isRunningRef = useRef(false)
  const councilAutoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [recommendation, setRecommendation] = useState<AiRecommendation | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const analyzeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const addLog = useCallback((entry: LogEntry) => {
    setLogs((prev) => [{ ...entry, msg: `[${new Date().toLocaleTimeString()}] ${entry.msg}` }, ...prev].slice(0, LOG_MAX_ITEMS))
  }, [])

  useEffect(() => {
    const cleanups: Array<() => void> = []

    cleanups.push(window.electronAPI.onStatusUpdate((msg) => setStatus(msg)))
    cleanups.push(window.electronAPI.onLog((entry) => addLog(entry)))

    cleanups.push(
      window.electronAPI.onViewLoaded(({ ai }) => {
        setPanels((prev) =>
          prev.map((p) => (p.name === ai ? { ...p, loaded: true, error: false } : p))
        )
        setStatus((current) => (current.includes('Loading') ? `${AI_DISPLAY_NAMES[ai]} loaded` : current))
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
        setIsRunning(false)
        isRunningRef.current = false
        if (stage === 'after-draft') setWorkflowStage('waiting-next')
        else if (stage === 'after-reviews') setWorkflowStage('waiting-continue')
      })
    )

    cleanups.push(
      window.electronAPI.onCouncilRoomUpdate((room) => {
        setCouncilRoom(room)
        void window.electronAPI.getCouncilSnapshots().then(setCouncilSnapshots).catch((err) => { console.error('[council-snapshots]', err) })
        if (interactionMode === 'chat' && room.lastIntent?.note) {
          setStatus(room.lastIntent.note)
        }
      })
    )

    cleanups.push(
      window.electronAPI.onCouncilStreamChunk(({ messageId, text }) => {
        setCouncilRoom((prev) => ({
          ...prev,
          messages: prev.messages.map((message) =>
            message.id === messageId
              ? { ...message, text, pending: true }
              : message
          ),
        }))
      })
    )

    window.electronAPI.getHistory().then(setHistory)
    window.electronAPI.getCouncilRoom().then((room) => {
      const participants = room.participants.length > 0 ? room.participants : [...DEFAULT_ENABLED_AIS]
      setCouncilRoom(room)
      setEnabledAis(participants)
      setPrimaryAi(room.primaryAi)
      void window.electronAPI.setEnabledAis(participants)
    })
    window.electronAPI.getCouncilSnapshots().then(setCouncilSnapshots).catch((err) => { console.error('[council-snapshots]', err) })
    window.electronAPI.getCouncilUiState().then((uiState: CouncilUiState) => {
      setPinnedCouncilCandidateIds(uiState.pinnedCandidateIds)
      setSelectedCouncilCandidateId(uiState.selectedCandidateId)
      setCouncilUiLoaded(true)
    }).catch(() => {
      setCouncilUiLoaded(true)
    })
    
    window.electronAPI.getTelegramConfig().then((conf: any) => {
      setTelegramEnabled(conf?.enabled || false)
    }).catch(() => {})

    return () => cleanups.forEach((fn) => fn())
  }, [addLog, interactionMode])

  useEffect(() => {
    if (analyzeDebounceRef.current) clearTimeout(analyzeDebounceRef.current)

    if (interactionMode !== 'workflow') {
      setRecommendation(null)
      setAnalysisLoading(false)
      return
    }

    const trimmed = query.trim()
    if (trimmed.length < 8) {
      setRecommendation(null)
      setAnalysisLoading(false)
      return
    }

    setAnalysisLoading(true)
    analyzeDebounceRef.current = setTimeout(async () => {
      try {
        const result = await window.electronAPI.analyzeQuery(trimmed)
        setRecommendation(result)
      } catch {
        setRecommendation(null)
      } finally {
        setAnalysisLoading(false)
      }
    }, 800)

    return () => {
      if (analyzeDebounceRef.current) clearTimeout(analyzeDebounceRef.current)
    }
  }, [interactionMode, query])

  useEffect(() => {
    const availableCandidateIds = new Set(
      councilRoom.messages
        .filter((message) => message.kind === 'assistant' && message.ai && !message.pending)
        .map((message) => message.id)
    )

    setPinnedCouncilCandidateIds((prev) => prev.filter((id) => availableCandidateIds.has(id)))
    setSelectedCouncilCandidateId((prev) => (prev && availableCandidateIds.has(prev) ? prev : null))
  }, [councilRoom.messages])

  useEffect(() => {
    if (!councilUiLoaded) return

    void window.electronAPI.setCouncilUiState({
      pinnedCandidateIds: pinnedCouncilCandidateIds,
      selectedCandidateId: selectedCouncilCandidateId,
    }).then(() => window.electronAPI.getCouncilSnapshots())
      .then(setCouncilSnapshots)
      .catch((err) => { console.error('[council-snapshots]', err) })
  }, [councilUiLoaded, pinnedCouncilCandidateIds, selectedCouncilCandidateId])

  useEffect(() => {
    const attachmentVisible = interactionMode === 'workflow' && attachedFiles.length > 0
    window.electronAPI.setAttachmentBarVisible(attachmentVisible)
  }, [attachedFiles.length, interactionMode])

  useEffect(() => {
    return () => {
      if (councilAutoSaveTimerRef.current) {
        clearTimeout(councilAutoSaveTimerRef.current)
      }
    }
  }, [])

  const handleEnabledAisChange = useCallback((ais: AiName[]) => {
    const next = ais.includes(primaryAi) ? ais : [primaryAi, ...ais]
    setEnabledAis(next)
    window.electronAPI.setEnabledAis(next)
    if (interactionMode === 'chat') {
      window.electronAPI.syncCouncilRoomContext({ participants: next, primaryAi }).then(setCouncilRoom)
    }
  }, [interactionMode, primaryAi])

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

    setEnabledAis((prev) => {
      if (prev.includes(primaryAi)) return prev
      const next = [primaryAi, ...prev]
      window.electronAPI.setEnabledAis(next)
      if (interactionMode === 'chat') {
        window.electronAPI.syncCouncilRoomContext({ participants: next, primaryAi }).then(setCouncilRoom)
      }
      return next
    })
  }, [interactionMode, primaryAi])

  const handleAttach = useCallback(async () => {
    const files = await window.electronAPI.openFileDialog()
    if (files.length === 0) return

    setAttachedFiles((prev) => {
      const existing = new Set(prev.map((f) => f.path))
      const newFiles = files.filter((f) => !existing.has(f.path))
      return [...prev, ...newFiles]
    })
  }, [])

  const handleRemoveFile = useCallback((index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const runWorkflow = useCallback(async () => {
    const trimmedQuery = query.trim()
    const isNextRoundOnly = workflowStage === 'ready-next-round' && trimmedQuery.length === 0

    if (!trimmedQuery && !isNextRoundOnly) {
      setStatus('Please enter a question.')
      return
    }
    if (isRunning) return

    let nextStage: WorkflowStage = 'idle'

    setIsRunning(true)
    isRunningRef.current = true
    setWorkflowStage('running')
    setDraftAnswer('')
    setFileContents([])
    setStatus(isNextRoundOnly ? 'Starting next review round...' : 'Starting workflow...')

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
        query: trimmedQuery,
        attachedFiles: attachedFiles.length > 0 ? attachedFiles : undefined,
      })

      if (result.success && result.finalAnswer) {
        setFinalAnswer(result.finalAnswer)
        setFileContents(result.fileContents ?? [])
        setFinalPanelExpanded(true)
        window.electronAPI.setFinalPanelExpanded(true)
        window.electronAPI.getHistory().then(setHistory)
        setQuery('')
        nextStage = 'ready-next-round'
      } else {
        setStatus(`Error: ${result.error}`)
      }
    } finally {
      setIsRunning(false)
      isRunningRef.current = false
      setWorkflowStage(nextStage)
      setPanels((prev) => prev.map((p) => ({ ...p, role: 'idle' })))
    }
  }, [attachedFiles, isRunning, primaryAi, query, workflowStage])

  const handleStart = useCallback(() => {
    void runWorkflow()
  }, [runWorkflow])

  const handleReloadAi = useCallback((ai: AiName) => {
    window.electronAPI.reloadAi(ai)
    setPanels((prev) =>
      prev.map((p) => (p.name === ai ? { ...p, loaded: false, error: false } : p))
    )
  }, [])

  const handleProceed = useCallback(() => {
    if (workflowStage === 'ready-next-round') {
      void runWorkflow()
      return
    }

    setIsRunning(true)
    isRunningRef.current = true
    setWorkflowStage('running')
    setPanels((prev) =>
      prev.map((p) => ({
        ...p,
        role: p.name === primaryAi ? 'primary' : 'reviewer',
      }))
    )
    window.electronAPI.workflowProceed({ primaryAi })
  }, [primaryAi, runWorkflow, workflowStage])

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

  const performModeSwitch = useCallback(async (
    nextMode: 'workflow' | 'chat',
    finalStatus?: string,
    primaryOverride?: AiName,
    participantsOverride?: AiName[]
  ) => {
    const effectivePrimary = primaryOverride ?? primaryAi
    const effectiveParticipants = participantsOverride && participantsOverride.length > 0
      ? participantsOverride
      : enabledAis
    setModeSwitchPending(true)
    setStatus(nextMode === 'chat' ? 'Switching to Council Chat...' : 'Switching to Workflow mode...')

    try {
      const room = await window.electronAPI.switchInteractionMode({
        mode: nextMode,
        participants: effectiveParticipants,
        primaryAi: effectivePrimary,
      })

      setPrimaryAi(effectivePrimary)
      setEnabledAis(effectiveParticipants)
      setInteractionMode(nextMode)
      setCouncilRoom(room)
      if (finalPanelExpanded) {
        setFinalPanelExpanded(false)
        window.electronAPI.setFinalPanelExpanded(false)
      }
      const attachmentVisible = nextMode === 'workflow' && attachedFiles.length > 0
      window.electronAPI.setAttachmentBarVisible(attachmentVisible)
      setStatus(
        finalStatus
          ?? (nextMode === 'chat'
            ? 'Council Chat is active. Use @AI mentions in the docked panel to the right.'
            : 'Workflow mode is active.')
      )
      return room
    } catch (err) {
      setStatus(`Mode switch failed: ${err instanceof Error ? err.message : String(err)}`)
      return null
    } finally {
      setModeSwitchPending(false)
    }
  }, [attachedFiles.length, enabledAis, finalPanelExpanded, primaryAi])

  const handleCouncilToWorkflow = useCallback(async () => {
    if (councilRoom.status === 'running' || modeSwitchPending) return

    const handoffPrompt = buildCouncilWorkflowHandoffPrompt(councilRoom)
    if (!handoffPrompt) {
      setStatus('Add at least one council message before sending it to Workflow.')
      return
    }

    const switchedRoom = await performModeSwitch(
      'workflow',
      'Council transcript moved to Workflow. Review the prepared prompt, then click Start.'
    )

    if (!switchedRoom) return

    setQuery(handoffPrompt)
    setWorkflowStage('idle')
    setDraftAnswer('')
    setFinalAnswer('')
    setRecommendation(null)
  }, [councilRoom, modeSwitchPending, performModeSwitch])

  const handleCouncilMessageToWorkflow = useCallback(async (messageId: string, ai: AiName) => {
    if (councilRoom.status === 'running' || modeSwitchPending) return

    const handoffPrompt = buildCouncilWorkflowHandoffPrompt(councilRoom, { anchorMessageId: messageId })
    if (!handoffPrompt) {
      setStatus('That council reply could not be prepared for Workflow.')
      return
    }

    const switchedRoom = await performModeSwitch(
      'workflow',
      `${AI_DISPLAY_NAMES[ai]}'s council reply is ready as the workflow starting draft. Review the prepared prompt, then click Start.`,
      ai
    )

    if (!switchedRoom) return

    setQuery(handoffPrompt)
    setWorkflowStage('idle')
    setDraftAnswer('')
    setFinalAnswer('')
    setRecommendation(null)
  }, [councilRoom, modeSwitchPending, performModeSwitch])

  const handleToggleCouncilCandidatePin = useCallback((messageId: string) => {
    setPinnedCouncilCandidateIds((prev) => {
      if (prev.includes(messageId)) {
        return prev.filter((id) => id !== messageId)
      }
      return [...prev, messageId]
    })

    setSelectedCouncilCandidateId((current) => (current === messageId ? null : current ?? messageId))
  }, [])

  const handleSelectCouncilCandidate = useCallback((messageId: string) => {
    setSelectedCouncilCandidateId(messageId)
  }, [])

  const pinnedCouncilCandidates = pinnedCouncilCandidateIds
    .map((id) => councilRoom.messages.find((message) => message.id === id))
    .filter((message): message is CouncilRoomState['messages'][number] => Boolean(message && message.kind === 'assistant' && message.ai && !message.pending))

  const canUseSelectedCouncilCandidate = !modeSwitchPending
    && councilRoom.status !== 'running'
    && Boolean(
      selectedCouncilCandidateId
      && pinnedCouncilCandidates.some((message) => message.id === selectedCouncilCandidateId)
    )

  const canUseMergedCouncilCandidate = !modeSwitchPending
    && councilRoom.status !== 'running'
    && pinnedCouncilCandidates.length >= 2

  const modeSwitchDisabled = modeSwitchPending || isRunning
  const canSendCouncilToWorkflow = !modeSwitchPending && councilRoom.status !== 'running' && hasCouncilWorkflowSource(councilRoom)

  const handleUseSelectedCouncilCandidate = useCallback(async () => {
    if (!selectedCouncilCandidateId) {
      setStatus('Choose one pinned council reply first.')
      return
    }

    const selectedMessage = councilRoom.messages.find(
      (message) => message.id === selectedCouncilCandidateId && message.kind === 'assistant' && message.ai
    )

    if (!selectedMessage?.ai) {
      setStatus('That pinned council reply is no longer available.')
      return
    }

    await handleCouncilMessageToWorkflow(selectedMessage.id, selectedMessage.ai)
  }, [councilRoom.messages, handleCouncilMessageToWorkflow, selectedCouncilCandidateId])

  const handleUseMergedCouncilCandidate = useCallback(async () => {
    if (councilRoom.status === 'running' || modeSwitchPending) return

    const mergedCandidate = buildCouncilMergedCandidate(pinnedCouncilCandidates, selectedCouncilCandidateId)
    if (!mergedCandidate) {
      setStatus('Pin at least two council replies to create a merged workflow draft.')
      return
    }

    const handoffPrompt = buildCouncilWorkflowHandoffPrompt(councilRoom, {
      preferredDraft: {
        label: mergedCandidate.title,
        text: mergedCandidate.draftText,
      },
    })

    const switchedRoom = await performModeSwitch(
      'workflow',
      `${mergedCandidate.title} is ready. Review the merged seed draft, then click Start.`,
      mergedCandidate.preferredPrimaryAi
    )

    if (!switchedRoom) return

    setQuery(handoffPrompt)
    setWorkflowStage('idle')
    setDraftAnswer('')
    setFinalAnswer('')
    setRecommendation(null)
  }, [councilRoom, modeSwitchPending, performModeSwitch, pinnedCouncilCandidates, selectedCouncilCandidateId])

  const handleModeChange = useCallback((nextMode: 'workflow' | 'chat') => {
    if (isRunning) {
      setStatus('Finish the active workflow step before switching modes.')
      return
    }
    if (nextMode === interactionMode || modeSwitchPending) return

    if (interactionMode === 'chat' && nextMode === 'workflow') {
      if (hasCouncilDiscussionBeyondWorkflowBridge(councilRoom)) {
        void handleCouncilToWorkflow()
        return
      }

      void performModeSwitch('workflow')
      return
    }

    if (interactionMode === 'workflow' && nextMode === 'chat') {
      void (async () => {
        const switchedRoom = await performModeSwitch('chat')
        if (!switchedRoom) return

        const bridgeResult: WorkflowCouncilBridgeResult = await window.electronAPI.bridgeWorkflowToCouncil({
          participants: enabledAis,
          primaryAi,
        })
        setCouncilRoom(bridgeResult.room)
        setStatus(bridgeResult.note)
      })()
      return
    }

    void performModeSwitch(nextMode)
  }, [
    councilRoom,
    enabledAis,
    handleCouncilToWorkflow,
    interactionMode,
    isRunning,
    modeSwitchPending,
    performModeSwitch,
    primaryAi,
  ])

  const persistCouncilSnapshot = useCallback(async (options?: { silent?: boolean }) => {
    const workflowPreview = buildCouncilWorkflowHandoffPrompt(councilRoom)
    const moderatorSnapshot = buildCouncilModeratorSnapshot(councilRoom.messages, enabledAis, primaryAi)
    const snapshots = await window.electronAPI.saveCouncilSnapshot({
      room: councilRoom,
      uiState: {
        pinnedCandidateIds: pinnedCouncilCandidateIds,
        selectedCandidateId: selectedCouncilCandidateId,
      },
      insight: {
        workflowReady: workflowPreview.trim().length > 0,
        workflowPreview: workflowPreview.trim().length > 0 ? workflowPreview : null,
        moderatorConsensus: moderatorSnapshot?.consensus ?? null,
        moderatorNextSpeaker: moderatorSnapshot?.nextSpeaker ?? null,
        moderatorNextPrompt: moderatorSnapshot?.nextPrompt ?? null,
      },
    })
    setCouncilSnapshots(snapshots)
    if (options?.silent) {
      addLog({ level: 'info', msg: 'Auto-saved the active council session.' })
    } else {
      setStatus('Saved the current council session snapshot.')
    }
  }, [addLog, councilRoom, enabledAis, pinnedCouncilCandidateIds, primaryAi, selectedCouncilCandidateId])

  const handleSaveCouncilSnapshot = useCallback(async () => {
    await persistCouncilSnapshot()
  }, [persistCouncilSnapshot])

  const loadCouncilSnapshotState = useCallback(async (snapshotId: string, statusMessage?: string) => {
    if (modeSwitchPending || councilRoom.status === 'running') return
    const payload = await window.electronAPI.loadCouncilSnapshot(snapshotId)
    if (!payload) {
      setStatus('That council snapshot could not be loaded.')
      return null
    }
    const participants = payload.room.participants.length > 0
      ? payload.room.participants
      : [...DEFAULT_ENABLED_AIS]
    setCouncilRoom(payload.room)
    setEnabledAis(participants)
    setPrimaryAi(payload.room.primaryAi)
    setPinnedCouncilCandidateIds(payload.uiState.pinnedCandidateIds)
    setSelectedCouncilCandidateId(payload.uiState.selectedCandidateId)
    setCouncilSnapshots(await window.electronAPI.getCouncilSnapshots())
    setStatus(
      statusMessage
        ?? `Loaded saved council session: ${AI_DISPLAY_NAMES[payload.room.primaryAi]} primary with ${participants.length} active AIs.`
    )
    return { ...payload, participants }
  }, [councilRoom.status, modeSwitchPending])

  const handleLoadCouncilSnapshot = useCallback(async (snapshotId: string) => {
    await loadCouncilSnapshotState(snapshotId)
  }, [loadCouncilSnapshotState])

  const handleResumeSnapshotWorkflow = useCallback(async (snapshotId: string) => {
    const snapshot = councilSnapshots.find((item) => item.id === snapshotId)
    if (!snapshot?.insight.workflowReady) {
      setStatus('That saved session does not have a workflow draft ready yet.')
      return
    }

    const loaded = await loadCouncilSnapshotState(
      snapshotId,
      `Loaded saved session: ${AI_DISPLAY_NAMES[snapshot.primaryAi]} primary with ${snapshot.participants.length} active AIs.`
    )
    if (!loaded) return

    const handoffPrompt = snapshot.insight.workflowPreview
      ?? buildCouncilWorkflowHandoffPrompt(loaded.room)
    if (!handoffPrompt) {
      setStatus('That saved session does not have a usable workflow prompt yet.')
      return
    }

    const switchedRoom = await performModeSwitch(
      'workflow',
      `Saved session is ready for Workflow. Review the prepared prompt, then click Start.`,
      loaded.room.primaryAi,
      loaded.participants
    )

    if (!switchedRoom) return

    setQuery(handoffPrompt)
    setWorkflowStage('idle')
    setDraftAnswer('')
    setFinalAnswer('')
    setRecommendation(null)
  }, [councilSnapshots, loadCouncilSnapshotState, performModeSwitch])

  const handleResumeSnapshotModerator = useCallback(async (snapshotId: string) => {
    const snapshot = councilSnapshots.find((item) => item.id === snapshotId)
    const prompt = snapshot?.insight.moderatorNextPrompt?.trim()
    if (!snapshot?.insight.moderatorNextSpeaker || !prompt) {
      setStatus('That saved session does not have a moderator follow-up ready yet.')
      return
    }

    const loaded = await loadCouncilSnapshotState(
      snapshotId,
      `Loaded saved session and resumed with ${AI_DISPLAY_NAMES[snapshot.insight.moderatorNextSpeaker]}.`
    )
    if (!loaded) return

    setStatus(`Asking ${AI_DISPLAY_NAMES[snapshot.insight.moderatorNextSpeaker]} to continue the saved session...`)
    const room = await window.electronAPI.sendCouncilMessage({
      text: prompt,
      participants: loaded.participants,
      primaryAi: loaded.room.primaryAi,
    })
    setCouncilRoom(room)
  }, [councilSnapshots, loadCouncilSnapshotState])

  const handleDeleteCouncilSnapshot = useCallback(async (snapshotId: string) => {
    const snapshots = await window.electronAPI.deleteCouncilSnapshot(snapshotId)
    setCouncilSnapshots(snapshots)
    setStatus('Deleted saved council session.')
  }, [])

  const handleRenameCouncilSnapshot = useCallback(async (snapshotId: string, title: string) => {
    const snapshots = await window.electronAPI.renameCouncilSnapshot(snapshotId, title)
    setCouncilSnapshots(snapshots)
    setStatus('Renamed saved council session.')
  }, [])

  const handleAnnotateCouncilSnapshot = useCallback(async (
    snapshotId: string,
    meta: { label?: string | null; note?: string | null }
  ) => {
    const snapshots = await window.electronAPI.annotateCouncilSnapshot(snapshotId, meta)
    setCouncilSnapshots(snapshots)
    setStatus('Updated saved council session notes.')
  }, [])

  const handleExportCouncilSnapshot = useCallback(async (snapshotId: string) => {
    const result = await window.electronAPI.exportCouncilSnapshot(snapshotId)
    if (result.ok) {
      setStatus(`Exported saved session: ${result.title ?? 'Council Session'}.`)
      return
    }
    if (result.reason !== 'canceled') {
      setStatus('Could not export that saved council session.')
    }
  }, [])

  const handleImportCouncilSnapshot = useCallback(async () => {
    const result = await window.electronAPI.importCouncilSnapshot()
    setCouncilSnapshots(result.snapshots)
    if (result.importedTitle) {
      setStatus(`Imported saved session: ${result.importedTitle}.`)
    }
  }, [])

  const handleToggleCouncilSnapshotArchived = useCallback(async (snapshotId: string) => {
    const snapshots = await window.electronAPI.toggleCouncilSnapshotArchived(snapshotId)
    setCouncilSnapshots(snapshots)
    const target = snapshots.find((snapshot) => snapshot.id === snapshotId)
    if (target) {
      setStatus(
        target.isArchived
          ? 'Archived saved council session.'
          : 'Restored saved council session to the main list.'
      )
    }
  }, [])

  const handleToggleCouncilSnapshotLifecycle = useCallback(async (snapshotId: string) => {
    const snapshots = await window.electronAPI.toggleCouncilSnapshotLifecycle(snapshotId)
    setCouncilSnapshots(snapshots)
    const target = snapshots.find((snapshot) => snapshot.id === snapshotId)
    if (target) {
      setStatus(
        target.lifecycle === 'completed'
          ? 'Marked saved council session as completed.'
          : 'Marked saved council session as in progress.'
      )
    }
  }, [])

  const handleDuplicateCouncilSnapshot = useCallback(async (snapshotId: string) => {
    const snapshots = await window.electronAPI.duplicateCouncilSnapshot(snapshotId)
    setCouncilSnapshots(snapshots)
    setStatus('Duplicated saved council session.')
  }, [])

  const handleToggleCouncilSnapshotFavorite = useCallback(async (snapshotId: string) => {
    const snapshots = await window.electronAPI.toggleCouncilSnapshotFavorite(snapshotId)
    setCouncilSnapshots(snapshots)
    const target = snapshots.find((snapshot) => snapshot.id === snapshotId)
    if (target) {
      setStatus(target.isFavorite ? 'Pinned saved council session to favorites.' : 'Removed saved council session from favorites.')
    }
  }, [])

  const handleCouncilAttach = useCallback(async () => {
    const files = await window.electronAPI.openFileDialog()
    if (files.length === 0) return
    setCouncilAttachedFiles((prev) => {
      const existing = new Set(prev.map((f) => f.path))
      return [...prev, ...files.filter((f) => !existing.has(f.path))]
    })
  }, [])

  const handleCouncilRemoveFile = useCallback((index: number) => {
    setCouncilAttachedFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleSendCouncilMessage = useCallback(async (text: string, files?: AttachedFile[]) => {
    setStatus('Sending council message...')
    const room = await window.electronAPI.sendCouncilMessage({
      text,
      participants: enabledAis,
      primaryAi,
      attachedFiles: files,
    })
    setCouncilRoom(room)
    setCouncilAttachedFiles([])
  }, [enabledAis, primaryAi])

  const handleResetCouncilRoom = useCallback(async () => {
    const room = await window.electronAPI.resetCouncilRoom({ participants: enabledAis, primaryAi })
    setCouncilRoom(room)
    setPinnedCouncilCandidateIds([])
    setSelectedCouncilCandidateId(null)
    setStatus('Council Chat transcript reset.')
  }, [enabledAis, primaryAi])

  const handleRetryCouncilTurn = useCallback(async () => {
    setStatus('Retrying failed council turn...')
    const room = await window.electronAPI.retryCouncilTurn()
    setCouncilRoom(room)
  }, [])

  const handleSkipCouncilTurn = useCallback(async () => {
    const room = await window.electronAPI.skipCouncilTurn()
    setCouncilRoom(room)
    setStatus('Skipped failed council turn.')
  }, [])

  useEffect(() => {
    const activeSnapshot = councilSnapshots.find((snapshot) => snapshot.isActive) ?? null

    if (councilAutoSaveTimerRef.current) {
      clearTimeout(councilAutoSaveTimerRef.current)
      councilAutoSaveTimerRef.current = null
    }

    if (
      interactionMode !== 'chat'
      || !activeSnapshot
      || !activeSnapshot.isDirty
      || councilRoom.status === 'running'
      || modeSwitchPending
      || isCouncilAutoSaving
    ) {
      return
    }

    councilAutoSaveTimerRef.current = setTimeout(() => {
      setIsCouncilAutoSaving(true)
      void persistCouncilSnapshot({ silent: true })
        .catch((err) => { console.error('[council-snapshots]', err) })
        .finally(() => {
          setIsCouncilAutoSaving(false)
          councilAutoSaveTimerRef.current = null
        })
    }, COUNCIL_AUTOSAVE_DEBOUNCE_MS)

    return () => {
      if (councilAutoSaveTimerRef.current) {
        clearTimeout(councilAutoSaveTimerRef.current)
        councilAutoSaveTimerRef.current = null
      }
    }
  }, [
    councilRoom.status,
    councilSnapshots,
    interactionMode,
    isCouncilAutoSaving,
    modeSwitchPending,
    persistCouncilSnapshot,
  ])

  return (
    <div className={`app-root ${interactionMode === 'chat' ? 'council-chat-active' : ''}`}>
      <UiErrorBoundary title="Top Bar">
        <TitleBar
          mode={interactionMode}
          modeSwitchDisabled={modeSwitchDisabled}
          onModeChange={handleModeChange}
          onMinimize={() => window.electronAPI.minimize()}
          onMaximize={() => window.electronAPI.maximize()}
          onClose={() => window.electronAPI.close()}
          onToggleAccounts={() => {
            const next = !showAccounts
            setShowAccounts(next)
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
          showTelegram={showTelegram}
          onToggleTelegram={() => {
            const next = !showTelegram
            setShowTelegram(next)
            if (next) {
              setShowAccounts(false)
              setShowLogs(false)
              setShowHistory(false)
            }
            window.electronAPI.setViewsVisible(!next)
            
            if (!next) {
              // Refresh telegram state when closing
              window.electronAPI.getTelegramConfig().then((conf: any) => {
                setTelegramEnabled(conf?.enabled || false)
              }).catch(() => {})
            }
          }}
        />
      </UiErrorBoundary>

      <UiErrorBoundary title="Toolbar">
        <Toolbar
          interactionMode={interactionMode}
          primaryAi={primaryAi}
          enabledAis={enabledAis}
          query={query}
          isRunning={isRunning}
          workflowStage={workflowStage}
          attachedFiles={attachedFiles}
          recommendation={recommendation}
          analysisLoading={analysisLoading}
          onPrimaryAiChange={setPrimaryAi}
          onEnabledAisChange={handleEnabledAisChange}
          onQueryChange={setQuery}
          onAttach={handleAttach}
          onRemoveFile={handleRemoveFile}
          onStart={handleStart}
          onProceed={handleProceed}
        />
      </UiErrorBoundary>

      <UiErrorBoundary title="Status">
        <StatusBar status={status} isRunning={isRunning || councilRoom.status === 'running'} telegramEnabled={telegramEnabled} />
      </UiErrorBoundary>

      <UiErrorBoundary title="Panels">
        <PanelGrid
          panels={panels.filter((p) => enabledAis.includes(p.name))}
          primaryAi={primaryAi}
          onReload={handleReloadAi}
          onDevTools={handleDevTools}
          draftAnswer={draftAnswer}
        />
      </UiErrorBoundary>

      <div className="browser-view-spacer" />

      <UiErrorBoundary title="Final Result">
        <FinalResultPanel
          finalAnswer={finalAnswer}
          isRunning={interactionMode === 'workflow' && isRunning}
          primaryAi={primaryAi}
          attachedFiles={attachedFiles}
          fileContents={fileContents}
          expanded={finalPanelExpanded}
          onToggleExpand={handleToggleFinalPanel}
        />
      </UiErrorBoundary>

      {interactionMode === 'chat' && (
        <UiErrorBoundary title="Council Chat" className="ui-fallback-panel">
          <CouncilChatPanel
            room={councilRoom}
            snapshots={councilSnapshots}
            enabledAis={enabledAis}
            primaryAi={primaryAi}
            onSend={handleSendCouncilMessage}
            attachedFiles={councilAttachedFiles}
            onAttachFiles={handleCouncilAttach}
            onRemoveAttachedFile={handleCouncilRemoveFile}
            onReset={handleResetCouncilRoom}
            onRetryFailed={handleRetryCouncilTurn}
            onSkipFailed={handleSkipCouncilTurn}
            onSaveSnapshot={handleSaveCouncilSnapshot}
            onLoadSnapshot={handleLoadCouncilSnapshot}
            onToggleSnapshotFavorite={handleToggleCouncilSnapshotFavorite}
            onResumeSnapshotWorkflow={handleResumeSnapshotWorkflow}
            onResumeSnapshotModerator={handleResumeSnapshotModerator}
            onRenameSnapshot={handleRenameCouncilSnapshot}
            onAnnotateSnapshot={handleAnnotateCouncilSnapshot}
            onToggleSnapshotLifecycle={handleToggleCouncilSnapshotLifecycle}
            onToggleSnapshotArchived={handleToggleCouncilSnapshotArchived}
            onExportSnapshot={handleExportCouncilSnapshot}
            onImportSnapshot={handleImportCouncilSnapshot}
            onDuplicateSnapshot={handleDuplicateCouncilSnapshot}
            onDeleteSnapshot={handleDeleteCouncilSnapshot}
            onSendToWorkflow={handleCouncilToWorkflow}
            onSendMessageToWorkflow={handleCouncilMessageToWorkflow}
            pinnedCandidates={pinnedCouncilCandidates}
            selectedCandidateId={selectedCouncilCandidateId}
            onToggleCandidatePin={handleToggleCouncilCandidatePin}
            onSelectCandidate={handleSelectCouncilCandidate}
            onUseSelectedCandidate={handleUseSelectedCouncilCandidate}
            canUseSelectedCandidate={canUseSelectedCouncilCandidate}
            onUseMergedCandidate={handleUseMergedCouncilCandidate}
            canUseMergedCandidate={canUseMergedCouncilCandidate}
            canSendToWorkflow={canSendCouncilToWorkflow}
            modeSwitchPending={modeSwitchPending}
            isAutoSaving={isCouncilAutoSaving}
          />
        </UiErrorBoundary>
      )}

      {showTelegram && (
        <TelegramSettings onClose={() => {
          setShowTelegram(false)
          window.electronAPI.setViewsVisible(true)
          window.electronAPI.getTelegramConfig().then((conf: any) => {
            setTelegramEnabled(conf?.enabled || false)
          }).catch(() => {})
        }} />
      )}

      {showAccounts && (
        <AccountsPanel
          onClose={() => {
            setShowAccounts(false)
            window.electronAPI.setViewsVisible(true)
          }}
        />
      )}

      {showLogs && (
        <LogDrawer
          logs={logs}
          onClose={() => {
            setShowLogs(false)
            window.electronAPI.setViewsVisible(true)
          }}
          onClear={() => setLogs([])}
        />
      )}

      {showHistory && (
        <HistoryDrawer
          history={history}
          onClose={() => {
            setShowHistory(false)
            window.electronAPI.setViewsVisible(true)
          }}
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
