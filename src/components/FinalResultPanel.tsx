import { useState, useMemo, useRef } from 'react'
import { marked } from 'marked'
import { AiName, AI_DISPLAY_NAMES, AI_COLORS, AI_ICONS, AttachedFile, ParsedFileContent } from '../types'

marked.setOptions({ gfm: true, breaks: true })

interface FinalResultPanelProps {
  finalAnswer: string
  isRunning: boolean
  primaryAi: AiName
  attachedFiles: AttachedFile[]
  fileContents: ParsedFileContent[]
  expanded: boolean
  onToggleExpand: () => void
}

export default function FinalResultPanel({
  finalAnswer,
  isRunning,
  primaryAi,
  attachedFiles,
  fileContents,
  expanded,
  onToggleExpand,
}: FinalResultPanelProps) {
  const [copied, setCopied] = useState(false)
  const [toastType, setToastType] = useState<'success' | 'error' | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [viewMode, setViewMode] = useState<'rendered' | 'raw'>('rendered')
  const [savingIndex, setSavingIndex] = useState<number | null>(null)
  const color = AI_COLORS[primaryAi]

  const renderedHtml = useMemo(() => {
    if (!finalAnswer) return ''
    try { return marked.parse(finalAnswer) as string }
    catch { return `<pre>${finalAnswer}</pre>` }
  }, [finalAnswer])

  const showToast = (type: 'success' | 'error') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToastType(type)
    toastTimer.current = setTimeout(() => setToastType(null), 2000)
  }

  const handleCopy = async () => {
    if (!finalAnswer) return
    try {
      await navigator.clipboard.writeText(finalAnswer)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      showToast('success')
    } catch {
      showToast('error')
    }
  }

  // Download a specific parsed file (or full answer as fallback)
  const handleDownloadFile = async (fc: ParsedFileContent, index: number) => {
    if (savingIndex !== null) return
    setSavingIndex(index)
    try {
      const saveExt = ['docx', 'xlsx', 'txt', 'md', 'csv'].includes(fc.ext) ? fc.ext : 'txt'
      const baseName = fc.name.replace(/\.[^.]+$/, '') + '_revised'
      await window.electronAPI.saveFile({
        content: fc.content,
        defaultName: `${baseName}.${saveExt}`,
        ext: saveExt,
      })
    } finally {
      setSavingIndex(null)
    }
  }

  const hasNewAnswer = !!finalAnswer
  const isLoading = isRunning && !finalAnswer

  // Decide which download buttons to show
  // - fileContents: one button per parsed file (from delimiter-based parsing)
  // - attachedFiles with no parsed content: single button with full answer
  const showPerFileDownload = fileContents.length > 0
  const showFallbackDownload = !showPerFileDownload && attachedFiles.length > 0

  return (
    <div
      className={`final-panel ${expanded ? 'expanded' : 'collapsed'}`}
      style={{ '--final-color': color.primary, '--final-glow': color.glow } as React.CSSProperties}
    >
      {/* Header — always visible, click to toggle */}
      <div className="final-panel-header" onClick={onToggleExpand} style={{ cursor: 'pointer' }}>
        <div className="final-panel-title">
          <span className="final-panel-icon" style={{ color: color.primary }}>{AI_ICONS[primaryAi]}</span>
          <span>
            Final Revised Answer{' '}
            <span style={{ color: color.primary, fontWeight: 600 }}>({AI_DISPLAY_NAMES[primaryAi]})</span>
          </span>
          {hasNewAnswer && <span className="final-answer-ready">✅ Done</span>}
          {isLoading  && <span className="final-answer-loading">Generating...</span>}
        </div>

        {/* Action buttons — stop click from toggling the panel */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
          {expanded && hasNewAnswer && (
            <>
              <div className="view-mode-toggle">
                <button className={`view-toggle-btn ${viewMode === 'rendered' ? 'active' : ''}`} onClick={() => setViewMode('rendered')}>Preview</button>
                <button className={`view-toggle-btn ${viewMode === 'raw' ? 'active' : ''}`} onClick={() => setViewMode('raw')}>Markdown</button>
              </div>

              <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy}>
                {copied ? '✓ Copied' : '⧉ Copy'}
              </button>

              {/* Per-file download buttons */}
              {showPerFileDownload && fileContents.map((fc, i) => (
                <button
                  key={i}
                  className={`download-btn ${savingIndex === i ? 'saving' : ''}`}
                  onClick={() => handleDownloadFile(fc, i)}
                  disabled={savingIndex !== null}
                  title={`Save revised ${fc.name}`}
                >
                  {savingIndex === i ? 'Saving...' : `⬇ ${fc.name}`}
                </button>
              ))}

              {/* Fallback: single download when no per-file parsing available */}
              {showFallbackDownload && (
                <button
                  className={`download-btn ${savingIndex === 0 ? 'saving' : ''}`}
                  onClick={() => handleDownloadFile(
                    { name: attachedFiles[0].name, ext: attachedFiles[0].ext, content: finalAnswer },
                    0
                  )}
                  disabled={savingIndex !== null}
                  title="Save revised file"
                >
                  {savingIndex === 0 ? 'Saving...' : '⬇ Save File'}
                </button>
              )}
            </>
          )}

          <button className="final-panel-toggle" onClick={onToggleExpand} title={expanded ? 'Collapse' : 'Expand'}>
            {expanded ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {/* Toast — copy feedback */}
      {expanded && toastType && (
        <div className={`copy-toast copy-toast--${toastType}`}>
          {toastType === 'success' ? '✓ Copied to clipboard' : '✗ Copy failed'}
        </div>
      )}

      {/* Content — only when expanded */}
      {expanded && (
        <div className="final-panel-content">
          {isLoading ? (
            <div className="final-placeholder running">
              <div className="loading-dots"><span /><span /><span /></div>
              <span>Generating final revised answer...</span>
            </div>
          ) : hasNewAnswer ? (
            viewMode === 'rendered' ? (
              <div className="markdown-body" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
            ) : (
              <pre className="final-answer-text raw-markdown">{finalAnswer}</pre>
            )
          ) : (
            <div className="final-placeholder">
              <span className="placeholder-icon">⚡</span>
              <span>Press Start to begin AI consultation. The final revised answer will appear here.</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
