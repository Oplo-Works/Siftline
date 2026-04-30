import { buildResponseLanguageDirective, detectPreferredReplyLanguage } from '../src/responseLanguage.js'

/**
 * Pure helpers for building AI Council prompts and parsing user intent.
 * Extracted from main.ts to keep orchestration file smaller. These functions
 * are side-effect free and take all state via parameters, which also makes
 * them trivial to test in isolation.
 */

export type AiName = 'chatgpt' | 'claude' | 'gemini' | 'grok' | 'deepseek' | 'perplexity'

export interface CouncilMessage {
  id: string
  kind: 'user' | 'assistant' | 'system'
  text: string
  createdAt: number
  source?: 'chat' | 'workflow-bridge'
  ai?: AiName
  pending?: boolean
  error?: boolean
}

export interface CouncilIntentState {
  kind: 'mention' | 'all' | 'none' | 'unsupported'
  targetAi?: AiName
  targetAis?: AiName[]
  note: string
}

export interface ReviewerBrief {
  role: string
  focus: string
  outputGuide: string
}

export const COUNCIL_MENTION_ALIASES: Array<{ ai: AiName; aliases: string[] }> = [
  { ai: 'chatgpt', aliases: ['chatgpt', 'chat-gpt', 'chat_gpt'] },
  { ai: 'claude', aliases: ['claude'] },
  { ai: 'gemini', aliases: ['gemini'] },
  { ai: 'grok', aliases: ['grok'] },
  { ai: 'deepseek', aliases: ['deepseek'] },
  { ai: 'perplexity', aliases: ['perplexity'] },
]

export function parseCouncilIntent(text: string): CouncilIntentState {
  if (/(^|\s)@all(?=\b)/i.test(text) || /\b(all of you|everyone|you all|all ai(?:s)?)\b/i.test(text)) {
    return {
      kind: 'all',
      note: 'All active AIs broadcast the same prompt in parallel.',
    }
  }

  const matched = new Set<AiName>()
  for (const { ai, aliases } of COUNCIL_MENTION_ALIASES) {
    for (const alias of aliases) {
      const re = new RegExp(`(^|\\s)@${alias}(?=\\b)`, 'i')
      if (re.test(text)) {
        matched.add(ai)
        break
      }
    }
  }

  if (matched.size === 0) {
    return {
      kind: 'none',
      note: 'Message added to the shared transcript. Mention one or more active AIs when you want replies.',
    }
  }

  // Preserve mention order from the user's text so the council replies in
  // the order the user typed (e.g. "@gemini @deepseek" → Gemini first).
  const orderedTargets = orderTargetsByMentionPosition(text, matched)

  if (orderedTargets.length === 1) {
    const [targetAi] = orderedTargets
    return {
      kind: 'mention',
      targetAi,
      note: `${targetAi} was selected to reply next.`,
    }
  }

  // Multi-mention: broadcast the same prompt to every named AI in parallel.
  // Each AI replies independently to the same input — no sequential pipeline.
  return {
    kind: 'all',
    targetAis: orderedTargets,
    note: `Broadcasting the same prompt in parallel to ${orderedTargets.join(', ')}.`,
  }
}

function orderTargetsByMentionPosition(text: string, matched: Set<AiName>): AiName[] {
  // Find the first @-mention position for each AI; sort by ascending position.
  const positions = new Map<AiName, number>()
  for (const ai of matched) {
    const aliases = COUNCIL_MENTION_ALIASES.find((entry) => entry.ai === ai)?.aliases ?? [ai]
    let earliest = Number.MAX_SAFE_INTEGER
    for (const alias of aliases) {
      const re = new RegExp(`(^|\\s)@${alias}(?=\\b)`, 'i')
      const match = text.match(re)
      if (match && match.index !== undefined) {
        const at = match.index + match[1].length
        if (at < earliest) earliest = at
      }
    }
    positions.set(ai, earliest)
  }
  return [...matched].sort((a, b) => (positions.get(a)! - positions.get(b)!))
}

export function getSequentialCouncilTargets(
  participants: AiName[],
  primaryAi: AiName,
  allAiNames: readonly AiName[],
): AiName[] {
  const active = participants.filter((ai) => allAiNames.includes(ai))
  if (active.length === 0) return []
  if (!active.includes(primaryAi)) return [...active]
  return [primaryAi, ...active.filter((ai) => ai !== primaryAi)]
}

function speakerLabel(
  message: CouncilMessage,
  displayNames: Record<AiName, string>,
): string {
  if (message.kind === 'user') return 'User'
  if (message.kind === 'assistant' && message.ai) return displayNames[message.ai]
  return 'System'
}

/**
 * Deterministic MVP summarizer — one bullet per message up to a char budget.
 * No LLM call; safe for offline use.
 */
export function summarizeCouncilMessages(
  messages: CouncilMessage[],
  maxChars: number,
  displayNames: Record<AiName, string>,
): string {
  if (messages.length === 0 || maxChars <= 0) return 'No earlier context.'
  let total = 0
  const lines: string[] = []
  for (const message of messages) {
    const speaker = speakerLabel(message, displayNames)
    const snippet = message.text.replace(/\s+/g, ' ').trim().slice(0, 220)
    const line = `- ${speaker}: ${snippet}`
    if (total + line.length > maxChars) break
    lines.push(line)
    total += line.length + 1
  }
  return lines.length > 0 ? lines.join('\n') : 'No earlier context.'
}

