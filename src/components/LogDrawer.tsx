import { LogEntry } from '../types'

interface LogDrawerProps {
  logs: LogEntry[]
  onClose: () => void
  onClear: () => void
}

const LEVEL_ICONS: Record<LogEntry['level'], string> = {
  info: 'ℹ',
  warn: '⚠',
  error: '✖',
}

function formatTime(ts?: number): string {
  if (!ts) return '--:--:--'
  const d = new Date(ts)
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(n => String(n).padStart(2, '0'))
    .join(':')
}

export default function LogDrawer({ logs, onClose, onClear }: LogDrawerProps) {
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer log-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <span className="drawer-title">📊 Execution Logs</span>
          <div className="drawer-actions">
            <button id="btn-clear-logs" className="drawer-action-btn" onClick={onClear}>
              Clear
            </button>
            <button id="btn-close-logs" className="drawer-close-btn" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>
        <div className="drawer-content log-list">
          {logs.length === 0 ? (
            <div className="drawer-empty">No logs yet.</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className={`log-entry log-${log.level}`}>
                <span className="log-time" style={{ opacity: 0.5, fontSize: '0.8em', marginRight: '6px', fontVariantNumeric: 'tabular-nums' as const }}>
                  {formatTime(log.timestamp)}
                </span>
                <span className="log-icon">{LEVEL_ICONS[log.level]}</span>
                <span className="log-msg">{log.msg}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
