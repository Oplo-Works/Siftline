import { useRef, KeyboardEvent } from 'react'
import { AiName, AI_DISPLAY_NAMES, AI_COLORS, AI_ICONS, AiRecommendation, AttachedFile, WorkflowStage } from '../types'

interface ToolbarProps {
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

const AI_NAMES: AiName[] = ['gemini', 'claude', 'chatgpt', 'perplexity', 'grok']

const EXT_ICONS: Record<string, string> = {
  pdf:  '📄',
  docx: '📝',
  doc:  '📝',
  xlsx: '📊',
  xls:  '📊',
  csv:  '📋',
  txt:  '📃',
  md:   '📃',
}

export default function Toolbar({
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

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter (without Shift) = submit  /  Shift+Enter = new line
    if (e.key === 'Enter' && !e.shiftKey && !isRunning) {
      e.preventDefault()
      onStart()
    }
  }

  const toggleAi = (ai: AiName) => {
    if (isRunning) return
    // Primary AI cannot be toggled off
    if (ai === primaryAi) return
    const isEnabled = enabledAis.includes(ai)
    if (isEnabled && enabledAis.length <= 1) return // must keep at least 1
    const next = isEnabled
      ? enabledAis.filter((a) => a !== ai)
      : [...enabledAis, ai]
    onEnabledAisChange(next)
  }

  const selectedColor = AI_COLORS[primaryAi]

  // ── Derive action button appearance from workflowStage ───────────────────
  const isWaitingNext     = workflowStage === 'waiting-next'
  const isWaitingContinue = workflowStage === 'waiting-continue'
  const isAtPausePoint    = isWaitingNext || isWaitingContinue

  // Button is clickable when idle (Start) or at a pause point (Next/Continue)
  const btnDisabled = isRunning && !isAtPausePoint

  const btnLabel = isWaitingNext
    ? 'Next'
    : isWaitingContinue
    ? 'Continue'
    : isRunning
    ? 'Running...'
    : 'Start'

  const btnIcon = isWaitingNext
    ? '▶▶'
    : isWaitingContinue
    ? '✓'
    : isRunning
    ? null
    : '▶'

  // Color overrides for pause-point states
  const btnColor = isWaitingNext
    ? { primary: '#f59e0b', glow: 'rgba(245,158,11,0.35)' }   // amber
    : isWaitingContinue
    ? { primary: '#10b981', glow: 'rgba(16,185,129,0.35)' }   // green
    : selectedColor

  const handleBtnClick = isAtPausePoint ? onProceed : onStart

  return (
    <div className="toolbar-container">
      {/* ── Row 1: AI selectors ── */}
      <div className="toolbar toolbar-row-selectors">
        {/* Primary AI */}
        <div className="toolbar-section">
          <label className="toolbar-label">Primary AI</label>
          <div className="ai-selector">
            {AI_NAMES.map((ai) => {
              const color = AI_COLORS[ai]
              const isSelected = primaryAi === ai
              // Chip is interactive when: workflow not running, OR at a pause point
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
                        } as React.CSSProperties
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

        {/* Divider */}
        <div className="toolbar-divider" />

        {/* Active panels */}
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
                        } as React.CSSProperties
                      : {}
                  }
                  onClick={() => toggleAi(ai)}
                  disabled={isRunning || isPrimary}
                  title={
                    isPrimary
                      ? `${AI_DISPLAY_NAMES[ai]} (Primary — always active)`
                      : isActive
                      ? `Hide ${AI_DISPLAY_NAMES[ai]} panel`
                      : `Show ${AI_DISPLAY_NAMES[ai]} panel`
                  }
                >
                  <span className="ai-toggle-check">{isActive ? '✓' : '○'}</span>
                  <span className="ai-chip-name">{AI_DISPLAY_NAMES[ai]}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Row 2: Query input + buttons ── */}
      <div className="toolbar toolbar-row-input">
        <div className="toolbar-query">
          <div
            className="query-input-wrapper"
            style={{ '--query-color': selectedColor.primary } as React.CSSProperties}
          >
            <textarea
              ref={inputRef}
              id="input-query"
              className="query-input"
              rows={3}
              placeholder={"Enter your question...\n(Enter to send  /  Shift+Enter for new line)"}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isRunning}
            />
          </div>
        </div>

