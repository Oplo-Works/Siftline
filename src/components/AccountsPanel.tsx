import { useState, useEffect, useCallback, useRef } from 'react'
import { AiName, AI_DISPLAY_NAMES, AI_COLORS, AI_ICONS } from '../types'

const AI_NAMES: AiName[] = ['gemini', 'claude', 'chatgpt', 'perplexity', 'grok']

// Default full order (AI panels + Groq inference)
const DEFAULT_ORDER = ['gemini', 'claude', 'chatgpt', 'perplexity', 'grok', 'groq']

// API Key metadata per provider
type ProviderId = AiName | 'groq'
interface ProviderMeta {
  label: string
  placeholder: string
  href: string
  icon: string
  color: string
  glow: string
  isInference?: boolean  // Groq = inference-only, not an AI panel
}

const PROVIDER_META: Record<string, ProviderMeta> = {
  gemini: { label: 'Gemini API Key', placeholder: 'AIza...', href: 'https://aistudio.google.com/app/apikey', icon: AI_ICONS.gemini, color: AI_COLORS.gemini.primary, glow: AI_COLORS.gemini.glow },
  claude: { label: 'Claude (Anthropic) API Key', placeholder: 'sk-ant-...', href: 'https://console.anthropic.com/settings/keys', icon: AI_ICONS.claude, color: AI_COLORS.claude.primary, glow: AI_COLORS.claude.glow },
  chatgpt: { label: 'OpenAI API Key', placeholder: 'sk-...', href: 'https://platform.openai.com/api-keys', icon: AI_ICONS.chatgpt, color: AI_COLORS.chatgpt.primary, glow: AI_COLORS.chatgpt.glow },
  perplexity: { label: 'Perplexity API Key', placeholder: 'pplx-...', href: 'https://www.perplexity.ai/settings/api', icon: AI_ICONS.perplexity, color: AI_COLORS.perplexity.primary, glow: AI_COLORS.perplexity.glow },
  grok: { label: 'xAI (Grok) API Key', placeholder: 'xai-...', href: 'https://console.x.ai/', icon: AI_ICONS.grok, color: AI_COLORS.grok.primary, glow: AI_COLORS.grok.glow },
  groq: { label: 'Groq API Key (Llama · Ultra-fast)', placeholder: 'gsk_...', href: 'https://console.groq.com/keys', icon: '⚡', color: '#f97316', glow: 'rgba(249,115,22,0.35)', isInference: true },
}

interface Props {
  onClose: () => void
}

type Tab = 'accounts' | 'apikeys'

