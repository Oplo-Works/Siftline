import { HistoryItem, AI_DISPLAY_NAMES, AI_COLORS, AI_ICONS } from '../types'

interface HistoryDrawerProps {
  history: HistoryItem[]
  onClose: () => void
  onClear: () => void
  onSelect: (item: HistoryItem) => void
}

export default function HistoryDrawer({
  history,
  onClose,
  onClear,
  onSelect,
}: HistoryDrawerProps) {
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer history-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <span className="drawer-title">📋 History</span>
          <div className="drawer-actions">
            <button id="btn-clear-history" className="drawer-action-btn" onClick={onClear}>
              Clear All
            </button>
            <button id="btn-close-history" className="drawer-close-btn" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>
        <div className="drawer-content history-list">
          {history.length === 0 ? (
            <div className="drawer-empty">No history yet.</div>
          ) : (
            history.map((item) => {
              const color = AI_COLORS[item.primaryAi]
              return (
                <div
                  key={item.id}
                  className="history-item"
                  onClick={() => {
                    onSelect(item)
                    onClose()
                  }}
                  style={{ '--history-color': color.primary } as React.CSSProperties}
                >
                  <div className="history-item-header">
                    <span
                      className="history-ai-icon"
                      style={{ color: color.primary }}
                    >
                      {AI_ICONS[item.primaryAi]}
                    </span>
                    <span className="history-ai-name">
                      {AI_DISPLAY_NAMES[item.primaryAi]}
                    </span>
                    <span className="history-time">
                      {new Date(item.timestamp).toLocaleString('en-US')}
                    </span>
                  </div>
                  <div className="history-query">{item.query}</div>
                  <div className="history-preview">
                    {item.result.slice(0, 120)}
                    {item.result.length > 120 ? '...' : ''}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
