import { useEffect, useRef, useState } from 'react'
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

const DEFAULT_FOCUS_RATIO = 0.32
const MIN_FOCUS_RATIO = 0.2
const MAX_FOCUS_RATIO = 0.65

export default function PanelGrid({
  panels,
  primaryAi,
  layoutMode,
  onFocusAi,
  onReload,
  onDevTools,
  draftAnswer,
}: PanelGridProps) {
  const [focusRatio, setFocusRatio] = useState(DEFAULT_FOCUS_RATIO)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const dragState = useRef<{ startX: number; startRatio: number } | null>(null)

  // Load persisted split ratio
  useEffect(() => {
    if (layoutMode !== 'chat') return
    window.electronAPI.getFocusSplitRatio().then((ratio) => {
      if (typeof ratio === 'number' && !Number.isNaN(ratio)) setFocusRatio(ratio)
    }).catch(() => { /* keep default */ })
  }, [layoutMode])

  const startSplitDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragState.current = { startX: e.clientX, startRatio: focusRatio }
    e.currentTarget.setPointerCapture(e.pointerId)
    // BrowserViews render above the renderer and swallow pointer events, so the
    // drag would stall as soon as the cursor crosses a panel. Hide the views for
    // the duration of the drag (page state is preserved; same mechanism the
    // drawers use) and restore them on release.
    window.electronAPI.setViewsVisible(false).catch(() => { /* ignore */ })
  }

  const onSplitDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragState.current
    const grid = gridRef.current
    if (!drag || !grid) return
    const trackW = grid.clientWidth - 12 // grid padding 6px * 2
    if (trackW <= 0) return
    const next = Math.min(
      MAX_FOCUS_RATIO,
      Math.max(MIN_FOCUS_RATIO, drag.startRatio + (e.clientX - drag.startX) / trackW),
    )
    setFocusRatio(next)
  }

  const endSplitDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const wasDragging = dragState.current !== null
    dragState.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (!wasDragging) return
    // Persist the final ratio (recomputes BrowserView bounds) and bring the views back.
    window.electronAPI.setFocusSplitRatio(focusRatio)
      .catch(() => { /* ignore */ })
      .finally(() => {
        window.electronAPI.setViewsVisible(true).catch(() => { /* ignore */ })
      })
  }

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

  const focusPct = (focusRatio * 100).toFixed(2)
  // Divider sits on the gap between the two grid columns:
  // left padding (6px) + focus track (ratio of the content box) + half gap (3px)
  // minus half the divider width (5px). Matches computeHybridViewBounds in main.ts.
  const dividerLeft = `calc(6px + (100% - 12px) * ${focusRatio} + 3px - 5px)`

  return (
    <div
      ref={gridRef}
      className={`panel-grid hybrid-panel-grid compare-count-${compareCount}`}
      style={{
        gridTemplateColumns: `minmax(300px, ${focusPct}%) minmax(260px, 1fr)`,
      }}
    >
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

      <div
        className="focus-split-divider"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize Focus pane"
        title="Drag to resize the Focus pane"
        style={{ left: dividerLeft }}
        onPointerDown={startSplitDrag}
        onPointerMove={onSplitDrag}
        onPointerUp={endSplitDrag}
        onPointerCancel={endSplitDrag}
      />

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
