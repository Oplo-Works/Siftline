interface StatusBarProps {
  status: string
  isRunning: boolean
  telegramEnabled?: boolean
}

export default function StatusBar({ status, isRunning, telegramEnabled }: StatusBarProps) {
  return (
    <div className={`status-bar ${isRunning ? 'running' : ''}`}>
      <div className="status-indicator">
        <span className={`status-dot ${isRunning ? 'pulse' : ''}`} />
        <span className="status-text">{status}</span>
      </div>
      {telegramEnabled && (
        <div className="status-telegram-indicator" style={{ marginLeft: 16, color: '#3b82f6', fontSize: '11px', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: '#10b981' }}>◉</span> Telegram
        </div>
      )}
      {isRunning && (
        <div className="status-progress">
          <div className="progress-bar" />
        </div>
      )}
    </div>
  )
}
