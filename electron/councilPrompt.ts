import { buildResponseLanguageDirective } from '../src/responseLanguage.js'

/**
 * Pure helpers for building AI Council prompts and parsing user intent.
 * Extracted from main.ts to keep orchestration file smaller. These functions
 * are side-effect free and take all state via parameters, which also makes
 * them trivial to test in isolation.
 */

export type AiName = 'chatgpt' | 'claude' | 'gemini' | 'grok' | 'groq' | 'perplexity'

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
  { ai: 'groq', aliases: ['groq'] },
  { ai: 'perplexity', aliases: ['perplexity'] },
]

export function parseCouncilIntent(text: string): CouncilIntentState {
  if (/(^|\s)@all(?=\b)/i.test(text) || /\b(all of you|everyone|you all|all ai(?:s)?)\b/i.test(text)) {
    return {
      kind: 'all',
      note: 'All active AIs were selected for sequential replies.',
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
      note: 'Message added to the shared transcript. Mention one active AI when you want a reply.',
    }
  }

  if (matched.size > 1) {
    return {
      kind: 'unsupported',
      note: 'This first Council Chat MVP supports one mentioned AI at a time.',
    }
  }

  const [targetAi] = [...matched]
  return {
    kind: 'mention',
    targetAi,
    note: `${targetAi} was selected to reply next.`,
  }
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

  return `You are participating in AI Council as ${displayNames[aiName]}.
Stay faithful to this role: ${brief.role}.
Role focus: ${brief.focus}

Rules:
- Reply only as ${displayNames[aiName]}
- Keep your established AI Council specialty
- Build on the shared transcript instead of restarting from scratch
- Do not fabricate anything another AI has not actually said below
- Keep the answer concise but substantive

${languageDirective}

[Earlier context summary]
${olderSummary}

[Delta summary since your last synced turn]
${deltaSummary}

[Most recent shared transcript]
${deltaRecent || 'No recent transcript.'}

[Latest user instruction for you]
${promptText}

[Response style reminder]
${brief.outputGuide}`
}
