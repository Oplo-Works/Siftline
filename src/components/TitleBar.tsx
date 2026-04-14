interface TitleBarProps {
  onMinimize: () => void
  onMaximize: () => void
  onClose: () => void
  onToggleLogs: () => void
  onToggleHistory: () => void
  logCount: number
  historyCount: number
}

export default function TitleBar({
  onMinimize,
  onMaximize,
  onClose,
  onToggleLogs,
  onToggleHistory,
  logCount,
  historyCount,
}: TitleBarProps) {
  return (
    <div className="titlebar" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <div className="titlebar-logo">
        <span className="titlebar-icon">⚡</span>
        <span className="titlebar-name">AI Council</span>
        <span className="titlebar-tagline">Multi-LLM Cross-Verification</span>
      </div>

      <div className="titlebar-actions" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          className="titlebar-action-btn"
          onClick={onToggleHistory}
          title="History"
          id="btn-toggle-history"
        >
          <span>📋</span>
          {historyCount > 0 && <span className="badge">{historyCount}</span>}
        </button>
        <button
          className="titlebar-action-btn"
          onClick={onToggleLogs}
          title="Logs"
          id="btn-toggle-logs"
        >
          <span>📊</span>
          {logCount > 0 && <span className="badge">{Math.min(logCount, 99)}</span>}
        </button>

        <div className="window-controls">
          <button className="wc-btn minimize" onClick={onMinimize} title="Minimize" id="btn-minimize" />
          <button className="wc-btn maximize" onClick={onMaximize} title="Maximize" id="btn-maximize" />
          <button className="wc-btn close" onClick={onClose} title="Close" id="btn-close" />
        </div>
      </div>
    </div>
  )
}
