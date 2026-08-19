import type { AiName } from './types'

const RENDERER_MENTION_ALIASES: Record<AiName, string[]> = {
  chatgpt: ['chatgpt'],
  claude: ['claude'],
  gemini: ['gemini'],
  grok: ['grok'],
  deepseek: ['deepseek'],
  perplexity: ['perplexity'],
  zai: ['zai', 'z.ai', 'glm'],
}

export function getMentionQuery(text: string, caretIndex: number): string | null {
  const left = text.slice(0, caretIndex)
  const match = left.match(/(?:^|\s)@([a-zA-Z]*)$/)
  return match ? match[1].toLowerCase() : null
}

export function getMentionSuggestions(enabledAis: AiName[], query: string): AiName[] {
  const trimmed = query.trim().toLowerCase()
  return enabledAis.filter((ai) => {
    if (!trimmed) return true
    return RENDERER_MENTION_ALIASES[ai].some((alias) => alias.startsWith(trimmed))
  })
}

export function applyMention(text: string, caretIndex: number, ai: AiName, label: string): string {
  const left = text.slice(0, caretIndex)
  const right = text.slice(caretIndex)
  const replacedLeft = left.replace(/(?:^|\s)@[a-zA-Z]*$/, (full) => {
    const prefix = full.startsWith(' ') ? ' ' : ''
    return `${prefix}@${label} `
  })
  return `${replacedLeft}${right}`
}
