import { useState, useEffect, useCallback, useRef } from 'react'
import { AiName, AI_DISPLAY_NAMES, AI_COLORS, AI_ICONS } from '../types'

const AI_NAMES: AiName[] = ['chatgpt', 'claude', 'deepseek', 'gemini', 'grok', 'zai', 'perplexity']
const DEFAULT_ORDER = ['chatgpt', 'claude', 'deepseek', 'gemini', 'grok', 'zai', 'perplexity']

type ProviderId = AiName | 'deepseek'
type Tab = 'accounts' | 'apikeys'

interface ProviderMeta {
  label: string
  placeholder: string
  href: string
  icon: string
  color: string
  glow: string
  isInference?: boolean
}

const PROVIDER_META: Record<ProviderId, ProviderMeta> = {
  chatgpt: {
    label: 'OpenAI API Key',
    placeholder: 'sk-...',
    href: 'https://platform.openai.com/api-keys',
    icon: AI_ICONS.chatgpt,
    color: AI_COLORS.chatgpt.primary,
    glow: AI_COLORS.chatgpt.glow,
  },
  claude: {
    label: 'Claude (Anthropic) API Key',
    placeholder: 'sk-ant-...',
    href: 'https://console.anthropic.com/settings/keys',
    icon: AI_ICONS.claude,
    color: AI_COLORS.claude.primary,
    glow: AI_COLORS.claude.glow,
  },
  gemini: {
    label: 'Gemini API Key',
    placeholder: 'AIza...',
    href: 'https://aistudio.google.com/app/apikey',
    icon: AI_ICONS.gemini,
    color: AI_COLORS.gemini.primary,
    glow: AI_COLORS.gemini.glow,
  },
  grok: {
    label: 'xAI (Grok) API Key',
    placeholder: 'xai-...',
    href: 'https://console.x.ai/',
    icon: AI_ICONS.grok,
    color: AI_COLORS.grok.primary,
    glow: AI_COLORS.grok.glow,
  },
  deepseek: {
    label: 'DeepSeek API Key',
    placeholder: 'sk-...',
    href: 'https://platform.deepseek.com/api_keys',
    icon: AI_ICONS.deepseek,
    color: AI_COLORS.deepseek.primary,
    glow: AI_COLORS.deepseek.glow,
    isInference: true,
  },
  perplexity: {
    label: 'Perplexity API Key',
    placeholder: 'pplx-...',
    href: 'https://www.perplexity.ai/settings/api',
    icon: AI_ICONS.perplexity,
    color: AI_COLORS.perplexity.primary,
    glow: AI_COLORS.perplexity.glow,
  },
  zai: {
    label: 'Z.ai (GLM) API Key',
    placeholder: '...',
    href: 'https://z.ai/model-api',
    icon: AI_ICONS.zai,
    color: AI_COLORS.zai.primary,
    glow: AI_COLORS.zai.glow,
    isInference: true,
  },
}

interface Props {
  onClose: () => void
  onOpenZaiPanel: () => Promise<void>
}

