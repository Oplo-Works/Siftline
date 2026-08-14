import { useEffect, useRef, useState } from 'react'
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
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copiedTimer.current !== null) clearTimeout(copiedTimer.current)
    }
  }, [])

  const showCopied = () => {
    setCopied(true)
    if (copiedTimer.current !== null) clearTimeout(copiedTimer.current)
    copiedTimer.current = setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer log-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <span className="drawer-title">📊 Execution Logs</span>
          <div className="drawer-actions">
            <button
              id="btn-copy-logs"
              className="drawer-action-btn"
              disabled={copied}
              onClick={() => {
                const text = logs
                  .map((log) => `[${formatTime(log.timestamp)}] [${log.level}] ${log.msg}`)
                  .join('\n')
                const fallback = () => {
                  const ta = document.createElement('textarea')
                  ta.value = text
                  ta.style.position = 'fixed'
                  ta.style.opacity = '0'
                  document.body.appendChild(ta)
                  ta.select()
                  try { document.execCommand('copy') } catch { /* ignore */ }
                  ta.remove()
                  showCopied()
                }
                if (navigator.clipboard?.writeText) {
                  navigator.clipboard.writeText(text).then(showCopied).catch(fallback)
                } else {
                  fallback()
                }
              }}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
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
