import { useRef, type CSSProperties, type KeyboardEvent } from 'react'
import {
  AiName,
  AI_NAMES,
  AI_DISPLAY_NAMES,
  AI_COLORS,
  AI_ICONS,
  AI_ROLE_PRESETS,
  AiRecommendation,
  AttachedFile,
  InteractionMode,
  WorkflowStage,
} from '../types'

interface ToolbarProps {
  interactionMode: InteractionMode
  primaryAi: AiName
  enabledAis: AiName[]
  query: string
  isRunning: boolean
  workflowStage: WorkflowStage
  attachedFiles: AttachedFile[]
  recommendation: AiRecommendation | null
  analysisLoading: boolean
  onPrimaryAiChange: (ai: AiName) => void
  onEnabledAisChange: (ais: AiName[]) => void
  onQueryChange: (q: string) => void
  onAttach: () => void
  onRemoveFile: (index: number) => void
  onStart: () => void
  onProceed: () => void
}

const EXT_ICONS: Record<string, string> = {
  pdf: 'PDF',
  docx: 'DOC',
  doc: 'DOC',
  xlsx: 'XLS',
  xls: 'XLS',
  csv: 'CSV',
  txt: 'TXT',
  md: 'MD',
}

export default function Toolbar({
  interactionMode,
  primaryAi,
  enabledAis,
  query,
  isRunning,
  workflowStage,
  attachedFiles,
  recommendation,
  analysisLoading,
  onPrimaryAiChange,
  onEnabledAisChange,
  onQueryChange,
  onAttach,
  onRemoveFile,
  onStart,
  onProceed,
}: ToolbarProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const trimmedQuery = query.trim()
  const hasQuery = trimmedQuery.length > 0

  const isWaitingNext = workflowStage === 'waiting-next'
  const isWaitingContinue = workflowStage === 'waiting-continue'
  const isReadyNextRound = workflowStage === 'ready-next-round'
  const isAtPausePoint = isWaitingNext || isWaitingContinue
  const isWorkflowMode = interactionMode === 'workflow'

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isWorkflowMode) return
    if (e.key === 'Enter' && !e.shiftKey && !isRunning && !isAtPausePoint) {
      e.preventDefault()
      onStart()
    }
  }

  const toggleAi = (ai: AiName) => {
    if (isRunning) return
    if (ai === primaryAi) return

    const isEnabled = enabledAis.includes(ai)
    if (isEnabled && enabledAis.length <= 1) return

    const next = isEnabled
      ? enabledAis.filter((a) => a !== ai)
      : [...enabledAis, ai]

    onEnabledAisChange(next)
  }

  const selectedColor = AI_COLORS[primaryAi]
  const canStart = isReadyNextRound || hasQuery
  const btnDisabled = isRunning || (!isAtPausePoint && !canStart)
  // Workflow mode: exclude the primary AI (it's the drafter, not a reviewer).
  // Council mode: show every active AI — all roles are equally relevant.
  const reviewerAis = AI_NAMES.filter((ai) =>
    enabledAis.includes(ai) && (isWorkflowMode ? ai !== primaryAi : true)
  )

  const btnLabel = isWaitingNext
    ? 'Next'
    : isWaitingContinue
      ? 'Continue'
      : isRunning
        ? 'Running...'
        : isReadyNextRound
          ? hasQuery
            ? 'Send Follow-up'
            : 'Next'
          : 'Start'

  const btnColor = isWaitingNext
    ? { primary: '#f59e0b', glow: 'rgba(245,158,11,0.35)' }
    : isWaitingContinue
      ? { primary: '#10b981', glow: 'rgba(16,185,129,0.35)' }
      : isReadyNextRound
        ? hasQuery
          ? { primary: '#3b82f6', glow: 'rgba(59,130,246,0.35)' }
          : { primary: '#f59e0b', glow: 'rgba(245,158,11,0.35)' }
        : selectedColor

  const handleBtnClick = isAtPausePoint ? onProceed : onStart
  const queryPlaceholder = isReadyNextRound
    ? 'Press Next for another review round, or type a related follow-up question.'
    : 'Enter your question...\n(Enter to send / Shift+Enter for new line)'

  return (
    <div className="toolbar-container">
      <div className="toolbar toolbar-row-selectors">
        <div className="toolbar-section">
          <label className="toolbar-label">{isWorkflowMode ? 'Primary AI' : 'Focus AI'}</label>
          <div className="ai-selector">
            {AI_NAMES.map((ai) => {
              const color = AI_COLORS[ai]
              const isSelected = primaryAi === ai
              const chipDisabled = isRunning && !isAtPausePoint

              return (
                <button
                  key={ai}
                  id={`btn-primary-${ai}`}
                  className={`ai-chip ${isSelected ? 'selected' : ''} ${isAtPausePoint ? 'reassignable' : ''}`}
                  style={
                    isSelected
                      ? {
                          '--chip-color': color.primary,
                          '--chip-glow': color.glow,
                          borderColor: color.primary,
                          backgroundColor: `${color.primary}18`,
                          boxShadow: `0 0 12px ${color.glow}`,
                        } as CSSProperties
                      : {}
                  }
                  onClick={() => !chipDisabled && onPrimaryAiChange(ai)}
                  disabled={chipDisabled}
                  title={
                    isAtPausePoint
                      ? `Reassign Primary AI to ${AI_DISPLAY_NAMES[ai]}`
                      : AI_DISPLAY_NAMES[ai]
                  }
                >
                  <span className="ai-chip-icon">{AI_ICONS[ai]}</span>
                  <span className="ai-chip-name">{AI_DISPLAY_NAMES[ai]}</span>
                  {isAtPausePoint && isSelected && (
                    <span className="ai-chip-reassign-hint">click to reassign</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-section">
          <label className="toolbar-label">Active</label>
          <div className="ai-selector">
            {AI_NAMES.map((ai) => {
              const color = AI_COLORS[ai]
              const isActive = enabledAis.includes(ai)
              const isPrimary = ai === primaryAi

              return (
                <button
                  key={ai}
                  className={`ai-toggle-chip ${isActive ? 'active' : 'inactive'} ${isPrimary ? 'locked' : ''}`}
                  style={
                    isActive
                      ? {
                          '--chip-color': color.primary,
                          borderColor: `${color.primary}88`,
                          color: color.primary,
                        } as CSSProperties
                      : {}
                  }
                  onClick={() => toggleAi(ai)}
                  disabled={isRunning || isPrimary}
                  title={
                    isPrimary
                      ? `${AI_DISPLAY_NAMES[ai]} (Primary, always active)`
                      : isActive
                        ? `Hide ${AI_DISPLAY_NAMES[ai]} panel`
                        : `Show ${AI_DISPLAY_NAMES[ai]} panel`
                  }
                >
                  <span className="ai-chip-name">{AI_DISPLAY_NAMES[ai]}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {reviewerAis.length > 0 && (
        <div className="reviewer-role-bar">
          <span className="reviewer-role-label">
            {isWorkflowMode ? 'Reviewer focus' : 'Council roles'}
          </span>
          <div className="reviewer-role-chips">
            {reviewerAis.map((ai) => {
              const color = AI_COLORS[ai]
              const role = AI_ROLE_PRESETS[ai]
              return (
                <div
                  key={ai}
                  className="reviewer-role-chip"
                  style={{
                    borderColor: `${color.primary}55`,
                    background: `${color.primary}10`,
                  }}
                  title={role.detail}
                >
                  <span className="reviewer-role-ai" style={{ color: color.primary }}>
                    {AI_ICONS[ai]} {AI_DISPLAY_NAMES[ai]}
                  </span>
                  <span className="reviewer-role-name">{role.title}</span>
                  <span className="reviewer-role-detail">{role.detail}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {isWorkflowMode ? (
        <div className="toolbar toolbar-row-input">
          <div className="toolbar-query">
            <div
              className="query-input-wrapper"
              style={{ '--query-color': selectedColor.primary } as CSSProperties}
            >
              <textarea
                ref={inputRef}
                id="input-query"
                className="query-input"
                rows={3}
                placeholder={queryPlaceholder}
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isRunning}
              />
            </div>
          </div>

          <button
            id="btn-attach"
            className={`attach-btn ${attachedFiles.length > 0 ? 'has-files' : ''}`}
            onClick={onAttach}
            disabled={isRunning}
            title="Attach file (PDF, DOCX, XLSX, TXT, CSV, MD)"
          >
            <span className="attach-icon">+</span>
            {attachedFiles.length > 0 && (
              <span className="attach-badge">{attachedFiles.length}</span>
            )}
          </button>

          <button
            id="btn-start"
            className={`start-btn ${isRunning ? 'running' : ''} ${isWaitingNext ? 'waiting-next' : ''} ${isWaitingContinue ? 'waiting-continue' : ''}`}
            style={
              {
                '--btn-color': btnColor.primary,
                '--btn-glow': btnColor.glow,
              } as CSSProperties
            }
            onClick={handleBtnClick}
            disabled={btnDisabled}
          >
            {isRunning ? (
              <>
                <span className="spinner" />
                <span>Running...</span>
              </>
            ) : (
              <span>{btnLabel}</span>
            )}
          </button>
        </div>
      ) : (
        <div className="toolbar toolbar-row-input toolbar-chat-mode-row">
          <div className="chat-mode-banner">
            <span className="chat-mode-banner-kicker">Siftline is on</span>
            <strong className="chat-mode-banner-title">
              Use the docked chat panel to the right.
            </strong>
            <span className="chat-mode-banner-detail">
              Mention one or more AIs (e.g. `@Gemini`, `@Gemini @DeepSeek`) or use `@all` for every active AI.
            </span>
          </div>
        </div>
      )}

      {isWorkflowMode && !isRunning && (analysisLoading || recommendation) && (
        <div className="recommendation-bar">
          {analysisLoading ? (
            <div className="recommendation-loading">
              <span className="rec-spinner" />
              <span>Analyzing query...</span>
            </div>
          ) : recommendation ? (
            <div className="recommendation-content">
              <div className="recommendation-left">
                <span className="rec-icon">AI</span>
                <span className="rec-label">Recommended Primary AI:</span>
                <span
                  className="rec-ai-badge"
                  style={{
                    color: AI_COLORS[recommendation.recommended].primary,
                    borderColor: AI_COLORS[recommendation.recommended].primary,
                    background: `${AI_COLORS[recommendation.recommended].primary}18`,
                  }}
                >
                  {AI_ICONS[recommendation.recommended]} {AI_DISPLAY_NAMES[recommendation.recommended]}
                </span>
                <span className="rec-reason">{recommendation.reason}</span>
                {recommendation.roundSuggestions.length > 0 && (
                  <span className="rec-reviewer-suggestions" aria-label="Suggested reviewer lenses">
                    {recommendation.roundSuggestions.map((suggestion) => (
                      <span
                        key={`${suggestion.ai}-${suggestion.reason}`}
                        className="rec-reviewer-chip"
                        title={suggestion.reason}
                        style={{
                          color: AI_COLORS[suggestion.ai].primary,
                          borderColor: `${AI_COLORS[suggestion.ai].primary}80`,
                          background: `${AI_COLORS[suggestion.ai].primary}12`,
                        }}
                      >
                        + {AI_DISPLAY_NAMES[suggestion.ai]}
                      </span>
                    ))}
                  </span>
                )}
              </div>
              <button
                id="btn-apply-recommendation"
                className="rec-apply-btn"
                style={{ '--rec-color': AI_COLORS[recommendation.recommended].primary } as CSSProperties}
                onClick={() => onPrimaryAiChange(recommendation.recommended)}
                disabled={primaryAi === recommendation.recommended}
                title="Apply this recommendation"
              >
                {primaryAi === recommendation.recommended ? 'Applied' : 'Apply'}
              </button>
            </div>
          ) : null}
        </div>
      )}

      {isWorkflowMode && attachedFiles.length > 0 && (
        <div className="attachment-bar">
          <span className="attachment-bar-label">Attached:</span>
          <div className="attachment-chips">
            {attachedFiles.map((file, index) => (
              <span key={index} className="attachment-chip">
                <span className="attachment-chip-icon">{EXT_ICONS[file.ext] ?? 'FILE'}</span>
                <span className="attachment-chip-name" title={file.path}>
                  {file.name}
                </span>
                {!isRunning && (
                  <button
                    className="attachment-chip-remove"
                    onClick={() => onRemoveFile(index)}
                    title="Remove file"
                  >
                    x
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