export default function AccountsPanel({ onClose, onOpenZaiPanel }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('accounts')
  const [status, setStatus] = useState<Record<AiName, boolean>>({
    chatgpt: false,
    claude: false,
    gemini: false,
    grok: false,
    deepseek: false,
    perplexity: false,
    zai: false,
  })
  const [loading, setLoading] = useState(true)
  const [busyAi, setBusyAi] = useState<AiName | null>(null)
  const [busyAll, setBusyAll] = useState(false)

  const [apiKeys, setApiKeys] = useState<Partial<Record<ProviderId, string>>>({})
  const [keyOrder, setKeyOrder] = useState<string[]>(DEFAULT_ORDER)
  const [keysLoading, setKeysLoading] = useState(true)
  const [keysSaved, setKeysSaved] = useState(false)
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})

  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const dragNode = useRef<HTMLDivElement | null>(null)

  const refresh = useCallback(async () => {
    const nextStatus = await window.electronAPI.getLoginStatus()
    setStatus(nextStatus)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    return window.electronAPI.onLoginStatusChanged(refresh)
  }, [refresh])

  useEffect(() => {
    Promise.all([
      window.electronAPI.getApiKeys(),
      window.electronAPI.getApiKeyOrder(),
    ]).then(([keys, order]) => {
      setApiKeys((keys ?? {}) as Partial<Record<ProviderId, string>>)
      const stored = (order ?? []) as string[]
      const merged = [
        ...stored.filter((provider) => DEFAULT_ORDER.includes(provider)),
        ...DEFAULT_ORDER.filter((provider) => !stored.includes(provider)),
      ]
      setKeyOrder(merged)
      setKeysLoading(false)
    })
  }, [])

  const handleLogin = async (ai: AiName) => {
    setBusyAi(ai)
    try {
      if (ai === 'zai') {
        await onOpenZaiPanel()
        return
      }
      await window.electronAPI.openLoginWindow(ai)
      await refresh()
    } finally {
      setBusyAi(null)
    }
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

  const handleKeyChange = (id: string, value: string) => {
    setApiKeys((prev) => ({ ...prev, [id]: value }))
    setKeysSaved(false)
  }

  const handleSaveKeys = async () => {
    await window.electronAPI.setApiKeys(apiKeys as Partial<Record<AiName, string>> & { deepseek?: string })
    await window.electronAPI.setApiKeyOrder(keyOrder)
    setKeysSaved(true)
    setTimeout(() => setKeysSaved(false), 2500)
  }

  const toggleShow = (id: string) => {
    setShowKeys((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const maskKey = (key: string) => {
    if (!key) return ''
    if (key.length <= 8) return '*'.repeat(key.length)
    return `${key.slice(0, 4)}${'*'.repeat(Math.min(key.length - 8, 20))}${key.slice(-4)}`
  }

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDragIndex(index)
    dragNode.current = e.currentTarget
    e.dataTransfer.effectAllowed = 'move'
    setTimeout(() => dragNode.current?.classList.add('dragging'), 0)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (index !== dragOverIndex) setDragOverIndex(index)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === dropIndex) return

    const newOrder = [...keyOrder]
    const [moved] = newOrder.splice(dragIndex, 1)
    newOrder.splice(dropIndex, 0, moved)

    setKeyOrder(newOrder)
    window.electronAPI.setApiKeyOrder(newOrder)
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    dragNode.current?.classList.remove('dragging')
    dragNode.current = null
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  return (
    <div className="accounts-overlay" onClick={onClose}>
      <div className="accounts-panel" onClick={(e) => e.stopPropagation()}>
        <div className="accounts-header">
          <div className="accounts-tabs">
            <button
              id="tab-accounts"
              className={`accounts-tab-btn ${activeTab === 'accounts' ? 'active' : ''}`}
              onClick={() => setActiveTab('accounts')}
            >
              Accounts
            </button>
            <button
              id="tab-apikeys"
              className={`accounts-tab-btn ${activeTab === 'apikeys' ? 'active' : ''}`}
              onClick={() => setActiveTab('apikeys')}
            >
              API Keys
            </button>
          </div>
          <button className="accounts-close-btn" onClick={onClose} title="Close">x</button>
        </div>

        {activeTab === 'accounts' && (
          <>
            <div className="accounts-body">
              {loading ? (
                <div className="accounts-loading">Checking sessions...</div>
              ) : (
                AI_NAMES.map((ai) => {
                  const color = AI_COLORS[ai]
                  const loggedIn = status[ai]
                  const busy = busyAi === ai

                  return (
                    <div key={ai} className="account-row">
                      <span className="account-ai-icon" style={{ color: color.primary, textShadow: `0 0 8px ${color.glow}` }}>
                        {AI_ICONS[ai]}
                      </span>
                      <span className="account-ai-name">{AI_DISPLAY_NAMES[ai]}</span>
                      <span className={`account-status-dot ${loggedIn ? 'ok' : 'off'}`} title={loggedIn ? 'Logged in' : 'Not logged in'} />
                      <span className={`account-status-label ${loggedIn ? 'ok' : 'off'}`}>
                        {loggedIn ? 'Logged in' : 'Not logged in'}
                      </span>
                      <div className="account-actions">
                        <button
                          className="account-btn login-btn"
                          onClick={() => handleLogin(ai)}
                          disabled={busy || busyAll}
                          title={ai === 'zai'
                            ? 'Open the embedded Z.ai panel to log in or manage this session'
                            : loggedIn ? 'Re-login' : 'Login'}
                        >
                          {busy ? '...' : ai === 'zai' ? 'Open panel' : loggedIn ? 'Re-login' : 'Login'}
                        </button>
                        <button
                          className={`account-btn logout-btn ${!loggedIn ? 'disabled' : ''}`}
                          onClick={() => loggedIn && handleLogout(ai)}
                          disabled={busy || busyAll || !loggedIn}
                          title="Logout"
                        >
                          {busy ? '...' : 'Logout'}
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            {!loading && (
              <div className="accounts-footer">
                <button className="account-btn logout-all-btn" onClick={handleLogoutAll} disabled={busyAll || busyAi !== null}>
                  {busyAll ? 'Logging out...' : 'Logout All'}
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === 'apikeys' && (
          <>
            <div className="apikeys-body">
              <p className="apikeys-desc">
                Drag rows to set the <strong>recommendation engine priority</strong>.
                The first provider with a key will be used first. All fields are optional.
              </p>

              {keysLoading ? (
                <div className="accounts-loading">Loading keys...</div>
              ) : (
                <div className="apikey-sortable-list">
                  {keyOrder.map((providerId, index) => {
                    const meta = PROVIDER_META[providerId as ProviderId]
                    if (!meta) return null

                    const value = apiKeys[providerId as ProviderId] ?? ''
                    const visible = showKeys[providerId]
                    const isDragging = dragIndex === index
                    const isDragOver = dragOverIndex === index && dragIndex !== index

                    return (
                      <div
                        key={providerId}
                        className={`apikey-row ${meta.isInference ? 'apikey-row-deepseek' : ''} ${isDragging ? 'is-dragging' : ''} ${isDragOver ? 'is-drag-over' : ''}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                        onDragLeave={handleDragLeave}
                      >
                        <div className="apikey-row-header">
                          <span className="apikey-drag-handle" title="Drag to reorder">::</span>
                          <span className="apikey-priority-badge">{index + 1}</span>
                          <span className="account-ai-icon" style={{ color: meta.color, textShadow: `0 0 8px ${meta.glow}` }}>
                            {meta.icon}
                          </span>
                          <span className="apikey-label">{meta.label}</span>
                          <a href={meta.href} target="_blank" rel="noopener noreferrer" className="apikey-get-link" title="Get API key">
                            Get key
                          </a>
                        </div>

                        <div className="apikey-input-row">
                          <input
                            id={`apikey-${providerId}`}
                            type={visible ? 'text' : 'password'}
                            className="apikey-input"
                            value={value}
                            onChange={(e) => handleKeyChange(providerId, e.target.value)}
                            placeholder={meta.placeholder}
                            spellCheck={false}
                            autoComplete="off"
                            style={{ '--ai-color': meta.color } as React.CSSProperties}
                          />
                          <button className="apikey-toggle-btn" onClick={() => toggleShow(providerId)} title={visible ? 'Hide' : 'Show'}>
                            {visible ? 'Hide' : 'Show'}
                          </button>
                          {value && !visible && (
                            <span className="apikey-masked" title="Saved key preview">{maskKey(value)}</span>
                          )}
                        </div>

                        {meta.isInference && (
                          <p className="apikey-deepseek-note">
                            DeepSeek API access is optional here. The DeepSeek chat panel is now a regular toggleable panel in the main app as well.
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="apikeys-footer">
              <button
                id="save-api-keys-btn"
                className={`account-btn apikeys-save-btn ${keysSaved ? 'saved' : ''}`}
                onClick={handleSaveKeys}
                disabled={keysLoading}
              >
                {keysSaved ? 'Saved!' : 'Save API Keys'}
              </button>
              <span className="apikeys-note">Order auto-saves on drag. Keys stay in local storage only.</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
