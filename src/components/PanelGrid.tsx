import type { CSSProperties } from 'react'
import {
  AiName,
  AiPanelState,
  AI_DISPLAY_NAMES,
  AI_COLORS,
  AI_ICONS,
  InteractionMode,
} from '../types'

interface PanelGridProps {
  panels: AiPanelState[]
  primaryAi: AiName
  layoutMode: InteractionMode
  onFocusAi: (ai: AiName) => void
  onReload: (ai: AiName) => void
  onDevTools: (ai: AiName) => void
  draftAnswer: string
}

export default function PanelGrid({
  panels,
  primaryAi,
  layoutMode,
  onFocusAi,
  onReload,
  onDevTools,
  draftAnswer,
}: PanelGridProps) {
  if (layoutMode !== 'chat') {
    return (
      <div className="panel-grid">
        {panels.map((panel) => (
          <PanelHeader
            key={panel.name}
            panel={panel}
            isPrimary={panel.name === primaryAi}
            variant="legacy"
            onFocusAi={onFocusAi}
            onReload={onReload}
            onDevTools={onDevTools}
            draftAnswer={draftAnswer}
          />
        ))}
      </div>
    )
  }

  const focusPanel = panels.find((panel) => panel.name === primaryAi) ?? panels[0]
  const comparePanels = focusPanel
    ? panels.filter((panel) => panel.name !== focusPanel.name)
    : panels
  const compareCount = Math.min(comparePanels.length, 6)

  return (
    <div className={`panel-grid hybrid-panel-grid compare-count-${compareCount}`}>
      {focusPanel && (
        <section className="focus-panel-shell">
          <PanelHeader
            panel={focusPanel}
            isPrimary
            variant="focus"
            onFocusAi={onFocusAi}
            onReload={onReload}
            onDevTools={onDevTools}
            draftAnswer={draftAnswer}
          />
          <div className="panel-view-fill" aria-hidden="true" />
        </section>
      )}

      <section className="compare-panel-shell" aria-label="Compare active AIs">
        {comparePanels.length > 0 ? (
          <div className="compare-panel-grid">
            {comparePanels.map((panel) => (
              <div key={panel.name} className="compare-panel-tile">
                <PanelHeader
                  panel={panel}
                  isPrimary={false}
                  variant="compare"
                  onFocusAi={onFocusAi}
                  onReload={onReload}
                  onDevTools={onDevTools}
                  draftAnswer={draftAnswer}
                />
                <div className="panel-view-fill" aria-hidden="true" />
              </div>
            ))}
          </div>
        ) : (
          <div className="compare-empty">
            <span>Enable another AI to compare beside the Focus pane.</span>
          </div>
        )}
      </section>
    </div>
  )
}

interface PanelHeaderProps {
  panel: AiPanelState
  isPrimary: boolean
  variant: 'legacy' | 'focus' | 'compare'
  onFocusAi: (ai: AiName) => void
  onReload: (ai: AiName) => void
  onDevTools: (ai: AiName) => void
  draftAnswer: string
}

function PanelHeader({
  panel,
  isPrimary,
  variant,
  onFocusAi,
  onReload,
  onDevTools,
  draftAnswer,
}: PanelHeaderProps) {
  const color = AI_COLORS[panel.name]
  const roleBadge = isPrimary
    ? variant === 'focus'
      ? 'Focus'
      : 'Primary'
    : variant === 'compare'
      ? 'Compare'
      : panel.role === 'reviewer'
        ? 'Reviewer'
        : ''
  const hasDraft = draftAnswer.trim().length > 0 && isPrimary

  return (
    <div
      className={`panel-header ${panel.error ? 'error' : ''} ${isPrimary ? 'primary' : ''} ${variant}`}
      style={
        {
          '--panel-color': color.primary,
          '--panel-glow': color.glow,
          borderBottom: `2px solid ${isPrimary ? color.primary : 'transparent'}`,
        } as CSSProperties
      }
    >
      <div className="panel-identity">
        <span
          className="panel-ai-icon"
          style={{ color: color.primary, textShadow: `0 0 8px ${color.glow}` }}
        >
          {AI_ICONS[panel.name]}
        </span>
        <span className="panel-ai-name">{AI_DISPLAY_NAMES[panel.name]}</span>
        <span
          className={`panel-status-dot ${panel.error ? 'error' : panel.loaded ? 'ok' : 'loading'}`}
        />
      </div>

      <div className="panel-badges">
        {roleBadge && (
          <span
            className={`role-badge ${isPrimary ? 'primary' : 'reviewer'}`}
            style={
              isPrimary
                ? { backgroundColor: `${color.primary}25`, color: color.primary, borderColor: color.primary }
                : {}
            }
          >
            {roleBadge}
          </span>
        )}
        {panel.feedback && (
          <span className="feedback-badge" title="Feedback received">
            Feedback
          </span>
        )}
        {hasDraft && (
          <span className="feedback-badge" title="Draft answer received">
            Draft
          </span>
        )}
      </div>

      <div className="panel-actions">
        {variant === 'compare' && (
          <button
            className="panel-focus-btn"
            onClick={() => onFocusAi(panel.name)}
            title={`Promote ${AI_DISPLAY_NAMES[panel.name]} to Focus`}
          >
            Focus
          </button>
        )}
        <button
          className="panel-reload-btn"
          onClick={() => onDevTools(panel.name)}
          title={`${AI_DISPLAY_NAMES[panel.name]} Inspect DOM (DevTools)`}
          style={{ fontSize: '11px', opacity: 0.6 }}
        >
          Dev
        </button>
        <button
          id={`btn-reload-${panel.name}`}
          className="panel-reload-btn"
          onClick={() => onReload(panel.name)}
          title={`Reload ${AI_DISPLAY_NAMES[panel.name]}`}
        >
          Reload
        </button>
      </div>
    </div>
  )
}
