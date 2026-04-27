import type { CSSProperties } from 'react'
import type { InteractionMode } from '../types'

interface TitleBarProps {
  mode: InteractionMode
  modeSwitchDisabled: boolean
  onModeChange: (mode: InteractionMode) => void
  onMinimize: () => void
  onMaximize: () => void
  onClose: () => void
  onToggleLogs: () => void
  onToggleHistory: () => void
  onToggleAccounts: () => void
  logCount: number
  historyCount: number
  showAccounts: boolean
  showTelegram: boolean
  onToggleTelegram: () => void
}

export default function TitleBar({
  mode,
  modeSwitchDisabled,
  onModeChange,
  onMinimize,
  onMaximize,
  onClose,
  onToggleLogs,
  onToggleHistory,
  onToggleAccounts,
  logCount,
  historyCount,
  showAccounts,
  showTelegram,
  onToggleTelegram,
}: TitleBarProps) {
  return (
    <div className="titlebar" style={{ WebkitAppRegion: 'drag' } as CSSProperties}>
      <div className="titlebar-logo">
        <span className="titlebar-icon">AI</span>
        <span className="titlebar-name">AI Council</span>
        <span className="titlebar-tagline">Multi-LLM Cross-Verification</span>
      </div>

      <div className="titlebar-center" style={{ WebkitAppRegion: 'drag' } as CSSProperties}>
        <div className="titlebar-drag-spacer" />
        <div className="mode-toggle" aria-label="Interaction mode" style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}>
          <button
            className={`mode-toggle-btn ${mode === 'workflow' ? 'active' : ''}`}
            onClick={() => onModeChange('workflow')}
            disabled={modeSwitchDisabled}
            title="Use the existing primary-review-revise workflow"
          >
            Workflow
          </button>
          <button
            className={`mode-toggle-btn ${mode === 'chat' ? 'active' : ''}`}
            onClick={() => onModeChange('chat')}
            disabled={modeSwitchDisabled}
            title="Use the new Council Chat mode"
          >
            Council Chat
          </button>
        </div>
        <div className="titlebar-drag-spacer" />
      </div>

      <div className="titlebar-actions" style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}>
        <button
          className={`titlebar-action-btn ${showAccounts ? 'active' : ''}`}
          onClick={onToggleAccounts}
          title="Accounts"
          id="btn-toggle-accounts"
        >
          <span>Acct</span>
        </button>
        <button
          className={`titlebar-action-btn ${showTelegram ? 'active' : ''}`}
          onClick={onToggleTelegram}
          title="Telegram"
          id="btn-toggle-telegram"
        >
          <span>TG</span>
        </button>
        <button
          className="titlebar-action-btn"
          onClick={onToggleHistory}
          title="History"
          id="btn-toggle-history"
        >
          <span>Hist</span>
          {historyCount > 0 && <span className="badge">{historyCount}</span>}
        </button>
        <button
          className="titlebar-action-btn"
          onClick={onToggleLogs}
          title="Logs"
          id="btn-toggle-logs"
        >
          <span>Logs</span>
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
