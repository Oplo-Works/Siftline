/**
 * Telegram message text formatter.
 *
 * Telegram caps a single sendMessage at 4096 UTF-16 code units.  AI replies
 * routinely blow past that, so we split into chunks while:
 *   - Preferring to break on paragraph (double-newline) > line > sentence
 *   - Re-opening triple-backtick code blocks across chunks (Telegram doesn't
 *     auto-close them, so half-cut blocks corrupt the next message's rendering)
 *   - Adding `[k/n]` headers when there's more than one chunk
 *
 * This is plain-text only (no Markdown / HTML parse_mode).  Phase 2 may add a
 * MarkdownV2 layer that escapes special chars; we keep it simple for now to
 * avoid Telegram-specific parsing crashes that swallow the whole message.
 */

const HARD_LIMIT = 4096
// Leave headroom for the chunk header, any trailing markers, etc.
const SOFT_LIMIT = 3900

/**
 * Count UTF-16 code units (which is what Telegram counts).  String.length is
 * already UTF-16 in JS; surrogate pairs (emoji) count as 2.  Match Telegram.
 */
function len(s: string): number {
  return s.length
}

/**
 * Split a long text into chunks <= SOFT_LIMIT (so headers fit under HARD_LIMIT).
 * Tries paragraph boundaries first, then line, then hard-cut at SOFT_LIMIT.
 */
function chunkifyText(text: string): string[] {
  if (len(text) <= SOFT_LIMIT) return [text]

  const out: string[] = []
  let remaining = text

  while (len(remaining) > SOFT_LIMIT) {
    // Search for a clean break-point within the soft window
    const window = remaining.slice(0, SOFT_LIMIT)
    let cut =
      window.lastIndexOf('\n\n') !== -1 ? window.lastIndexOf('\n\n') + 2 :
      window.lastIndexOf('\n') !== -1 ? window.lastIndexOf('\n') + 1 :
      window.lastIndexOf('. ') !== -1 ? window.lastIndexOf('. ') + 2 :
      window.lastIndexOf(' ') !== -1 ? window.lastIndexOf(' ') + 1 :
      SOFT_LIMIT  // hard cut

    // Don't make absurdly small pieces — if cut is too early, just hard-cut
    if (cut < SOFT_LIMIT * 0.5) cut = SOFT_LIMIT

    out.push(remaining.slice(0, cut).trimEnd())
    remaining = remaining.slice(cut)
  }
  if (remaining.length > 0) out.push(remaining)
  return out
}

/**
 * For each chunk, count unmatched triple-backticks.  If a chunk has an odd
 * count we've left a code block open — close it at the end and re-open at
 * the start of the next chunk so Telegram doesn't render half the message
 * as code.
 */
function balanceCodeBlocks(chunks: string[]): string[] {
  const FENCE = '```'
  const out: string[] = []
  let pendingFence: string | null = null   // language hint to re-open with

  for (let i = 0; i < chunks.length; i++) {
    let body = chunks[i]
    if (pendingFence !== null) {
      // Re-open the unfinished code block from the previous chunk
      body = pendingFence + '\n' + body
      pendingFence = null
    }

    // Count fences and check if this chunk closes its own code block
    const matches = body.match(/```(\w*)/g) ?? []
    if (matches.length % 2 === 1) {
      // Odd number — last open fence has no closer in this chunk
      const lastOpen = [...body.matchAll(/```(\w*)/g)].pop()
      const lang = lastOpen?.[1] ?? ''
      pendingFence = FENCE + lang
      body = body.trimEnd() + '\n```'
    }
    out.push(body)
  }
  return out
}

export interface FormatOptions {
  /** When true, prepend `[k/n]` header on multi-chunk messages.  Default: true. */
  prefixIndex?: boolean
}

/**
 * Top-level formatter: takes any AI response text and returns 1+ Telegram-safe
 * plain-text chunks ready to send via sendMessage.
 */
export function formatForTelegram(text: string, opts: FormatOptions = {}): string[] {
  const prefixIndex = opts.prefixIndex ?? true
  const safeText = (text ?? '').trim()
  if (!safeText) return ['(empty response)']

  const rawChunks = chunkifyText(safeText)
  const balanced = balanceCodeBlocks(rawChunks)

  if (balanced.length === 1) return balanced

  if (!prefixIndex) return balanced
  return balanced.map((chunk, idx) => `[${idx + 1}/${balanced.length}]\n${chunk}`)
}
