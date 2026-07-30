import { AI_DISPLAY_NAMES, AI_ROLE_PRESETS, CouncilRoomState } from './types'
import { buildResponseLanguageDirective } from './responseLanguage'

const MAX_RECENT_MESSAGES = 10
const MAX_EARLY_MESSAGES = 6
const MAX_MESSAGE_CHARS = 520
const MAX_USER_OBJECTIVE_CHARS = 700
const MAX_SEEDED_DRAFT_CHARS = 900

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function truncateText(text: string, maxChars: number): string {
  const normalized = normalizeText(text)
  if (normalized.length <= maxChars) return normalized
  return `${normalized.slice(0, maxChars - 3).trimEnd()}...`
}

function describeMessage(message: CouncilRoomState['messages'][number]): string {
  if (message.kind === 'user') {
    return `User: ${truncateText(message.text, MAX_MESSAGE_CHARS)}`
  }

  if (message.ai) {
    const aiName = AI_DISPLAY_NAMES[message.ai]
    const roleName = AI_ROLE_PRESETS[message.ai].title
    return `${aiName} (${roleName}): ${truncateText(message.text, MAX_MESSAGE_CHARS)}`
  }

  return `Assistant: ${truncateText(message.text, MAX_MESSAGE_CHARS)}`
}

function summarizeEarlierMessages(messages: CouncilRoomState['messages']): string[] {
  if (messages.length === 0) return []

  const sampled = messages.slice(0, MAX_EARLY_MESSAGES).map((message) => {
    if (message.kind === 'user') {
      return `Earlier user point: ${truncateText(message.text, 180)}`
    }

    if (message.ai) {
      const aiName = AI_DISPLAY_NAMES[message.ai]
      return `${aiName} earlier focus: ${truncateText(message.text, 180)}`
    }

    return ''
  }).filter(Boolean)

  return sampled
}

export function hasCouncilWorkflowSource(room: CouncilRoomState): boolean {
  return room.messages.some((message) => message.kind !== 'system' && normalizeText(message.text).length > 0)
}

export function buildCouncilWorkflowHandoffPrompt(
  room: CouncilRoomState,
  options?: {
    anchorMessageId?: string
    preferredDraft?: {
      label: string
      text: string
    }
  }
): string {
  const meaningfulMessages = room.messages.filter(
    (message) => message.kind !== 'system' && normalizeText(message.text).length > 0
  )

  if (meaningfulMessages.length === 0) {
    return ''
  }

  const latestUserMessage = [...meaningfulMessages]
    .reverse()
    .find((message) => message.kind === 'user')
  const languageSourceMessage = latestUserMessage ?? meaningfulMessages[meaningfulMessages.length - 1]
  const anchorMessage = options?.anchorMessageId
    ? meaningfulMessages.find((message) => message.id === options.anchorMessageId)
    : undefined

  const recentMessages = meaningfulMessages.slice(-MAX_RECENT_MESSAGES)
  const earlierMessages = meaningfulMessages.slice(0, -MAX_RECENT_MESSAGES)
  const earlierSummary = summarizeEarlierMessages(earlierMessages)

  const sections: string[] = [
    'Use this Siftline Council Chat transcript as context for a Workflow run.',
    'Produce the strongest primary answer first, then let the reviewer AIs improve it with their specialized roles.',
  ]

  if (languageSourceMessage) {
    sections.push(buildResponseLanguageDirective(languageSourceMessage.text))
  }

  if (latestUserMessage) {
    sections.push(
      `Latest user objective:\n${truncateText(latestUserMessage.text, MAX_USER_OBJECTIVE_CHARS)}`
    )
  }

  if (earlierSummary.length > 0) {
    sections.push(`Earlier discussion summary:\n- ${earlierSummary.join('\n- ')}`)
  }

  if (options?.preferredDraft) {
    sections.push(
      `Preferred primary draft:\nStart from this prepared council synthesis as the initial direction.\n${options.preferredDraft.label}: ${truncateText(options.preferredDraft.text, MAX_SEEDED_DRAFT_CHARS)}`
    )
  } else if (anchorMessage?.ai && anchorMessage.kind === 'assistant') {
    const aiName = AI_DISPLAY_NAMES[anchorMessage.ai]
    const roleName = AI_ROLE_PRESETS[anchorMessage.ai].title
    sections.push(
      `Preferred primary draft:\nStart from ${aiName}'s council reply as the initial direction.\n${aiName} (${roleName}): ${truncateText(anchorMessage.text, MAX_SEEDED_DRAFT_CHARS)}`
    )
  }

  sections.push(
    `Recent council transcript:\n${recentMessages.map((message) => describeMessage(message)).join('\n')}`
  )

  sections.push(
    'Workflow instructions:\n- Answer the latest user request directly.\n- Reuse the strongest ideas from the council transcript.\n- Resolve disagreements when possible, and surface them clearly when they matter.\n- Keep each AI in its existing role during the workflow review round.'
  )

  return sections.join('\n\n')
}
