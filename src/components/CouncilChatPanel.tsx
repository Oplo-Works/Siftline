import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import {
  AiName,
  AiRecommendation,
  AI_COLORS,
  AI_DISPLAY_NAMES,
  AI_ICONS,
  AI_ROLE_PRESETS,
  CouncilMessage,
  CouncilRoomState,
  CouncilSnapshotSummary,
} from '../types'
import { applyMention, getMentionQuery, getMentionSuggestions } from '../councilMentions'
import { buildCouncilMergedCandidate, compareCouncilCandidates } from '../councilCandidateCompare'
import { buildCouncilModeratorSnapshot } from '../councilModerator'
import { CouncilMessageBubble } from './CouncilMessageBubble'

function buildSnapshotActivity(snapshot: CouncilSnapshotSummary): Array<{
  label: string
  tone: 'neutral' | 'active' | 'warning' | 'ready'
}> {
  if (snapshot.isArchived) {
    return [{ label: 'Archived', tone: 'neutral' }]
  }

  const steps: Array<{ label: string; tone: 'neutral' | 'active' | 'warning' | 'ready' }> = [
    {
      label: snapshot.isActive ? 'Open' : 'Saved',
      tone: snapshot.isActive ? 'active' : 'neutral',
    },
  ]

  if (snapshot.lifecycle === 'completed') {
    steps.push({ label: 'Completed', tone: 'ready' })
  }

  if (snapshot.isDirty) {
    steps.push({ label: 'Needs save', tone: 'warning' })
  }

  steps.push({
    label: snapshot.insight.workflowReady ? 'Workflow ready' : 'Workflow pending',
    tone: snapshot.insight.workflowReady ? 'ready' : 'neutral',
  })

  if (snapshot.insight.moderatorNextSpeaker) {
    steps.push({
      label: `Next ${AI_DISPLAY_NAMES[snapshot.insight.moderatorNextSpeaker]}`,
      tone: 'active',
    })
  }

  return steps
}

interface CouncilChatPanelProps {
  room: CouncilRoomState
  snapshots: CouncilSnapshotSummary[]
  enabledAis: AiName[]
  primaryAi: AiName
  onSend: (text: string, files?: import('../types').AttachedFile[]) => Promise<void>
  attachedFiles: import('../types').AttachedFile[]
  onAttachFiles: () => Promise<void>
  onRemoveAttachedFile: (index: number) => void
  onReset: () => Promise<void>
  onRetryFailed: () => Promise<void>
  onSkipFailed: () => Promise<void>
  onSaveSnapshot: () => Promise<void>
  onLoadSnapshot: (snapshotId: string) => Promise<void>
  onToggleSnapshotFavorite: (snapshotId: string) => Promise<void>
  onResumeSnapshotWorkflow: (snapshotId: string) => Promise<void>
  onResumeSnapshotModerator: (snapshotId: string) => Promise<void>
  onRenameSnapshot: (snapshotId: string, title: string) => Promise<void>
  onAnnotateSnapshot: (snapshotId: string, meta: {
    label?: string | null
    note?: string | null
  }) => Promise<void>
  onToggleSnapshotLifecycle: (snapshotId: string) => Promise<void>
  onToggleSnapshotArchived: (snapshotId: string) => Promise<void>
  onExportSnapshot: (snapshotId: string) => Promise<void>
  onImportSnapshot: () => Promise<void>
  onDuplicateSnapshot: (snapshotId: string) => Promise<void>
  onDeleteSnapshot: (snapshotId: string) => Promise<void>
  onSendToWorkflow: () => Promise<void>
  onSendMessageToWorkflow: (messageId: string, ai: AiName) => Promise<void>
  pinnedCandidates: CouncilMessage[]
  selectedCandidateId: string | null
  onToggleCandidatePin: (messageId: string) => void
  onSelectCandidate: (messageId: string) => void
  onUseSelectedCandidate: () => Promise<void>
  canUseSelectedCandidate: boolean
  onUseMergedCandidate: () => Promise<void>
  canUseMergedCandidate: boolean
  canSendToWorkflow: boolean
  modeSwitchPending: boolean
  isAutoSaving: boolean
}

