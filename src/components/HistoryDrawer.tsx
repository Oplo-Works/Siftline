import { useState } from 'react'
import { HistoryItem, AiName, AI_DISPLAY_NAMES, AI_COLORS, AI_ICONS } from '../types'

interface HistoryDrawerProps {
  history: HistoryItem[]
  onClose: () => void
  onClear: () => void
  onSelect: (item: HistoryItem) => void
}

const AI_ORDER: AiName[] = ['chatgpt', 'claude', 'gemini', 'grok', 'deepseek', 'perplexity', 'zai']

export default function HistoryDrawer({
  history,
  onClose,
  onClear,
  onSelect,
}: HistoryDrawerProps) {
  const [activeFilter, setActiveFilter] = useState<'all' | AiName>('all')

  const usedAis = AI_ORDER.filter(ai => history.some(h => h.primaryAi === ai))
  const filtered = activeFilter === 'all'
    ? history
    : history.filter(h => h.primaryAi === activeFilter)

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

        {history.length > 0 && usedAis.length > 1 && (
          <div className="history-filter-bar" style={{ display: 'flex', gap: '6px', padding: '8px 12px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveFilter('all')}
              style={{
                padding: '2px 10px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.3)',
                background: activeFilter === 'all' ? 'rgba(255,255,255,0.2)' : 'transparent',
                color: 'inherit',
                cursor: 'pointer',
                fontSize: '0.78em',
                fontWeight: activeFilter === 'all' ? 600 : 400,
              }}
            >
              All
            </button>
            {usedAis.map(ai => {
              const color = AI_COLORS[ai].primary
              const isActive = activeFilter === ai
              return (
                <button
                  key={ai}
                  onClick={() => setActiveFilter(ai)}
                  style={{
                    padding: '2px 10px',
                    borderRadius: '12px',
                    border: `1px solid ${color}`,
                    background: isActive ? color : 'transparent',
                    color: isActive ? '#fff' : color,
                    cursor: 'pointer',
                    fontSize: '0.78em',
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {AI_ICONS[ai]} {AI_DISPLAY_NAMES[ai]}
                </button>
              )
            })}
          </div>
        )}

        <div className="drawer-content history-list">
          {history.length === 0 ? (
            <div className="drawer-empty">No history yet.</div>
          ) : filtered.length === 0 ? (
            <div className="drawer-empty">No results.</div>
          ) : (
            filtered.map((item) => {
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
