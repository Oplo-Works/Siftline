import { useRef, KeyboardEvent } from 'react'
import { AiName, AI_DISPLAY_NAMES, AI_COLORS, AI_ICONS, AttachedFile } from '../types'

interface ToolbarProps {
  primaryAi: AiName
  query: string
  isRunning: boolean
  attachedFiles: AttachedFile[]
  onPrimaryAiChange: (ai: AiName) => void
  onQueryChange: (q: string) => void
  onAttach: () => void
  onRemoveFile: (index: number) => void
  onStart: () => void
}

const AI_NAMES: AiName[] = ['gemini', 'claude', 'chatgpt', 'perplexity']

const EXT_ICONS: Record<string, string> = {
  pdf:  '📄',
  docx: '📝',
  doc:  '📝',
  xlsx: '📊',
  xls:  '📊',
  csv:  '📋',
  txt:  '📃',
  md:   '📃',
}

export default function Toolbar({
  primaryAi,
  query,
  isRunning,
  attachedFiles,
  onPrimaryAiChange,
  onQueryChange,
  onAttach,
  onRemoveFile,
  onStart,
}: ToolbarProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isRunning) {
      onStart()
    }
  }

  const selectedColor = AI_COLORS[primaryAi]

  return (
    <div className="toolbar-container">
      {/* Main toolbar row */}
      <div className="toolbar">
        {/* Primary AI selector */}
        <div className="toolbar-section">
          <label className="toolbar-label">Primary AI</label>
          <div className="ai-selector">
            {AI_NAMES.map((ai) => {
              const color = AI_COLORS[ai]
              const isSelected = primaryAi === ai
              return (
                <button
                  key={ai}
                  id={`btn-primary-${ai}`}
                  className={`ai-chip ${isSelected ? 'selected' : ''}`}
                  style={
                    isSelected
                      ? {
                          '--chip-color': color.primary,
                          '--chip-glow': color.glow,
                          borderColor: color.primary,
                          backgroundColor: `${color.primary}18`,
                          boxShadow: `0 0 12px ${color.glow}`,
                        } as React.CSSProperties
                      : {}
                  }
                  onClick={() => !isRunning && onPrimaryAiChange(ai)}
                  disabled={isRunning}
                  title={AI_DISPLAY_NAMES[ai]}
                >
                  <span className="ai-chip-icon">{AI_ICONS[ai]}</span>
                  <span className="ai-chip-name">{AI_DISPLAY_NAMES[ai]}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Query input */}
        <div className="toolbar-query">
          <div
            className="query-input-wrapper"
            style={{ '--query-color': selectedColor.primary } as React.CSSProperties}
          >
            <input
              ref={inputRef}
              id="input-query"
              className="query-input"
              type="text"
              placeholder="Enter your question... (Press Enter to start)"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isRunning}
            />
          </div>
        </div>

        {/* Attach button */}
        <button
          id="btn-attach"
          className={`attach-btn ${attachedFiles.length > 0 ? 'has-files' : ''}`}
          onClick={onAttach}
          disabled={isRunning}
          title="Attach file (PDF, DOCX, XLSX, TXT, CSV, MD)"
        >
          <span className="attach-icon">📎</span>
          {attachedFiles.length > 0 && (
            <span className="attach-badge">{attachedFiles.length}</span>
          )}
        </button>

        {/* Start button */}
        <button
          id="btn-start"
          className={`start-btn ${isRunning ? 'running' : ''}`}
          style={
            {
              '--btn-color': selectedColor.primary,
              '--btn-glow': selectedColor.glow,
            } as React.CSSProperties
          }
          onClick={onStart}
          disabled={isRunning}
        >
          {isRunning ? (
            <>
              <span className="spinner" />
              <span>Running...</span>
            </>
          ) : (
            <>
              <span>▶</span>
              <span>Start</span>
            </>
          )}
        </button>
      </div>

      {/* Attachment bar — only rendered when files are attached */}
      {attachedFiles.length > 0 && (
        <div className="attachment-bar">
          <span className="attachment-bar-label">Attached:</span>
          <div className="attachment-chips">
            {attachedFiles.map((file, i) => (
              <span key={i} className="attachment-chip">
                <span className="attachment-chip-icon">
                  {EXT_ICONS[file.ext] ?? '📄'}
                </span>
                <span className="attachment-chip-name" title={file.path}>
                  {file.name}
                </span>
                {!isRunning && (
                  <button
                    className="attachment-chip-remove"
                    onClick={() => onRemoveFile(i)}
                    title="Remove file"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