export default function CouncilChatPanel({
  room,
  snapshots,
  enabledAis,
  primaryAi,
  onSend,
  attachedFiles,
  onAttachFiles,
  onRemoveAttachedFile,
  onReset,
  onRetryFailed,
  onSkipFailed,
  onSaveSnapshot,
  onLoadSnapshot,
  onToggleSnapshotFavorite,
  onResumeSnapshotWorkflow,
  onResumeSnapshotModerator,
  onRenameSnapshot,
  onAnnotateSnapshot,
  onToggleSnapshotLifecycle,
  onToggleSnapshotArchived,
  onExportSnapshot,
  onImportSnapshot,
  onDuplicateSnapshot,
  onDeleteSnapshot,
  onSendToWorkflow,
  onSendMessageToWorkflow,
  pinnedCandidates,
  selectedCandidateId,
  onToggleCandidatePin,
  onSelectCandidate,
  onUseSelectedCandidate,
  canUseSelectedCandidate,
  onUseMergedCandidate,
  canUseMergedCandidate,
  canSendToWorkflow,
  modeSwitchPending,
  isAutoSaving,
}: CouncilChatPanelProps) {
  const [snapshotFilter, setSnapshotFilter] = useState<'all' | 'favorites' | 'active' | 'dirty' | 'workflow-ready' | 'completed' | 'archived'>('all')
  const [snapshotSort, setSnapshotSort] = useState<'newest' | 'oldest'>('newest')
  const [snapshotSortKey, setSnapshotSortKey] = useState<'touched' | 'opened'>('touched')
  const [snapshotLabelFilter, setSnapshotLabelFilter] = useState<string>('all')
  const [snapshotSearch, setSnapshotSearch] = useState('')
  const [bulkDeleteArmed, setBulkDeleteArmed] = useState(false)
  const [isSavedSessionsOpen, setIsSavedSessionsOpen] = useState(false)
  const [isModeratorOpen, setIsModeratorOpen] = useState(false)
  const [isCouncilInfoOpen, setIsCouncilInfoOpen] = useState(false)
  const [isCandidatesOpen, setIsCandidatesOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [recommendation, setRecommendation] = useState<AiRecommendation | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0)
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(null)
  const [editingSnapshotTitle, setEditingSnapshotTitle] = useState('')
  const [annotatingSnapshotId, setAnnotatingSnapshotId] = useState<string | null>(null)
  const [annotatingSnapshotLabel, setAnnotatingSnapshotLabel] = useState('')
  const [annotatingSnapshotNote, setAnnotatingSnapshotNote] = useState('')
  const [saveNotice, setSaveNotice] = useState<string | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const analyzeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previousActiveSnapshotRef = useRef<{ id: string; savedAt: number } | null>(null)

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [room.messages, room.pendingAi])

  const participantSummary = useMemo(
    () => enabledAis.map((ai) => AI_DISPLAY_NAMES[ai]).join(', '),
    [enabledAis]
  )

  const mentionSuggestions = useMemo(
    () => (mentionQuery === null ? [] : getMentionSuggestions(enabledAis, mentionQuery)),
    [enabledAis, mentionQuery]
  )
  const candidateComparison = useMemo(
    () => compareCouncilCandidates(pinnedCandidates, selectedCandidateId),
    [pinnedCandidates, selectedCandidateId]
  )
  const mergedCandidate = useMemo(
    () => buildCouncilMergedCandidate(pinnedCandidates, selectedCandidateId),
    [pinnedCandidates, selectedCandidateId]
  )
  const moderatorSnapshot = useMemo(
    () => buildCouncilModeratorSnapshot(room.messages, enabledAis, primaryAi),
    [enabledAis, primaryAi, room.messages]
  )
  const hasExplicitMention = useMemo(
    () => /(^|\s)@(all|chatgpt|chat-gpt|chat_gpt|claude|gemini|grok|deepseek|perplexity)(?=\b)/i.test(draft),
    [draft]
  )
  const recommendationIsActive = recommendation
    ? enabledAis.includes(recommendation.recommended)
    : false
  const activeSnapshot = useMemo(
    () => snapshots.find((snapshot) => snapshot.isActive) ?? null,
    [snapshots]
  )
  const matchesSnapshotSearch = useCallback((snapshot: CouncilSnapshotSummary, normalizedSearch: string) => {
    if (!normalizedSearch) return true

    const searchHaystack = [
      snapshot.title,
      snapshot.label ?? '',
      snapshot.note ?? '',
      snapshot.lifecycle === 'completed' ? 'completed' : 'in progress',
      AI_DISPLAY_NAMES[snapshot.primaryAi],
      ...snapshot.participants.map((ai) => AI_DISPLAY_NAMES[ai]),
      snapshot.insight.workflowReady ? 'workflow ready' : 'workflow pending',
      snapshot.insight.moderatorNextSpeaker
        ? AI_DISPLAY_NAMES[snapshot.insight.moderatorNextSpeaker]
        : '',
    ].join(' ').toLowerCase()

    return searchHaystack.includes(normalizedSearch)
  }, [])
  const favoriteSnapshots = useMemo(() => {
    const normalizedSearch = snapshotSearch.trim().toLowerCase()
    return snapshots
      .filter((snapshot) => snapshot.isFavorite)
      .filter((snapshot) => !snapshot.isArchived || snapshot.isActive)
      .filter((snapshot) => snapshotLabelFilter === 'all' || snapshot.label === snapshotLabelFilter)
      .filter((snapshot) => matchesSnapshotSearch(snapshot, normalizedSearch))
      .sort((a, b) => {
        const aTime = snapshotSortKey === 'opened' ? a.lastOpenedAt : a.savedAt
        const bTime = snapshotSortKey === 'opened' ? b.lastOpenedAt : b.savedAt
        return bTime - aTime
      })
  }, [matchesSnapshotSearch, snapshotLabelFilter, snapshotSearch, snapshotSortKey, snapshots])
  const snapshotLabelGroups = useMemo(() => {
    const counts = new Map<string, number>()
    for (const snapshot of snapshots) {
      const label = snapshot.label?.trim()
      if (!label) continue
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1]
        return a[0].localeCompare(b[0])
      })
      .map(([label, count]) => ({ label, count }))
  }, [snapshots])
  const visibleSnapshots = useMemo(() => {
    const normalizedSearch = snapshotSearch.trim().toLowerCase()

    const filtered = snapshots.filter((snapshot) => {
      if (snapshotFilter === 'archived') return snapshot.isArchived
      if (snapshot.isArchived && !snapshot.isActive) return false
      if (snapshotFilter === 'completed') return snapshot.lifecycle === 'completed'
      if (snapshotFilter === 'favorites') return snapshot.isFavorite
      if (snapshotFilter === 'active') return snapshot.isActive
      if (snapshotFilter === 'dirty') return snapshot.isDirty
      if (snapshotFilter === 'workflow-ready') return snapshot.insight.workflowReady
      return true
    })
      .filter((snapshot) => snapshotLabelFilter === 'all' || snapshot.label === snapshotLabelFilter)
      .filter((snapshot) => matchesSnapshotSearch(snapshot, normalizedSearch))

    const sorted = [...filtered].sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1
      const aTime = snapshotSortKey === 'opened' ? a.lastOpenedAt : a.savedAt
      const bTime = snapshotSortKey === 'opened' ? b.lastOpenedAt : b.savedAt
      return snapshotSort === 'newest'
        ? bTime - aTime
        : aTime - bTime
    })

    return sorted
  }, [matchesSnapshotSearch, snapshotFilter, snapshotLabelFilter, snapshotSearch, snapshotSort, snapshotSortKey, snapshots])
  const saveButtonLabel = activeSnapshot
    ? activeSnapshot.isDirty
      ? 'Update Session'
      : 'Saved'
    : 'Save Session'
  const effectiveSaveButtonLabel = isAutoSaving ? 'Auto-saving...' : saveButtonLabel
  const saveButtonDisabled = room.status === 'running'
    || modeSwitchPending
    || isAutoSaving
    || (activeSnapshot !== null && !activeSnapshot.isDirty)
  const activeSessionMeta = activeSnapshot
    ? activeSnapshot.isDirty
      ? 'Unsaved changes'
      : `Last saved ${new Date(activeSnapshot.savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    : 'No saved session yet'
  const deletableVisibleSnapshotIds = useMemo(
    () => visibleSnapshots.filter((snapshot) => !snapshot.isActive).map((snapshot) => snapshot.id),
    [visibleSnapshots]
  )
  const bulkDeleteLabel = bulkDeleteArmed
    ? `Confirm delete (${deletableVisibleSnapshotIds.length})`
    : 'Delete Filtered'

  useEffect(() => {
    if (!activeSnapshot || activeSnapshot.isDirty) {
      previousActiveSnapshotRef.current = activeSnapshot
        ? { id: activeSnapshot.id, savedAt: activeSnapshot.savedAt }
        : null
      return
    }

    const previous = previousActiveSnapshotRef.current
    if (
      previous
      && previous.id === activeSnapshot.id
      && previous.savedAt !== activeSnapshot.savedAt
    ) {
      setSaveNotice(isAutoSaving ? 'Session auto-saved' : 'Session saved')
      const timer = window.setTimeout(() => setSaveNotice(null), 2200)
      previousActiveSnapshotRef.current = { id: activeSnapshot.id, savedAt: activeSnapshot.savedAt }
      return () => window.clearTimeout(timer)
    }

    previousActiveSnapshotRef.current = { id: activeSnapshot.id, savedAt: activeSnapshot.savedAt }
  }, [activeSnapshot, isAutoSaving])

  useEffect(() => {
    setBulkDeleteArmed(false)
  }, [snapshotFilter, snapshotLabelFilter, snapshotSearch, snapshotSort, snapshotSortKey])

  useEffect(() => {
    if (analyzeDebounceRef.current) clearTimeout(analyzeDebounceRef.current)

    const trimmed = draft.trim()
    if (trimmed.length < 8 || hasExplicitMention || room.status === 'running' || isSending) {
      setRecommendation(null)
      setAnalysisLoading(false)
      return
    }

    setAnalysisLoading(true)
    let canceled = false
    analyzeDebounceRef.current = setTimeout(async () => {
      try {
        const result = await window.electronAPI.analyzeQuery(trimmed)
        if (!canceled) setRecommendation(result)
      } catch {
        if (!canceled) setRecommendation(null)
      } finally {
        if (!canceled) setAnalysisLoading(false)
      }
    }, 800)

    return () => {
      canceled = true
      if (analyzeDebounceRef.current) clearTimeout(analyzeDebounceRef.current)
    }
  }, [draft, hasExplicitMention, isSending, room.status])

  const submit = async () => {
    const text = draft.trim()
    const hasFiles = attachedFiles.length > 0
    if ((!text && !hasFiles) || isSending || room.status === 'running') return
    setIsSending(true)
    try {
      await onSend(text, hasFiles ? attachedFiles : undefined)
      setDraft('')
      setMentionQuery(null)
      setSelectedMentionIndex(0)
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedMentionIndex((current) => (current + 1) % mentionSuggestions.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedMentionIndex((current) => (current - 1 + mentionSuggestions.length) % mentionSuggestions.length)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMentionQuery(null)
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        const selectedAi = mentionSuggestions[selectedMentionIndex]
        if (selectedAi) {
          e.preventDefault()
          insertMention(selectedAi)
          return
        }
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void submit()
    }
  }

  const updateMentionState = (nextText: string) => {
    const caretIndex = inputRef.current?.selectionStart ?? nextText.length
    const nextQuery = getMentionQuery(nextText, caretIndex)
    setMentionQuery(nextQuery)
    setSelectedMentionIndex(0)
  }

  const insertMention = (ai: AiName) => {
    const label = AI_DISPLAY_NAMES[ai]
    const caretIndex = inputRef.current?.selectionStart ?? draft.length
    const next = applyMention(draft, caretIndex, ai, label)
    setDraft(next)
    setMentionQuery(null)
    setSelectedMentionIndex(0)
    requestAnimationFrame(() => {
      const nextCaret = next.indexOf(`@${label}`) + label.length + 2
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(nextCaret, nextCaret)
    })
  }

  const applyRecommendedMention = () => {
    if (!recommendation || !recommendationIsActive) return
    const label = AI_DISPLAY_NAMES[recommendation.recommended]
    const text = draft.trim()
    const next = text.length > 0
      ? `@${label}, ${text}`
      : `@${label} `
    setDraft(next)
    setRecommendation(null)
    setAnalysisLoading(false)
    setMentionQuery(null)
    setSelectedMentionIndex(0)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      const nextCaret = next.length
      inputRef.current?.setSelectionRange(nextCaret, nextCaret)
    })
  }

  const applyModeratorPrompt = (prompt: string) => {
    setDraft(prompt)
    setMentionQuery(null)
    setSelectedMentionIndex(0)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      const nextCaret = prompt.length
      inputRef.current?.setSelectionRange(nextCaret, nextCaret)
    })
  }

  const sendModeratorPromptNow = async (prompt: string) => {
    if (room.status === 'running' || isSending) return
    setIsSending(true)
    try {
      await onSend(prompt)
      setDraft('')
      setMentionQuery(null)
      setSelectedMentionIndex(0)
    } finally {
      setIsSending(false)
    }
  }

  const startRenamingSnapshot = (snapshot: CouncilSnapshotSummary) => {
    setAnnotatingSnapshotId(null)
    setAnnotatingSnapshotLabel('')
    setAnnotatingSnapshotNote('')
    setEditingSnapshotId(snapshot.id)
    setEditingSnapshotTitle(snapshot.title)
  }

  const startAnnotatingSnapshot = (snapshot: CouncilSnapshotSummary) => {
    setEditingSnapshotId(null)
    setEditingSnapshotTitle('')
    setAnnotatingSnapshotId(snapshot.id)
    setAnnotatingSnapshotLabel(snapshot.label ?? '')
    setAnnotatingSnapshotNote(snapshot.note ?? '')
  }

  const submitSnapshotRename = async (snapshotId: string) => {
    const nextTitle = editingSnapshotTitle.trim()
    if (!nextTitle) {
      setEditingSnapshotId(null)
      setEditingSnapshotTitle('')
      return
    }
    await onRenameSnapshot(snapshotId, nextTitle)
    setEditingSnapshotId(null)
    setEditingSnapshotTitle('')
  }

  const submitSnapshotAnnotation = async (snapshotId: string) => {
    await onAnnotateSnapshot(snapshotId, {
      label: annotatingSnapshotLabel.trim() || null,
      note: annotatingSnapshotNote.trim() || null,
    })
    setAnnotatingSnapshotId(null)
    setAnnotatingSnapshotLabel('')
    setAnnotatingSnapshotNote('')
  }

  const handleBulkDeleteFiltered = async () => {
    if (room.status === 'running' || modeSwitchPending || deletableVisibleSnapshotIds.length === 0) {
      return
    }

    if (!bulkDeleteArmed) {
      setBulkDeleteArmed(true)
      return
    }

    setBulkDeleteArmed(false)
    for (const snapshotId of deletableVisibleSnapshotIds) {
      await onDeleteSnapshot(snapshotId)
    }
  }

  return (
    <aside className="council-chat-panel">
      <div className="council-chat-header">
        <div className="council-chat-header-copy">
          <div className="council-chat-kicker">Council Chat</div>
          <div className="council-chat-title">Free-form group discussion</div>
          <div className={`council-chat-save-meta ${activeSnapshot?.isDirty ? 'dirty' : ''}`}>
            {activeSessionMeta}
          </div>
        </div>
        <div className="council-chat-header-actions">
          <button
            className="council-chat-save-btn"
            onClick={() => void onSaveSnapshot()}
            disabled={saveButtonDisabled}
          >
            {effectiveSaveButtonLabel}
          </button>
          <button
            className="council-chat-workflow-btn"
            onClick={() => void onSendToWorkflow()}
            disabled={!canSendToWorkflow || modeSwitchPending}
          >
            {modeSwitchPending ? 'Switching...' : 'Send To Workflow'}
          </button>
          <button className="council-chat-reset" onClick={() => void onReset()}>
            New Session
          </button>
        </div>
      </div>

      {saveNotice && (
        <div className="council-save-toast">{saveNotice}</div>
      )}

      {room.messages.length === 0 && (
        <div className="council-onboarding-card">
          <div className="council-onboarding-title">Start a council conversation</div>
          <div className="council-onboarding-copy">
            Ask one AI with <code>@Gemini</code>, <code>@Claude</code>, or collect a round from everyone with <code>@all</code>.
            Once the discussion becomes useful, save it as a session and keep your best threads pinned for quick reuse.
          </div>
          <div className="council-onboarding-steps">
            <span className="council-onboarding-step">1. Send a prompt to one AI or @all</span>
            <span className="council-onboarding-step">2. Pin strong answers or ask the suggested next AI</span>
            <span className="council-onboarding-step">3. Save the session or hand it off to Workflow</span>
          </div>
        </div>
      )}

      <div className="council-collapsible-section">
        <button
          className={`council-collapsible-header ${isSavedSessionsOpen ? 'open' : ''}`}
          onClick={() => setIsSavedSessionsOpen((v) => !v)}
          aria-expanded={isSavedSessionsOpen}
        >
          <span className="council-collapsible-title">💾 Saved Sessions</span>
          <span className="council-collapsible-count">
            {snapshots.length > 0 ? `${snapshots.length} session${snapshots.length !== 1 ? 's' : ''}` : 'No sessions'}
          </span>
          <span className="council-collapsible-chevron">{isSavedSessionsOpen ? '▲' : '▼'}</span>
        </button>
        {isSavedSessionsOpen && (
          <div className="council-collapsible-body">

      {favoriteSnapshots.length > 0 && (
        <div className="council-favorite-quick-rail">
          <div className="council-favorite-quick-kicker">Favorite Quick Actions</div>
          <div className="council-favorite-quick-list">
            {favoriteSnapshots.slice(0, 3).map((snapshot) => (
              <div
                key={`quick-${snapshot.id}`}
                className={`council-favorite-quick-card ${snapshot.isActive ? 'active' : ''}`}
              >
                <button
                  className="council-favorite-quick-open"
                  onClick={() => void onLoadSnapshot(snapshot.id)}
                  disabled={room.status === 'running' || modeSwitchPending}
                  title={snapshot.title}
                >
                  <span className="council-favorite-quick-title">{snapshot.title}</span>
                  <span className="council-favorite-quick-meta">
                    {AI_DISPLAY_NAMES[snapshot.primaryAi]}
                    {snapshot.label ? ` | ${snapshot.label}` : ''}
                  </span>
                </button>
                <div className="council-favorite-quick-actions">
                  <button
                    className="council-favorite-quick-btn"
                    onClick={() => void onLoadSnapshot(snapshot.id)}
                    disabled={room.status === 'running' || modeSwitchPending}
                  >
                    Open
                  </button>
                  <button
                    className="council-favorite-quick-btn workflow"
                    onClick={() => void onResumeSnapshotWorkflow(snapshot.id)}
                    disabled={room.status === 'running' || modeSwitchPending || !snapshot.insight.workflowReady}
                  >
                    Workflow
                  </button>
                  <button
                    className="council-favorite-quick-btn next"
                    onClick={() => void onResumeSnapshotModerator(snapshot.id)}
                    disabled={
                      room.status === 'running'
                      || modeSwitchPending
                      || !snapshot.insight.moderatorNextPrompt
                      || !snapshot.insight.moderatorNextSpeaker
                    }
                  >
                    Ask Next
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {snapshots.length > 0 && (
        <div className="council-snapshot-strip">
          {snapshotFilter !== 'favorites' && favoriteSnapshots.length > 0 && (
            <div className="council-favorites-strip">
              <div className="council-favorites-kicker">Favorites</div>
              <div className="council-favorites-row">
                {favoriteSnapshots.slice(0, 4).map((snapshot) => (
                  <button
                    key={`favorite-${snapshot.id}`}
                    className={`council-favorite-pill ${snapshot.isActive ? 'active' : ''} ${snapshot.isDirty ? 'dirty' : ''}`}
                    onClick={() => void onLoadSnapshot(snapshot.id)}
                    disabled={room.status === 'running' || modeSwitchPending}
                    title={`${snapshot.title}\n${AI_DISPLAY_NAMES[snapshot.primaryAi]} primary`}
                  >
                    <span className="council-favorite-pill-top">
                      <span className="council-favorite-pill-title">{snapshot.title}</span>
                      {snapshot.label
                        ? <span className="council-favorite-pill-badge">{snapshot.label}</span>
                        : snapshot.isDirty && <span className="council-favorite-pill-badge">Dirty</span>}
                    </span>
                    <span className="council-favorite-pill-meta">
                      {AI_DISPLAY_NAMES[snapshot.primaryAi]} | {snapshot.messageCount} msgs
                    </span>
                    {snapshot.note && (
                      <span className="council-favorite-pill-note">{snapshot.note}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="council-snapshot-strip-head">
            <div className="council-snapshot-kicker">Saved Sessions</div>
            <div className="council-snapshot-controls">
              <div className="council-snapshot-search-wrap">
                <input
                  className="council-snapshot-search"
                  type="text"
                  value={snapshotSearch}
                  onChange={(e) => setSnapshotSearch(e.target.value)}
                  placeholder="Search sessions..."
                />
                {snapshotSearch.trim().length > 0 && (
                  <button
                    className="council-snapshot-search-clear"
                    onClick={() => setSnapshotSearch('')}
                    aria-label="Clear saved session search"
                  >
                    x
                  </button>
                )}
              </div>
              <div className="council-snapshot-filters">
                <button
                  className={`council-snapshot-filter ${snapshotFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setSnapshotFilter('all')}
                >
                  All
                </button>
                <button
                  className={`council-snapshot-filter ${snapshotFilter === 'favorites' ? 'active' : ''}`}
                  onClick={() => setSnapshotFilter('favorites')}
                >
                  Favorites
                </button>
                <button
                  className={`council-snapshot-filter ${snapshotFilter === 'active' ? 'active' : ''}`}
                  onClick={() => setSnapshotFilter('active')}
                >
                  Active
                </button>
                <button
                  className={`council-snapshot-filter ${snapshotFilter === 'dirty' ? 'active' : ''}`}
                  onClick={() => setSnapshotFilter('dirty')}
                >
                  Dirty
                </button>
                <button
                  className={`council-snapshot-filter ${snapshotFilter === 'workflow-ready' ? 'active' : ''}`}
                  onClick={() => setSnapshotFilter('workflow-ready')}
                >
                  Workflow Ready
                </button>
                <button
                  className={`council-snapshot-filter ${snapshotFilter === 'completed' ? 'active' : ''}`}
                  onClick={() => setSnapshotFilter('completed')}
                >
                  Completed
                </button>
                <button
                  className={`council-snapshot-filter ${snapshotFilter === 'archived' ? 'active' : ''}`}
                  onClick={() => setSnapshotFilter('archived')}
                >
                  Archived
                </button>
              </div>
              <button
                className={`council-snapshot-sort-mode ${snapshotSortKey === 'touched' ? 'active' : ''}`}
                onClick={() => setSnapshotSortKey('touched')}
              >
                Touched
              </button>
              <button
                className={`council-snapshot-sort-mode ${snapshotSortKey === 'opened' ? 'active' : ''}`}
                onClick={() => setSnapshotSortKey('opened')}
              >
                Opened
              </button>
              <button
                className="council-snapshot-sort"
                onClick={() => setSnapshotSort((current) => current === 'newest' ? 'oldest' : 'newest')}
              >
                {snapshotSort === 'newest' ? 'Newest first' : 'Oldest first'}
              </button>
              <button
                className={`council-snapshot-bulk-delete ${bulkDeleteArmed ? 'armed' : ''}`}
                onClick={() => void handleBulkDeleteFiltered()}
                disabled={room.status === 'running' || modeSwitchPending || deletableVisibleSnapshotIds.length === 0}
              >
                {bulkDeleteLabel}
              </button>
              <button
                className="council-snapshot-import"
                onClick={() => void onImportSnapshot()}
                disabled={room.status === 'running' || modeSwitchPending}
              >
                Import
              </button>
            </div>
          </div>
          {snapshotLabelGroups.length > 0 && (
            <div className="council-snapshot-label-groups">
              <button
                className={`council-snapshot-label-chip ${snapshotLabelFilter === 'all' ? 'active' : ''}`}
                onClick={() => setSnapshotLabelFilter('all')}
              >
                All labels
                <span className="council-snapshot-label-count">{snapshots.length}</span>
              </button>
              {snapshotLabelGroups.slice(0, 8).map(({ label, count }) => (
                <button
                  key={label}
                  className={`council-snapshot-label-chip ${snapshotLabelFilter === label ? 'active' : ''}`}
                  onClick={() => setSnapshotLabelFilter(label)}
                  title={`Show sessions labeled ${label}`}
                >
                  {label}
                  <span className="council-snapshot-label-count">{count}</span>
                </button>
              ))}
            </div>
          )}
          <div className="council-snapshot-list">
            {visibleSnapshots.slice(0, 8).map((snapshot) => (
              <div
                key={snapshot.id}
                className={`council-snapshot-chip ${snapshot.isFavorite ? 'favorite' : ''} ${snapshot.isActive ? 'active' : ''} ${snapshot.isDirty ? 'dirty' : ''} ${snapshot.isArchived ? 'archived' : ''}`}
              >
                {editingSnapshotId === snapshot.id ? (
                  <div className="council-snapshot-edit-row">
                    <input
                      className="council-snapshot-edit-input"
                      value={editingSnapshotTitle}
                      onChange={(e) => setEditingSnapshotTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          void submitSnapshotRename(snapshot.id)
                        } else if (e.key === 'Escape') {
                          setEditingSnapshotId(null)
                          setEditingSnapshotTitle('')
                        }
                      }}
                      autoFocus
                    />
                    <button
                      className="council-snapshot-confirm"
                      onClick={() => void submitSnapshotRename(snapshot.id)}
                    >
                      Save
                    </button>
                  </div>
                ) : annotatingSnapshotId === snapshot.id ? (
                  <div className="council-snapshot-edit-stack">
                    <div className="council-snapshot-edit-row">
                      <input
                        className="council-snapshot-edit-input council-snapshot-edit-label"
                        value={annotatingSnapshotLabel}
                        onChange={(e) => setAnnotatingSnapshotLabel(e.target.value)}
                        placeholder="Label (e.g. Product, Stocks, Research)"
                        maxLength={28}
                      />
                    </div>
                    <textarea
                      className="council-snapshot-edit-note"
                      value={annotatingSnapshotNote}
                      onChange={(e) => setAnnotatingSnapshotNote(e.target.value)}
                      placeholder="Add a short note for what this session is about..."
                      rows={2}
                      maxLength={140}
                      onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                          e.preventDefault()
                          void submitSnapshotAnnotation(snapshot.id)
                        } else if (e.key === 'Escape') {
                          setAnnotatingSnapshotId(null)
                          setAnnotatingSnapshotLabel('')
                          setAnnotatingSnapshotNote('')
                        }
                      }}
                    />
                    <div className="council-snapshot-edit-actions">
                      <button
                        className="council-snapshot-confirm"
                        onClick={() => void submitSnapshotAnnotation(snapshot.id)}
                      >
                        Save Note
                      </button>
                      <button
                        className="council-snapshot-cancel"
                        onClick={() => {
                          setAnnotatingSnapshotId(null)
                          setAnnotatingSnapshotLabel('')
                          setAnnotatingSnapshotNote('')
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      className={`council-snapshot-favorite ${snapshot.isFavorite ? 'active' : ''}`}
                      onClick={() => void onToggleSnapshotFavorite(snapshot.id)}
                      disabled={room.status === 'running' || modeSwitchPending}
                      aria-label={snapshot.isFavorite ? `Unfavorite saved session ${snapshot.title}` : `Favorite saved session ${snapshot.title}`}
                    >
                      {snapshot.isFavorite ? 'Pinned' : 'Pin'}
                    </button>
                    <button
                      className="council-snapshot-load"
                      onClick={() => void onLoadSnapshot(snapshot.id)}
                      disabled={room.status === 'running' || modeSwitchPending}
                      title={[
                        `Touched: ${new Date(snapshot.savedAt).toLocaleString()}`,
                        `Opened: ${new Date(snapshot.lastOpenedAt).toLocaleString()}`,
                        `Primary: ${AI_DISPLAY_NAMES[snapshot.primaryAi]}`,
                        `Active: ${snapshot.participants.map((ai) => AI_DISPLAY_NAMES[ai]).join(', ')}`,
                        snapshot.label ? `Label: ${snapshot.label}` : null,
                        snapshot.note ? `Note: ${snapshot.note}` : null,
                        snapshot.insight.workflowReady ? 'Workflow: ready' : null,
                        snapshot.insight.moderatorNextSpeaker
                          ? `Moderator next: ${AI_DISPLAY_NAMES[snapshot.insight.moderatorNextSpeaker]}`
                          : null,
                        snapshot.insight.moderatorNextPrompt
                          ? `Prompt: ${snapshot.insight.moderatorNextPrompt}`
                          : null,
                      ].filter(Boolean).join('\n')}
                    >
                      <span className="council-snapshot-main">
                        <span className="council-snapshot-title">{snapshot.title}</span>
                        <span className="council-snapshot-context">
                          {AI_DISPLAY_NAMES[snapshot.primaryAi]} primary | {snapshot.participants.length} active
                        </span>
                        <span className="council-snapshot-stats">
                          {snapshot.label && (
                            <span className="council-snapshot-stat label">{snapshot.label}</span>
                          )}
                          {snapshot.lifecycle === 'completed' && (
                            <span className="council-snapshot-stat complete">Completed</span>
                          )}
                          {snapshot.isArchived && (
                            <span className="council-snapshot-stat">Archived</span>
                          )}
                          <span className="council-snapshot-stat">{snapshot.messageCount} msgs</span>
                          {snapshot.isDirty && (
                            <span className="council-snapshot-stat warning">Dirty</span>
                          )}
                          <span className={`council-snapshot-stat ${snapshot.insight.workflowReady ? 'ready' : ''}`}>
                            {snapshot.insight.workflowReady ? 'Workflow ready' : 'Workflow pending'}
                          </span>
                          {snapshot.insight.moderatorNextSpeaker && (
                            <span className="council-snapshot-stat">
                              Next: {AI_DISPLAY_NAMES[snapshot.insight.moderatorNextSpeaker]}
                            </span>
                          )}
                        </span>
                        <span className="council-snapshot-activity">
                          {buildSnapshotActivity(snapshot).map((step) => (
                            <span
                              key={`${snapshot.id}-${step.label}`}
                              className={`council-snapshot-activity-step ${step.tone}`}
                            >
                              {step.label}
                            </span>
                          ))}
                        </span>
                        <span className="council-snapshot-insight">
                          {snapshot.lifecycle === 'completed'
                            ? 'Marked completed'
                            : snapshot.insight.workflowReady ? 'Workflow ready' : 'Workflow draft pending'}
                          {snapshot.insight.moderatorNextSpeaker
                            ? ` | Next: ${AI_DISPLAY_NAMES[snapshot.insight.moderatorNextSpeaker]}`
                            : ''}
                        </span>
                        {snapshot.note && (
                          <span className="council-snapshot-note">{snapshot.note}</span>
                        )}
                      </span>
                      <span className="council-snapshot-meta">
                        {snapshot.isActive
                          ? snapshot.isArchived
                            ? 'Archived'
                            : snapshot.isDirty ? 'Unsaved' : 'Saved'
                          : `${snapshotSortKey === 'opened' ? 'Opened' : 'Touched'} ${new Date(
                            snapshotSortKey === 'opened' ? snapshot.lastOpenedAt : snapshot.savedAt
                          ).toLocaleDateString([], { month: 'short', day: 'numeric' })}`}
                      </span>
                    </button>
                    <button
                      className="council-snapshot-resume"
                      onClick={() => void onResumeSnapshotWorkflow(snapshot.id)}
                      disabled={room.status === 'running' || modeSwitchPending || !snapshot.insight.workflowReady}
                      aria-label={`Resume workflow from saved session ${snapshot.title}`}
                    >
                      Resume
                    </button>
                    <button
                      className="council-snapshot-ask"
                      onClick={() => void onResumeSnapshotModerator(snapshot.id)}
                      disabled={
                        room.status === 'running'
                        || modeSwitchPending
                        || !snapshot.insight.moderatorNextPrompt
                        || !snapshot.insight.moderatorNextSpeaker
                      }
                      aria-label={`Ask suggested AI from saved session ${snapshot.title}`}
                    >
                      Ask Next
                    </button>
                    <button
                      className="council-snapshot-complete"
                      onClick={() => void onToggleSnapshotLifecycle(snapshot.id)}
                      disabled={room.status === 'running' || modeSwitchPending}
                      aria-label={`${snapshot.lifecycle === 'completed' ? 'Reopen' : 'Complete'} saved session ${snapshot.title}`}
                    >
                      {snapshot.lifecycle === 'completed' ? 'Reopen' : 'Complete'}
                    </button>
                    <button
                      className="council-snapshot-archive"
                      onClick={() => void onToggleSnapshotArchived(snapshot.id)}
                      disabled={room.status === 'running' || modeSwitchPending}
                      aria-label={`${snapshot.isArchived ? 'Restore' : 'Archive'} saved session ${snapshot.title}`}
                    >
                      {snapshot.isArchived ? 'Restore' : 'Archive'}
                    </button>
                    <button
                      className="council-snapshot-export"
                      onClick={() => void onExportSnapshot(snapshot.id)}
                      disabled={room.status === 'running' || modeSwitchPending}
                      aria-label={`Export saved session ${snapshot.title}`}
                    >
                      Export
                    </button>
                    <button
                      className="council-snapshot-note-btn"
                      onClick={() => startAnnotatingSnapshot(snapshot)}
                      disabled={room.status === 'running' || modeSwitchPending}
                      aria-label={`Add note to saved session ${snapshot.title}`}
                    >
                      Note
                    </button>
                    <button
                      className="council-snapshot-rename"
                      onClick={() => startRenamingSnapshot(snapshot)}
                      disabled={room.status === 'running' || modeSwitchPending}
                      aria-label={`Rename saved session ${snapshot.title}`}
                    >
                      Rename
                    </button>
                    <button
                      className="council-snapshot-duplicate"
                      onClick={() => void onDuplicateSnapshot(snapshot.id)}
                      disabled={room.status === 'running' || modeSwitchPending}
                      aria-label={`Duplicate saved session ${snapshot.title}`}
                    >
                      Copy
                    </button>
                    <button
                      className="council-snapshot-delete"
                      onClick={() => void onDeleteSnapshot(snapshot.id)}
                      disabled={room.status === 'running' || modeSwitchPending}
                      aria-label={`Delete saved session ${snapshot.title}`}
                    >
                      x
                    </button>
                  </>
                )}
              </div>
            ))}
            {visibleSnapshots.length === 0 && (
              <div className="council-snapshot-empty">
                {snapshotSearch.trim().length > 0
                  ? 'No saved sessions match this search yet.'
                  : 'No saved sessions match this view yet.'}
              </div>
            )}
          </div>
        </div>
      )}

            {snapshots.length === 0 && room.messages.length > 0 && (
              <div className="council-empty-sessions">
                <div className="council-empty-sessions-title">No saved sessions yet</div>
                <div className="council-empty-sessions-copy">
                  This discussion is live, but it has not been saved as a reusable session yet. Save it once you want to come back later,
                  compare candidates, or reopen it from Favorites.
                </div>
              </div>
            )}
            {room.messages.length > 0 && favoriteSnapshots.length === 0 && (
              <div className="council-inline-hint">
                Pin a saved session to Favorites and it will show up here with quick actions for Open, Workflow, and Ask Next.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="council-collapsible-section council-info">
        <button
          className={`council-collapsible-header ${isCouncilInfoOpen ? 'open' : ''}`}
          onClick={() => setIsCouncilInfoOpen((v) => !v)}
          aria-expanded={isCouncilInfoOpen}
        >
          <span className="council-collapsible-title">⚙️ Council Info</span>
          <span className="council-collapsible-count">
            {AI_DISPLAY_NAMES[primaryAi]} · {enabledAis.length} active
          </span>
          <span className="council-collapsible-chevron">{isCouncilInfoOpen ? '▲' : '▼'}</span>
        </button>
        {isCouncilInfoOpen && (
          <div className="council-collapsible-body">
            <div className="council-chat-meta">
              <div className="council-chat-meta-row">
                <span className="council-chat-meta-label">Primary</span>
                <span
                  className="council-chat-primary-chip"
                  style={{ borderColor: AI_COLORS[primaryAi].primary, color: AI_COLORS[primaryAi].primary }}
                >
                  {AI_ICONS[primaryAi]} {AI_DISPLAY_NAMES[primaryAi]}
                </span>
              </div>
              <div className="council-chat-meta-row">
                <span className="council-chat-meta-label">Active</span>
                <span className="council-chat-meta-value">{participantSummary}</span>
              </div>
              <div className="council-chat-hint">
                Mention one active AI such as <code>@Gemini</code> or <code>@Claude</code>, or use <code>@all</code> to collect sequential replies from every active AI. Messages without a mention are saved to the shared transcript and wait for your next routing instruction.
              </div>
            </div>
            <div className="council-chat-participants">
              {enabledAis.map((ai) => {
                const color = AI_COLORS[ai]
                const role = AI_ROLE_PRESETS[ai]
                const isPending = room.pendingAi === ai
                return (
                  <div
                    key={ai}
                    className={`council-participant-chip ${isPending ? 'pending' : ''}`}
                    style={{
                      borderColor: `${color.primary}55`,
                      background: `${color.primary}12`,
                    }}
                    title={role.detail}
                  >
                    <span className="council-participant-name" style={{ color: color.primary }}>
                      {AI_ICONS[ai]} {AI_DISPLAY_NAMES[ai]}
                    </span>
                    <span className="council-participant-role">{role.title}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {moderatorSnapshot && (
        <div className="council-collapsible-section moderator">
          <button
            className={`council-collapsible-header ${isModeratorOpen ? 'open' : ''}`}
            onClick={() => setIsModeratorOpen((v) => !v)}
            aria-expanded={isModeratorOpen}
          >
            <span className="council-collapsible-title">🧭 Moderator Snapshot</span>
            <span className="council-collapsible-count">
              {moderatorSnapshot.nextSpeaker
                ? `Next: ${AI_DISPLAY_NAMES[moderatorSnapshot.nextSpeaker]}`
                : 'Active'}
            </span>
            <span className="council-collapsible-chevron">{isModeratorOpen ? '▲' : '▼'}</span>
          </button>
          {isModeratorOpen && (
            <div className="council-collapsible-body">
              <div className="council-moderator-card">
                <div className="council-moderator-header">
                  <div>
                    <div className="council-moderator-kicker">Moderator Snapshot</div>
                    <div className="council-moderator-title">
                      {moderatorSnapshot.nextSpeaker
                        ? `Best next speaker: ${AI_DISPLAY_NAMES[moderatorSnapshot.nextSpeaker]}`
                        : 'Discussion snapshot'}
                    </div>
                  </div>
                  <div className="council-moderator-actions">
                    <button
                      className="council-moderator-ask-btn"
                      onClick={() => applyModeratorPrompt(moderatorSnapshot.nextPrompt)}
                      disabled={room.status === 'running' || isSending}
                    >
                      Ask Suggested AI
                    </button>
                    <button
                      className="council-moderator-send-btn"
                      onClick={() => void sendModeratorPromptNow(moderatorSnapshot.nextPrompt)}
                      disabled={room.status === 'running' || isSending}
                    >
                      Send Now
                    </button>
                  </div>
                </div>
                <div className="council-moderator-grid">
                  <div className="council-moderator-item">
                    <span className="council-moderator-label">Consensus</span>
                    <div className="council-moderator-text">{moderatorSnapshot.consensus}</div>
                  </div>
                  <div className="council-moderator-item">
                    <span className="council-moderator-label">Disagreement</span>
                    <div className="council-moderator-text">{moderatorSnapshot.disagreement}</div>
                  </div>
                  <div className="council-moderator-item">
                    <span className="council-moderator-label">Missing angle</span>
                    <div className="council-moderator-text">{moderatorSnapshot.missingAngle}</div>
                  </div>
                  <div className="council-moderator-item">
                    <span className="council-moderator-label">Suggested prompt</span>
                    <div className="council-moderator-prompt">{moderatorSnapshot.nextPrompt}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {pinnedCandidates.length > 0 && (
        <div className="council-collapsible-section candidates">
          <button
            className={`council-collapsible-header ${isCandidatesOpen ? 'open' : ''}`}
            onClick={() => setIsCandidatesOpen((v) => !v)}
            aria-expanded={isCandidatesOpen}
          >
            <span className="council-collapsible-title">📌 Workflow Candidates</span>
            <span className="council-collapsible-count">
              {pinnedCandidates.length} pinned
            </span>
            <span className="council-collapsible-chevron">{isCandidatesOpen ? '▲' : '▼'}</span>
          </button>
          {isCandidatesOpen && (
            <div className="council-collapsible-body">
              <div className="council-candidate-panel">
                <div className="council-candidate-header">
                  <div>
                    <div className="council-candidate-kicker">Workflow Candidates</div>
                    <div className="council-candidate-title">Pin strong replies, compare them, then choose one.</div>
                  </div>
                  <button
                    className="council-candidate-use-btn"
                    onClick={() => void onUseSelectedCandidate()}
                    disabled={!canUseSelectedCandidate || modeSwitchPending}
                  >
                    {modeSwitchPending ? 'Switching...' : 'Use Selected In Workflow'}
                  </button>
                </div>
                <div className="council-candidate-list">
                  {pinnedCandidates.map((message) => {
                    const ai = message.ai as AiName
                    const color = AI_COLORS[ai]
                    const isSelected = selectedCandidateId === message.id
                    return (
                      <button
                        key={message.id}
                        className={`council-candidate-card ${isSelected ? 'selected' : ''}`}
                        style={{
                          borderColor: isSelected ? `${color.primary}aa` : `${color.primary}35`,
                          background: isSelected ? `${color.primary}16` : `${color.primary}0d`,
                        }}
                        onClick={() => onSelectCandidate(message.id)}
                      >
                        <div className="council-candidate-card-head">
                          <span className="council-candidate-author" style={{ color: color.primary }}>
                            {AI_ICONS[ai]} {AI_DISPLAY_NAMES[ai]}
                          </span>
                          <button
                            className="council-candidate-unpin"
                            onClick={(e) => {
                              e.stopPropagation()
                              onToggleCandidatePin(message.id)
                            }}
                          >
                            Unpin
                          </button>
                        </div>
                        <div className="council-candidate-role">{AI_ROLE_PRESETS[ai].title}</div>
                        <div className="council-candidate-excerpt">{message.text}</div>
                      </button>
                    )
                  })}
                </div>
                {candidateComparison && (
                  <div className="council-compare-card">
                    <div className="council-compare-header">
                      <div>
                        <div className="council-compare-kicker">Compare Summary</div>
                        <div className="council-compare-title">
                          Recommended candidate: {candidateComparison.recommendedAiLabel}
                        </div>
                      </div>
                      <button
                        className="council-compare-select-btn"
                        onClick={() => onSelectCandidate(candidateComparison.recommendedId)}
                      >
                        Select Recommended
                      </button>
                    </div>
                    <div className="council-compare-reason">{candidateComparison.recommendedReason}</div>
                    <div className="council-compare-grid">
                      {candidateComparison.candidateNotes.map((candidate) => (
                        <div key={candidate.id} className="council-compare-note">
                          <div className="council-compare-note-head">
                            <span className="council-compare-note-ai">{candidate.aiLabel}</span>
                            <span className="council-compare-note-role">{candidate.roleTitle}</span>
                          </div>
                          <div className="council-compare-note-line">
                            <strong>Strength:</strong> {candidate.strength}
                          </div>
                          <div className="council-compare-note-line">
                            <strong>Caution:</strong> {candidate.caution}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="council-compare-risks">
                      <div className="council-compare-risks-title">Remaining risks</div>
                      <ul className="council-compare-risks-list">
                        {candidateComparison.remainingRisks.map((risk) => (
                          <li key={risk}>{risk}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                {mergedCandidate && (
                  <div className="council-merge-card">
                    <div className="council-merge-header">
                      <div>
                        <div className="council-merge-kicker">Merge Draft</div>
                        <div className="council-merge-title">{mergedCandidate.title}</div>
                      </div>
                      <button
                        className="council-merge-use-btn"
                        onClick={() => void onUseMergedCandidate()}
                        disabled={!canUseMergedCandidate || modeSwitchPending}
                      >
                        {modeSwitchPending ? 'Switching...' : 'Use Merge In Workflow'}
                      </button>
                    </div>
                    <div className="council-merge-description">{mergedCandidate.description}</div>
                    <div className="council-merge-contributors">
                      {mergedCandidate.contributorLabels.map((label) => (
                        <span key={label} className="council-merge-chip">{label}</span>
                      ))}
                    </div>
                    <div className="council-merge-draft">{mergedCandidate.draftText}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="council-chat-messages" ref={scrollerRef}>
        {room.messages.map((message) => (
          <CouncilMessageBubble
            key={message.id}
            message={message}
            modeSwitchPending={modeSwitchPending}
            onSendToWorkflow={onSendMessageToWorkflow}
            onToggleCandidatePin={onToggleCandidatePin}
            isPinned={pinnedCandidates.some((candidate) => candidate.id === message.id)}
          />
        ))}
      </div>

      <div className="council-chat-composer">
        {room.failedTurn && (
          <div className="council-failure-banner">
            <div className="council-failure-title">
              {AI_DISPLAY_NAMES[room.failedTurn.ai]} needs recovery
            </div>
            <div className="council-failure-text">{room.failedTurn.errorMessage}</div>
            <div className="council-failure-actions">
              <button className="council-failure-btn retry" onClick={() => void onRetryFailed()}>
                Retry
              </button>
              <button className="council-failure-btn skip" onClick={() => void onSkipFailed()}>
                Skip
              </button>
            </div>
          </div>
        )}

        {(analysisLoading || recommendation) && (
          <div className="council-recommendation-card">
            {analysisLoading ? (
              <div className="council-recommendation-loading">
                <span className="council-rec-spinner" />
                <span>Finding the best AI for this prompt...</span>
              </div>
            ) : recommendation ? (
              <>
                <div className="council-recommendation-main">
                  <div className="council-recommendation-copy">
                    <span className="council-recommendation-label">Recommended AI</span>
                    <span
                      className="council-recommendation-ai"
                      style={{
                        color: AI_COLORS[recommendation.recommended].primary,
                        borderColor: AI_COLORS[recommendation.recommended].primary,
                        background: `${AI_COLORS[recommendation.recommended].primary}16`,
                      }}
                    >
                      {AI_ICONS[recommendation.recommended]} {AI_DISPLAY_NAMES[recommendation.recommended]}
                    </span>
                    {!recommendationIsActive && (
                      <span className="council-recommendation-inactive">not active</span>
                    )}
                  </div>
                  <button
                    className="council-recommendation-apply"
                    onClick={applyRecommendedMention}
                    disabled={!recommendationIsActive || room.status === 'running' || isSending}
                    style={{ '--council-rec-color': AI_COLORS[recommendation.recommended].primary } as CSSProperties}
                  >
                    Add Mention
                  </button>
                </div>
                <div className="council-recommendation-reason">{recommendation.reason}</div>
                {recommendation.roundSuggestions.length > 0 && (
                  <div className="council-recommendation-reviewers">
                    {recommendation.roundSuggestions.map((suggestion) => (
                      <span
                        key={`${suggestion.ai}-${suggestion.reason}`}
                        className="council-recommendation-reviewer"
                        title={suggestion.reason}
                        style={{
                          color: AI_COLORS[suggestion.ai].primary,
                          borderColor: `${AI_COLORS[suggestion.ai].primary}66`,
                          background: `${AI_COLORS[suggestion.ai].primary}10`,
                        }}
                      >
                        + {AI_DISPLAY_NAMES[suggestion.ai]}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        <div className="council-quick-mentions">
          <button
            className="council-mention-btn council-mention-btn-all"
            onClick={() => setDraft((current) => `${current.trimEnd()} @all `.trimStart())}
          >
            @all
          </button>
          {enabledAis.map((ai) => (
            <button
              key={ai}
              className="council-mention-btn"
              onClick={() => setDraft((current) => `${current.trimEnd()} @${AI_DISPLAY_NAMES[ai]} `.trimStart())}
            >
              @{AI_DISPLAY_NAMES[ai]}
            </button>
          ))}
        </div>

        <textarea
          ref={inputRef}
          className="council-chat-input"
          rows={4}
          placeholder="Example: @Gemini, what is your take on this?\nExample: @all, give me each of your takes in order."
          value={draft}
          onChange={(e) => {
            const next = e.target.value
            setDraft(next)
            updateMentionState(next)
          }}
          onClick={(e) => updateMentionState((e.target as HTMLTextAreaElement).value)}
          onKeyDown={handleKeyDown}
          disabled={room.status === 'running' || isSending}
        />

        {mentionSuggestions.length > 0 && (
          <div className="council-mention-menu">
            {mentionSuggestions.map((ai, index) => (
              <button
                key={ai}
                className={`council-mention-option ${index === selectedMentionIndex ? 'selected' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  insertMention(ai)
                }}
              >
                <span className="council-mention-option-name">
                  {AI_ICONS[ai]} {AI_DISPLAY_NAMES[ai]}
                </span>
                <span className="council-mention-option-role">{AI_ROLE_PRESETS[ai].title}</span>
              </button>
            ))}
          </div>
        )}

        {attachedFiles.length > 0 && (
          <div className="council-attachment-bar">
            {attachedFiles.map((file, index) => (
              <span key={file.path} className="council-attachment-chip">
                <span className="council-attachment-chip-name">{file.name}</span>
                <button
                  className="council-attachment-chip-remove"
                  onClick={() => onRemoveAttachedFile(index)}
                  aria-label={`Remove ${file.name}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="council-chat-composer-footer">
          <button
            className="council-chat-attach"
            onClick={() => void onAttachFiles()}
            disabled={room.status === 'running' || isSending}
            title="Attach files"
          >
            +Attach
          </button>
          <span className="council-chat-status">
            {room.status === 'running' && room.pendingAi
              ? `${AI_DISPLAY_NAMES[room.pendingAi]} is replying...`
              : room.lastIntent?.note ?? 'Shared transcript is ready.'}
          </span>
          <button
            className="council-chat-send"
            onClick={() => void submit()}
            disabled={(!draft.trim() && attachedFiles.length === 0) || room.status === 'running' || isSending}
          >
            Send
          </button>
        </div>
      </div>
    </aside>
  )
}

// CouncilMessageBubble + extractPreview/formatTime moved to ./CouncilMessageBubble.tsx
