interface StatusBarProps {
  status: string
  isRunning: boolean
}

export default function StatusBar({ status, isRunning }: StatusBarProps) {
  return (
    <div className={`status-bar ${isRunning ? 'running' : ''}`}>
      <div className="status-indicator">
        <span className={`status-dot ${isRunning ? 'pulse' : ''}`} />
        <span className="status-text">{status}</span>
      </div>
      {isRunning && (
        <div className="status-progress">
          <div className="progress-bar" />
        </div>
      )}
    </div>
  )
}
