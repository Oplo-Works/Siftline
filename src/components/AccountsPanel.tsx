import { useState, useEffect, useCallback } from 'react'
import { AiName, AI_DISPLAY_NAMES, AI_COLORS, AI_ICONS } from '../types'

const AI_NAMES: AiName[] = ['gemini', 'claude', 'chatgpt', 'perplexity', 'grok']

interface Props {
  onClose: () => void
}

export default function AccountsPanel({ onClose }: Props) {
  const [status, setStatus] = useState<Record<AiName, boolean>>({
    gemini: false, claude: false, chatgpt: false, perplexity: false, grok: false,
  })
  const [loading, setLoading] = useState(true)
  const [busyAi, setBusyAi] = useState<AiName | null>(null)
  const [busyAll, setBusyAll] = useState(false)

  const refresh = useCallback(async () => {
    const s = await window.electronAPI.getLoginStatus()
    setStatus(s)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    const cleanup = window.electronAPI.onLoginStatusChanged(refresh)
    return cleanup
  }, [refresh])

  const handleLogin = async (ai: AiName) => {
    setBusyAi(ai)
    await window.electronAPI.openLoginWindow(ai)
    setBusyAi(null)
    await refresh()
  }

  const handleLogout = async (ai: AiName) => {
    setBusyAi(ai)
    await window.electronAPI.logoutAi(ai)
    setBusyAi(null)
  }

  const handleLogoutAll = async () => {
    setBusyAll(true)
    await window.electronAPI.logoutAll()
    setBusyAll(false)
  }

  return (
    <div className="accounts-overlay" onClick={onClose}>
      <div className="accounts-panel" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="accounts-header">
          <span className="accounts-title">🔑 Accounts</span>
          <button className="accounts-close-btn" onClick={onClose} title="Close">×</button>
        </div>

        {/* Body */}
        <div className="accounts-body">
          {loading ? (
            <div className="accounts-loading">Checking sessions…</div>
          ) : (
            AI_NAMES.map((ai) => {
              const color = AI_COLORS[ai]
              const loggedIn = status[ai]
              const busy = busyAi === ai

              return (
                <div key={ai} className="account-row">
                  {/* AI identity */}
                  <span
                    className="account-ai-icon"
                    style={{ color: color.primary, textShadow: `0 0 8px ${color.glow}` }}
                  >
                    {AI_ICONS[ai]}
                  </span>
                  <span className="account-ai-name">{AI_DISPLAY_NAMES[ai]}</span>

                  {/* Status */}
                  <span
                    className={`account-status-dot ${loggedIn ? 'ok' : 'off'}`}
                    title={loggedIn ? 'Logged in' : 'Not logged in'}
                  />
                  <span className={`account-status-label ${loggedIn ? 'ok' : 'off'}`}>
                    {loggedIn ? 'Logged in' : 'Not logged in'}
                  </span>

                  {/* Actions */}
                  <div className="account-actions">
                    <button
                      className="account-btn login-btn"
                      onClick={() => handleLogin(ai)}
                      disabled={busy || busyAll}
                      title={loggedIn ? 'Re-login' : 'Login'}
                    >
                      {busy ? '…' : loggedIn ? 'Re-login' : 'Login'}
                    </button>
                    <button
                      className={`account-btn logout-btn ${!loggedIn ? 'disabled' : ''}`}
                      onClick={() => loggedIn && handleLogout(ai)}
                      disabled={busy || busyAll || !loggedIn}
                      title="Logout"
                    >
                      {busy ? '…' : 'Logout'}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className="accounts-footer">
            <button
              className="account-btn logout-all-btn"
              onClick={handleLogoutAll}
              disabled={busyAll || busyAi !== null}
            >
              {busyAll ? 'Logging out…' : 'Logout All'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