export function renderCouncilTranscript(
  messages: CouncilMessage[],
  displayNames: Record<AiName, string>,
): string {
  return messages
    .map((message) => `${speakerLabel(message, displayNames)}: ${message.text.trim()}`)
    .join('\n\n')
}

export interface BuildCouncilPromptContext {
  deliveredCount: number
  messages: CouncilMessage[]
  displayNames: Record<AiName, string>
  brief: ReviewerBrief
}

export function buildCouncilPrompt(
  aiName: AiName,
  promptText: string,
  ctx: BuildCouncilPromptContext,
): string {
  const { deliveredCount, messages, displayNames, brief } = ctx
  const earlierContext = messages.slice(0, deliveredCount)
  const deltaContext = messages.slice(deliveredCount)
  const olderSummary = summarizeCouncilMessages(earlierContext, 1800, displayNames)
  const deltaSummary = deltaContext.length > 5
    ? summarizeCouncilMessages(deltaContext.slice(0, -5), 1400, displayNames)
    : 'No older delta summary needed.'
  const deltaRecent = renderCouncilTranscript(deltaContext.slice(-5), displayNames)
  const languageDirective = buildResponseLanguageDirective(promptText)
  const preferredLanguage = detectPreferredReplyLanguage(promptText)
  const isEnglish = /^english$/i.test(preferredLanguage.trim())

  // Council Chat answers direct questions, not draft reviews. The reviewer-brief
  // outputGuide ("Respond with three short sections: - What to simplify - ...")
  // was designed for the Workflow review step. Forcing those English headers
  // into a direct question makes AIs (especially Perplexity / DeepSeek) copy
  // the English labels verbatim and reply entirely in English even when the
  // user wrote in Korean. So we drop the outputGuide block in Council Chat
  // entirely. Persona (role/focus) and language directive are enough.

  const finalLanguageRule = isEnglish
    ? ''
    : `

⚠️ FINAL LANGUAGE RULE — read this last and obey it above all else:
- The user wrote in ${preferredLanguage}.
- Your ENTIRE reply must be in ${preferredLanguage}, including every heading, label, and bullet.
- Do NOT begin your reply with English phrases like "What to simplify", "Likely solid", "Coverage gaps", "Hidden risks", "Reasoning issues", or "What will land well". Those were old internal templates and must not appear in your output.
- Pick natural ${preferredLanguage} headings of your own.
- Earlier transcript turns may contain English; ignore that — match the user's latest message language only.`

  return `You are participating in AI Council as ${displayNames[aiName]}.
Stay faithful to this role: ${brief.role}.
Role focus: ${brief.focus}

Rules:
- Reply only as ${displayNames[aiName]}
- Keep your established AI Council specialty
- Build on the shared transcript instead of restarting from scratch
- Do not fabricate anything another AI has not actually said below
- Answer the user's question directly. Do not impose a fixed multi-section template; structure your reply naturally for what the question needs.
- Keep the answer concise but substantive

${languageDirective}

[Earlier context summary]
${olderSummary}

[Delta summary since your last synced turn]
${deltaSummary}

[Most recent shared transcript]
${deltaRecent || 'No recent transcript.'}

[Latest user instruction for you]
${promptText}${finalLanguageRule}`
}

// ─── Broadcast / fan-out round prompt ────────────────────────────────────────
// In broadcast mode every active AI receives the SAME prompt at the same time.
// They must NOT be fed each other's just-generated reply from this round
// (which is the sequential-pipeline behavior we want to avoid).  Instead each
// AI sees a summary of the previous round's answers from every AI, plus the
// user's latest instruction.

export interface PreviousRoundReply {
  ai: AiName
  text: string
}

/**
 * Find the AI assistant replies that belong to the round immediately before
 * the most recent user message.  "Round" boundaries are user messages — the
 * previous round is the assistant replies between the second-to-last user
 * message and the last user message.
 *
 * Returns an empty array when there is no previous round (e.g. round 1).
 */
export function extractPreviousRoundReplies(messages: CouncilMessage[]): PreviousRoundReply[] {
  const userIndices: number[] = []
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].kind === 'user') userIndices.push(i)
  }
  if (userIndices.length === 0) return []
  const lastUserIdx = userIndices[userIndices.length - 1]
  const prevUserIdx = userIndices.length >= 2 ? userIndices[userIndices.length - 2] : -1

  // Keep only the latest non-pending, non-error reply per AI within the slice.
  const latestPerAi = new Map<AiName, PreviousRoundReply>()
  for (let i = prevUserIdx + 1; i < lastUserIdx; i++) {
    const m = messages[i]
    if (m.kind !== 'assistant' || !m.ai || m.pending || m.error) continue
    const text = m.text.trim()
    if (!text) continue
    latestPerAi.set(m.ai, { ai: m.ai, text })
  }
  return [...latestPerAi.values()]
}