        {/* Attach button */}
        <button
          id="btn-attach"
          className={`attach-btn ${attachedFiles.length > 0 ? 'has-files' : ''}`}
          onClick={onAttach}
          disabled={isRunning}
          title="Attach file (PDF, DOCX, XLSX, TXT, CSV, MD)"
        >
          <span className="attach-icon">📎</span>
          {attachedFiles.length > 0 && (
            <span className="attach-badge">{attachedFiles.length}</span>
          )}
        </button>

        {/* Action button: Start / Next / Continue */}
        <button
          id="btn-start"
          className={`start-btn ${isRunning && !isAtPausePoint ? 'running' : ''} ${isWaitingNext ? 'waiting-next' : ''} ${isWaitingContinue ? 'waiting-continue' : ''}`}
          style={
            {
              '--btn-color': btnColor.primary,
              '--btn-glow': btnColor.glow,
            } as React.CSSProperties
          }
          onClick={handleBtnClick}
          disabled={btnDisabled}
        >
          {isRunning && !isAtPausePoint ? (
            <>
              <span className="spinner" />
              <span>Running...</span>
            </>
          ) : (
            <>
              {btnIcon && <span>{btnIcon}</span>}
              <span>{btnLabel}</span>
            </>
          )}
        </button>
      </div>

      {/* ── AI Recommendation Banner — shown while typing query ── */}
      {!isRunning && (analysisLoading || recommendation) && (
        <div className="recommendation-bar">
          {analysisLoading ? (
            <div className="recommendation-loading">
              <span className="rec-spinner" />
              <span>Analyzing query…</span>
            </div>
          ) : recommendation ? (
            <div className="recommendation-content">
              <div className="recommendation-left">
                <span className="rec-icon">⚡</span>
                <span className="rec-label">Recommended Primary AI:</span>
                <span
                  className="rec-ai-badge"
                  style={{
                    color: AI_COLORS[recommendation.recommended].primary,
                    borderColor: AI_COLORS[recommendation.recommended].primary,
                    background: `${AI_COLORS[recommendation.recommended].primary}18`,
                  }}
                >
                  {AI_ICONS[recommendation.recommended]}&nbsp;{AI_DISPLAY_NAMES[recommendation.recommended]}
                </span>
                <span className="rec-reason">{recommendation.reason}</span>
              </div>
              <button
                id="btn-apply-recommendation"
                className="rec-apply-btn"
                style={{
                  '--rec-color': AI_COLORS[recommendation.recommended].primary,
                } as React.CSSProperties}
                onClick={() => onPrimaryAiChange(recommendation.recommended)}
                disabled={primaryAi === recommendation.recommended}
                title="Apply this recommendation"
              >
                {primaryAi === recommendation.recommended ? '✓ Applied' : 'Apply'}
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* ── Attachment bar — only rendered when files are attached ── */}
      {attachedFiles.length > 0 && (
        <div className="attachment-bar">
          <span className="attachment-bar-label">Attached:</span>
          <div className="attachment-chips">
            {attachedFiles.map((file, i) => (
              <span key={i} className="attachment-chip">
                <span className="attachment-chip-icon">
                  {EXT_ICONS[file.ext] ?? '📄'}
                </span>
                <span className="attachment-chip-name" title={file.path}>
                  {file.name}
                </span>
                {!isRunning && (
                  <button
                    className="attachment-chip-remove"
                    onClick={() => onRemoveFile(i)}
                    title="Remove file"
                  >
                    ×
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
