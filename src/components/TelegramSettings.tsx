import { useState, useEffect } from 'react'
import type { TelegramConfig } from '../types'

interface Props {
  onClose: () => void
}

export default function TelegramSettings({ onClose }: Props) {
  const [config, setConfig] = useState<TelegramConfig>({ enabled: false, botToken: '', chatId: '', lastUpdateId: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.electronAPI.getTelegramConfig().then((conf: TelegramConfig) => {
      if (conf) setConfig(conf)
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })
  }, [])

  const handleSave = async () => {
    await window.electronAPI.setTelegramConfig(config)
    alert('Settings saved. Telegram bot ' + (config.enabled ? 'started.' : 'stopped.'))
  }

  if (loading) {
    return (
      <div className="accounts-overlay" onClick={onClose}>
        <div className="accounts-panel" onClick={(e) => e.stopPropagation()}>
          <div className="accounts-header">
            <h2 style={{ margin: 0, fontSize: 13, padding: '12px 16px', color: 'var(--text-primary)' }}>Telegram Settings</h2>
            <button className="accounts-close-btn" onClick={onClose} title="Close">x</button>
          </div>
          <div className="accounts-loading">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="accounts-overlay" onClick={onClose}>
      <div className="accounts-panel" style={{ display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        <div className="accounts-header">
          <h2 style={{ margin: 0, fontSize: 13, padding: '12px 16px', color: 'var(--text-primary)' }}>Telegram Settings</h2>
          <button className="accounts-close-btn" onClick={onClose} title="Close">x</button>
        </div>
        
        <div className="accounts-body" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', color: 'var(--text-primary)' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={config.enabled} 
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })} 
                style={{ cursor: 'pointer' }}
              />
              Enable Telegram Bot
            </label>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text-secondary)' }}>Bot Token (@BotFather)</label>
            <input 
              type="password" 
              value={config.botToken} 
              onChange={(e) => setConfig({ ...config, botToken: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', outline: 'none', fontFamily: 'var(--font-mono)', fontSize: 12 }}
              placeholder="123456789:AAH..."
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text-secondary)' }}>Allowed Chat ID (Your User ID)</label>
            <input 
              type="text" 
              value={config.chatId} 
              onChange={(e) => setConfig({ ...config, chatId: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', outline: 'none', fontFamily: 'var(--font-mono)', fontSize: 12 }}
              placeholder="Leave blank to allow any, or enter your Chat ID"
            />
            <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: 6, fontSize: 11, lineHeight: 1.4 }}>
              Send a message to your bot and check the console logs to find your chat ID, or use @userinfobot.
            </small>
          </div>
        </div>

        <div className="apikeys-footer" style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', display: 'flex', justifyContent: 'flex-start' }}>
          <button 
            className="account-btn login-btn"
            onClick={handleSave}
          >
            Save & Apply
          </button>
        </div>
      </div>
    </div>
  )
}