/**
 * Render the previous round's per-AI replies into a single block that can be
 * embedded in the broadcast prompt.  Each AI's reply is truncated to keep the
 * total payload bounded.
 */
export function renderPreviousRoundBlock(
  replies: PreviousRoundReply[],
  displayNames: Record<AiName, string>,
  perAiCharBudget = 1200,
): string {
  if (replies.length === 0) return ''
  const blocks: string[] = []
  for (const reply of replies) {
    const collapsed = reply.text.replace(/\r\n/g, '\n').trim()
    const trimmed = collapsed.length > perAiCharBudget
      ? collapsed.slice(0, perAiCharBudget) + '\n…(truncated)'
      : collapsed
    blocks.push(`### ${displayNames[reply.ai]}\n${trimmed}`)
  }
  return blocks.join('\n\n')
}

export interface BuildCouncilBroadcastPromptContext {
  displayNames: Record<AiName, string>
  brief: ReviewerBrief
  // Assistant replies from the round just before this user message (full text,
  // already trimmed of pending/error placeholders).  Empty array for round 1.
  previousRoundReplies: PreviousRoundReply[]
  // Compact summary of everything older than the previous round (older
  // user/assistant turns).  Pass an empty string to omit.
  earlierContextSummary: string
}

/**
 * Build the prompt used for broadcast / fan-out rounds.  Critically this
 * prompt is identical for every AI in the round (apart from the persona) and
 * does NOT reference replies generated by peer AIs in the same round.
 */
export function buildCouncilBroadcastPrompt(
  aiName: AiName,
  userQuestion: string,
  ctx: BuildCouncilBroadcastPromptContext,
): string {
  const { displayNames, brief, previousRoundReplies, earlierContextSummary } = ctx
  const languageDirective = buildResponseLanguageDirective(userQuestion)
  const preferredLanguage = detectPreferredReplyLanguage(userQuestion)
  const isEnglish = /^english$/i.test(preferredLanguage.trim())

  const previousRoundBlock = renderPreviousRoundBlock(previousRoundReplies, displayNames)
  const hasPreviousRound = previousRoundBlock.length > 0
  const previousRoundSection = hasPreviousRound
    ? `[Previous round — what every active AI just answered]
The block below contains the FULL replies from the previous round, one section per AI. Treat them as peer answers you should consider, build on, agree or disagree with — but do not pretend any of them said something they did not.

${previousRoundBlock}

`
    : ''

  const earlierSection = earlierContextSummary.trim().length > 0
    ? `[Earlier shared transcript (summary)]
${earlierContextSummary.trim()}

`
    : ''

  const finalLanguageRule = isEnglish
    ? ''
    : `

⚠️ FINAL LANGUAGE RULE — read this last and obey it above all else:
- The user wrote in ${preferredLanguage}.
- Your ENTIRE reply must be in ${preferredLanguage}, including every heading, label, and bullet.
- Do NOT begin your reply with English phrases like "What to simplify", "Likely solid", "Coverage gaps", "Hidden risks", "Reasoning issues", or "What will land well". Those were old internal templates and must not appear in your output.
- Pick natural ${preferredLanguage} headings of your own.
- Earlier transcript turns may contain English; ignore that — match the user's latest message language only.`

  const peerAwareness = hasPreviousRound
    ? `- You are answering in parallel with the other active AIs. They are receiving the exact same prompt right now and are NOT yet visible to you for this round. Do not reference what peers say "this round" — only the previous-round block above is real.
- Read the previous-round block carefully. When you re-organize, integrate the strongest points across all AIs (including yourself) and call out genuine disagreements rather than glossing over them.`
    : `- You are answering in parallel with the other active AIs. They are receiving the exact same prompt right now and are NOT visible to you. Answer the user's question independently and on your own merits — do not invent what other AIs might have said.`

  return `You are participating in AI Council as ${displayNames[aiName]}.
Stay faithful to this role: ${brief.role}.
Role focus: ${brief.focus}

Rules:
- Reply only as ${displayNames[aiName]}
- Keep your established AI Council specialty
- Answer the user's instruction directly. Do not impose a fixed multi-section template; structure your reply naturally for what the question needs.
- Keep the answer concise but substantive
${peerAwareness}

${languageDirective}

${earlierSection}${previousRoundSection}[User's instruction for this round]
${userQuestion}${finalLanguageRule}`
}

/**
 * Compact summary of every message strictly older than the previous round.
 * Used as the "earlier context" preamble in broadcast prompts so AIs still
 * have a sense of older turns without re-reading the full transcript.
 */
export function summarizeContextBeforePreviousRound(
  messages: CouncilMessage[],
  displayNames: Record<AiName, string>,
  maxChars: number,
): string {
  const userIndices: number[] = []
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].kind === 'user') userIndices.push(i)
  }
  if (userIndices.length < 2) return ''
  const cutoffIdx = userIndices[userIndices.length - 2]
  const earlier = messages.slice(0, cutoffIdx)
  if (earlier.length === 0) return ''
  return summarizeCouncilMessages(earlier, maxChars, displayNames)
}