export default function AccountsPanel({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('accounts')

  // ── Accounts tab state ─────────────────────────────────────────────────────
  const [status, setStatus] = useState<Record<AiName, boolean>>({
    gemini: false, claude: false, chatgpt: false, perplexity: false, grok: false,
  })
  const [loading, setLoading] = useState(true)
  const [busyAi, setBusyAi] = useState<AiName | null>(null)
  const [busyAll, setBusyAll] = useState(false)

  // ── API Keys tab state ─────────────────────────────────────────────────────
  const [apiKeys, setApiKeys] = useState<Partial<Record<ProviderId, string>>>({})
  const [keyOrder, setKeyOrder] = useState<string[]>(DEFAULT_ORDER)
  const [keysLoading, setKeysLoading] = useState(true)
  const [keysSaved, setKeysSaved] = useState(false)
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})

  // ── Drag state ─────────────────────────────────────────────────────────────
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const dragNode = useRef<HTMLDivElement | null>(null)

  // ── Fetch login status ─────────────────────────────────────────────────────
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

  // ── Fetch API keys + order ─────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      window.electronAPI.getApiKeys(),
      window.electronAPI.getApiKeyOrder(),
    ]).then(([keys, order]) => {
      setApiKeys((keys ?? {}) as Partial<Record<ProviderId, string>>)
      // Merge stored order with DEFAULT_ORDER to ensure new providers appear
      const stored = (order ?? []) as string[]
      const merged = [
        ...stored.filter((p) => DEFAULT_ORDER.includes(p)),
        ...DEFAULT_ORDER.filter((p) => !stored.includes(p)),
      ]
      setKeyOrder(merged)
      setKeysLoading(false)
    })
  }, [])

  // ── Account handlers ───────────────────────────────────────────────────────
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

  // ── API key value handlers ─────────────────────────────────────────────────
  const handleKeyChange = (id: string, value: string) => {
    setApiKeys((prev) => ({ ...prev, [id]: value }))
    setKeysSaved(false)
  }

  const handleSaveKeys = async () => {
    await window.electronAPI.setApiKeys(apiKeys as Partial<Record<AiName, string>> & { groq?: string })
    await window.electronAPI.setApiKeyOrder(keyOrder)
    setKeysSaved(true)
    setTimeout(() => setKeysSaved(false), 2500)
  }

  const toggleShow = (id: string) => {
    setShowKeys((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const maskKey = (key: string) => {
    if (!key) return ''
    if (key.length <= 8) return '•'.repeat(key.length)
    return key.slice(0, 4) + '•'.repeat(Math.min(key.length - 8, 20)) + key.slice(-4)
  }

  // ── Drag-and-drop handlers ─────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDragIndex(index)
    dragNode.current = e.currentTarget
    e.dataTransfer.effectAllowed = 'move'
    // Slight delay so the "dragging" class renders after the snapshot
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
    // Auto-save order immediately on drop
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

        {/* Header */}
        <div className="accounts-header">
          <div className="accounts-tabs">
            <button
              id="tab-accounts"
              className={`accounts-tab-btn ${activeTab === 'accounts' ? 'active' : ''}`}
              onClick={() => setActiveTab('accounts')}
            >
              🔑 Accounts
            </button>
            <button
              id="tab-apikeys"
              className={`accounts-tab-btn ${activeTab === 'apikeys' ? 'active' : ''}`}
              onClick={() => setActiveTab('apikeys')}
            >
              ⚡ API Keys
            </button>
          </div>
          <button className="accounts-close-btn" onClick={onClose} title="Close">×</button>
        </div>

        {/* ── ACCOUNTS TAB ────────────────────────────────────────────── */}
        {activeTab === 'accounts' && (
          <>
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
                      <span className="account-ai-icon" style={{ color: color.primary, textShadow: `0 0 8px ${color.glow}` }}>
                        {AI_ICONS[ai]}
                      </span>
                      <span className="account-ai-name">{AI_DISPLAY_NAMES[ai]}</span>
                      <span className={`account-status-dot ${loggedIn ? 'ok' : 'off'}`} title={loggedIn ? 'Logged in' : 'Not logged in'} />
                      <span className={`account-status-label ${loggedIn ? 'ok' : 'off'}`}>
                        {loggedIn ? 'Logged in' : 'Not logged in'}
                      </span>
                      <div className="account-actions">
                        <button className="account-btn login-btn" onClick={() => handleLogin(ai)} disabled={busy || busyAll} title={loggedIn ? 'Re-login' : 'Login'}>
                          {busy ? '…' : loggedIn ? 'Re-login' : 'Login'}
                        </button>
                        <button className={`account-btn logout-btn ${!loggedIn ? 'disabled' : ''}`} onClick={() => loggedIn && handleLogout(ai)} disabled={busy || busyAll || !loggedIn} title="Logout">
                          {busy ? '…' : 'Logout'}
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
                  {busyAll ? 'Logging out…' : 'Logout All'}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── API KEYS TAB ─────────────────────────────────────────────── */}
        {activeTab === 'apikeys' && (
          <>
            <div className="apikeys-body">
              <p className="apikeys-desc">
                Drag rows to set the <strong>recommendation engine priority</strong>.
                The first provider with a key will be used first. All fields optional.
              </p>

              {keysLoading ? (
                <div className="accounts-loading">Loading keys…</div>
              ) : (
                <div className="apikey-sortable-list">
                  {keyOrder.map((providerId, index) => {
                    const meta = PROVIDER_META[providerId]
                    if (!meta) return null
                    const val = apiKeys[providerId as ProviderId] ?? ''
                    const visible = showKeys[providerId]
                    const isDragging = dragIndex === index
                    const isDragOver = dragOverIndex === index && dragIndex !== index

                    return (
                      <div
                        key={providerId}
                        className={`apikey-row ${meta.isInference ? 'apikey-row-groq' : ''} ${isDragging ? 'is-dragging' : ''} ${isDragOver ? 'is-drag-over' : ''}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                        onDragLeave={handleDragLeave}
                      >
                        {/* Priority badge + drag handle */}
                        <div className="apikey-row-header">
                          <span className="apikey-drag-handle" title="Drag to reorder">⠿</span>
                          <span className="apikey-priority-badge">{index + 1}</span>
                          <span className="account-ai-icon" style={{ color: meta.color, textShadow: `0 0 8px ${meta.glow}` }}>
                            {meta.icon}
                          </span>
                          <span className="apikey-label">{meta.label}</span>
                          <a href={meta.href} target="_blank" rel="noopener noreferrer" className="apikey-get-link" title="Get API key">
                            Get key ↗
                          </a>
                        </div>

                        <div className="apikey-input-row">
                          <input
                            id={`apikey-${providerId}`}
                            type={visible ? 'text' : 'password'}
                            className="apikey-input"
                            value={val}
                            onChange={(e) => handleKeyChange(providerId, e.target.value)}
                            placeholder={meta.placeholder}
                            spellCheck={false}
                            autoComplete="off"
                            style={{ '--ai-color': meta.color } as React.CSSProperties}
                          />
                          <button className="apikey-toggle-btn" onClick={() => toggleShow(providerId)} title={visible ? 'Hide' : 'Show'}>
                            {visible ? '🙈' : '👁'}
                          </button>
                          {val && !visible && (
                            <span className="apikey-masked" title="Saved key preview">{maskKey(val)}</span>
                          )}
                        </div>

                        {meta.isInference && (
                          <p className="apikey-groq-note">
                            💡 Groq runs <strong>Llama 3</strong> at blazing speed — ideal fallback for the recommendation engine.
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
                {keysSaved ? '✅ Saved!' : '💾 Save API Keys'}
              </button>
              <span className="apikeys-note">Order auto-saves on drag · Keys stored locally only.</span>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
