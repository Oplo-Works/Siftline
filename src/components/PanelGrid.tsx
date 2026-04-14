import { AiName, AiPanelState, AI_DISPLAY_NAMES, AI_COLORS, AI_ICONS } from '../types'

interface PanelGridProps {
  panels: AiPanelState[]
  primaryAi: AiName
  onReload: (ai: AiName) => void
  onDevTools: (ai: AiName) => void
  draftAnswer: string
}

export default function PanelGrid({ panels, primaryAi, onReload, onDevTools, draftAnswer }: PanelGridProps) {
  return (
    <div className="panel-grid">
      {panels.map((panel) => (
        <PanelHeader
          key={panel.name}
          panel={panel}
          isPrimary={panel.name === primaryAi}
          onReload={onReload}
          onDevTools={onDevTools}
          draftAnswer={draftAnswer}
        />
      ))}
    </div>
  )
}

interface PanelHeaderProps {
  panel: AiPanelState
  isPrimary: boolean
  onReload: (ai: AiName) => void
  onDevTools: (ai: AiName) => void
  draftAnswer: string
}

function PanelHeader({ panel, isPrimary, onReload, onDevTools, draftAnswer }: PanelHeaderProps) {
  const color = AI_COLORS[panel.name]
  const roleBadge = isPrimary ? 'Primary' : panel.role === 'reviewer' ? 'Reviewer' : ''

  return (
    <div
      className={`panel-header ${panel.error ? 'error' : ''} ${isPrimary ? 'primary' : ''}`}
      style={
        {
          '--panel-color': color.primary,
          '--panel-glow': color.glow,
          borderBottom: `2px solid ${isPrimary ? color.primary : 'transparent'}`,
        } as React.CSSProperties
      }
    >
      {/* Left: AI identity */}
      <div className="panel-identity">
        <span
          className="panel-ai-icon"
          style={{ color: color.primary, textShadow: `0 0 8px ${color.glow}` }}
        >
          {AI_ICONS[panel.name]}
        </span>
        <span className="panel-ai-name">{AI_DISPLAY_NAMES[panel.name]}</span>

        {/* Status indicator */}
        <span
          className={`panel-status-dot ${panel.error ? 'error' : panel.loaded ? 'ok' : 'loading'}`}
        />
      </div>

      {/* Center: role badge */}
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
            ✓ Feedback
          </span>
        )}
      </div>

      {/* Right: devtools + reload buttons */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          className="panel-reload-btn"
          onClick={() => onDevTools(panel.name)}
          title={`${AI_DISPLAY_NAMES[panel.name]} Inspect DOM (DevTools)`}
          style={{ fontSize: '11px', opacity: 0.6 }}
        >
          🔍
        </button>
        <button
          id={`btn-reload-${panel.name}`}
          className="panel-reload-btn"
          onClick={() => onReload(panel.name)}
          title={`Reload ${AI_DISPLAY_NAMES[panel.name]}`}
        >
          ↺
        </button>
      </div>
    </div>
  )
}
