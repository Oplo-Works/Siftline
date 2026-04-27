import { useState } from 'react'
import { AiName, AI_COLORS, AI_DISPLAY_NAMES, AI_ICONS, CouncilRoomState } from '../types'

const PREVIEW_CHAR_LIMIT = 180

function extractPreview(text: string): { preview: string; hasMore: boolean } {
  const trimmed = text.trim()

  if (trimmed.length <= PREVIEW_CHAR_LIMIT) {
    return { preview: trimmed, hasMore: false }
  }

  const sentenceEnd = /[.!?]\s+/g
  let lastBreak = -1
  let sentenceCount = 0
  let match: RegExpExecArray | null

  while ((match = sentenceEnd.exec(trimmed)) !== null) {
    if (match.index > PREVIEW_CHAR_LIMIT) break
    sentenceCount++
    lastBreak = match.index + match[0].length
    if (sentenceCount >= 2) break
  }

  if (lastBreak > 0 && lastBreak < trimmed.length) {
    return { preview: trimmed.slice(0, lastBreak).trimEnd(), hasMore: true }
  }

  const hardCut = trimmed.slice(0, PREVIEW_CHAR_LIMIT)
  const wordEnd = hardCut.lastIndexOf(' ')
  return {
    preview: wordEnd > 0 ? hardCut.slice(0, wordEnd) : hardCut,
    hasMore: true,
  }
}

function formatTime(ts: number | undefined): string {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export interface CouncilMessageBubbleProps {
  message: CouncilRoomState['messages'][number]
  modeSwitchPending: boolean
  onSendToWorkflow: (messageId: string, ai: AiName) => Promise<void>
  onToggleCandidatePin: (messageId: string) => void
  isPinned: boolean
}

export function CouncilMessageBubble({
  message,
  modeSwitchPending,
  onSendToWorkflow,
  onToggleCandidatePin,
  isPinned,
}: CouncilMessageBubbleProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (message.kind === 'system') {
    return (
      <div className={`cmsg-system ${message.error ? 'error' : ''}`}>
        <span className="cmsg-system-text">{message.text}</span>
      </div>
    )
  }

  const ai = message.ai
  const isUser = message.kind === 'user'
  const color = ai ? AI_COLORS[ai].primary : '#7dd3fc'
  const colorBg = ai ? AI_COLORS[ai].primary : '#3b82f6'

  const { preview, hasMore } = message.pending
    ? { preview: message.text || '', hasMore: false }
    : extractPreview(message.text)

  const displayText = isExpanded || !hasMore ? message.text : preview

  return (
    <div className={`cmsg-row ${isUser ? 'cmsg-row-user' : 'cmsg-row-ai'}`}>
      {!isUser && (
        <div
          className="cmsg-avatar"
          style={{ background: `${colorBg}22`, borderColor: `${colorBg}44`, color }}
          title={ai ? AI_DISPLAY_NAMES[ai] : 'AI'}
        >
          {ai ? AI_ICONS[ai] : '?'}
        </div>
      )}

      <div className={`cmsg-bubble-wrap ${isUser ? 'user' : 'ai'}`}>
        {!isUser && ai && (
          <span className="cmsg-sender" style={{ color }}>
            {AI_DISPLAY_NAMES[ai]}
          </span>
        )}

        <div
          className={`cmsg-bubble ${isUser ? 'cmsg-bubble-user' : 'cmsg-bubble-ai'} ${isPinned ? 'pinned' : ''}`}
          style={!isUser ? { borderColor: `${colorBg}30` } : undefined}
        >
          {message.pending ? (
            <div className="cmsg-typing">
              <span></span><span></span><span></span>
            </div>
          ) : (
            <>
              <div className="cmsg-text">{displayText}</div>

              {hasMore && !message.pending && (
                <button
                  className="cmsg-expand-btn"
                  onClick={() => setIsExpanded((v) => !v)}
                  title={isExpanded ? 'Collapse reply' : 'View full reply'}
                >
                  {isExpanded ? 'Collapse' : 'View Full Reply'}
                </button>
              )}
            </>
          )}
        </div>

        <div className={`cmsg-footer ${isUser ? 'cmsg-footer-user' : 'cmsg-footer-ai'}`}>
          <span className="cmsg-time">{formatTime(message.createdAt)}</span>

          {!isUser && ai && !message.pending && (
            <div className="cmsg-actions">
              <button
                className={`cmsg-pin-btn ${isPinned ? 'active' : ''}`}
                onClick={() => onToggleCandidatePin(message.id)}
                disabled={modeSwitchPending}
                title={isPinned ? 'Unpin' : 'Pin as candidate'}
              >
                {isPinned ? 'Pinned' : 'Pin'}
              </button>
              <button
                className="cmsg-workflow-btn"
                onClick={() => void onSendToWorkflow(message.id, ai)}
                disabled={modeSwitchPending}
                title="Use in Workflow"
              >
                Workflow
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
