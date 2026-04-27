import {
  AiName,
  AI_DISPLAY_NAMES,
  AI_ROLE_PRESETS,
  CouncilMessage,
} from './types'

export interface CouncilModeratorSnapshot {
  consensus: string
  disagreement: string
  missingAngle: string
  nextSpeaker: AiName | null
  nextPrompt: string
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function hasEvidenceSignals(text: string): boolean {
  return /\b(source|sources|according|reported|data|study|studies|today|latest|current|evidence)\b/i.test(text)
}

function hasRiskSignals(text: string): boolean {
  return /\b(risk|caution|trade-?off|however|but|limit|downside|edge case|objection)\b/i.test(text)
}

function hasActionSignals(text: string): boolean {
  return /\b(should|next step|recommend|try|use|start|do this|action|plan)\b/i.test(text)
}

function hasSynthesisSignals(text: string): boolean {
  return /\b(overall|in summary|big picture|across|combine|synthesize|framing)\b/i.test(text)
}

function hasStructureSignals(text: string): boolean {
  return /(^|\n)\s*[-*]|\d+\./.test(text)
}

function hasConciseSignals(text: string): boolean {
  const words = normalize(text).split(' ').filter(Boolean).length
  return words > 0 && words <= 110
}

function describeMissingAngle(ai: AiName): { missing: string; prompt: string } {
  switch (ai) {
    case 'perplexity':
      return {
        missing: 'The discussion still needs stronger fact-checking or freshness validation.',
        prompt: '@Perplexity, verify the strongest current answer for accuracy and freshness.',
      }
    case 'grok':
      return {
        missing: 'The discussion still needs sharper objections, edge cases, or downside pressure.',
        prompt: '@Grok, push on the current favorite answer and surface the biggest hidden risk.',
      }
    case 'chatgpt':
      return {
        missing: 'The discussion still needs a clearer practical recommendation or next-step takeaway.',
        prompt: '@ChatGPT, turn the current best answer into the most practical version for the user.',
      }
    case 'claude':
      return {
        missing: 'The discussion still needs tighter reasoning and cleaner structure.',
        prompt: '@Claude, tighten the logic and structure of the strongest current answer.',
      }
    case 'gemini':
      return {
        missing: 'The discussion still needs stronger synthesis and big-picture framing.',
        prompt: '@Gemini, synthesize the strongest ideas into one coherent direction.',
      }
    case 'deepseek':
      return {
        missing: 'The discussion still needs a strong analytical or coding review.',
        prompt: '@DeepSeek, review the logical structure or code for any edge cases.',
      }
    default:
      return {
        missing: 'The discussion still needs another perspective before moving forward.',
        prompt: '@all, add one more round of focused feedback on the current leading answer.',
      }
  }
}

export function buildCouncilModeratorSnapshot(
  roomMessages: CouncilMessage[],
  enabledAis: AiName[],
  primaryAi: AiName
): CouncilModeratorSnapshot | null {
  const assistantMessages = roomMessages
    .filter((message) => message.kind === 'assistant' && message.ai && !message.pending)
    .slice(-6)

  if (assistantMessages.length < 2) return null

  const texts = assistantMessages.map((message) => message.text)
  const evidenceCount = texts.filter(hasEvidenceSignals).length
  const riskCount = texts.filter(hasRiskSignals).length
  const actionCount = texts.filter(hasActionSignals).length
  const synthesisCount = texts.filter(hasSynthesisSignals).length
  const structureCount = texts.filter(hasStructureSignals).length
  const conciseCount = texts.filter(hasConciseSignals).length

  let consensus = 'The discussion is still exploratory and has not converged on one clear direction yet.'
  if (evidenceCount >= 2) {
    consensus = 'Multiple replies converge on grounding the answer with facts, freshness, or stronger evidence.'
  } else if (actionCount >= 2) {
    consensus = 'Multiple replies converge on making the answer more practical and action-oriented.'
  } else if (synthesisCount >= 2 || structureCount >= 2) {
    consensus = 'Multiple replies converge on a more structured, synthesized answer rather than isolated points.'
  } else if (riskCount >= 2) {
    consensus = 'Multiple replies converge on pressure-testing assumptions before finalizing the answer.'
  }

  let disagreement = 'No major tension stands out yet beyond normal differences in style.'
  if (evidenceCount > 0 && evidenceCount < assistantMessages.length) {
    disagreement = 'Some replies are evidence-heavy while others stay higher-level or intuition-driven.'
  } else if (riskCount > 0 && riskCount < assistantMessages.length) {
    disagreement = 'Some replies pressure-test risks while others optimize for momentum, clarity, or speed.'
  } else if (conciseCount > 0 && conciseCount < assistantMessages.length) {
    disagreement = 'Some replies push for a concise answer while others favor fuller explanation and context.'
  } else if (actionCount > 0 && synthesisCount > 0) {
    disagreement = 'There is some tension between practical execution advice and broader strategic framing.'
  }

  const speakerOrder: AiName[] = []
  if (enabledAis.includes('perplexity') && evidenceCount === 0) speakerOrder.push('perplexity')
  if (enabledAis.includes('grok') && riskCount === 0) speakerOrder.push('grok')
  if (enabledAis.includes('chatgpt') && actionCount === 0) speakerOrder.push('chatgpt')
  if (enabledAis.includes('claude') && structureCount === 0) speakerOrder.push('claude')
  if (enabledAis.includes('gemini') && synthesisCount === 0) speakerOrder.push('gemini')
  if (enabledAis.includes('deepseek') && conciseCount === 0) speakerOrder.push('deepseek')

  const recentSpeaker = assistantMessages[assistantMessages.length - 1]?.ai ?? null
  const nextSpeaker = speakerOrder.find((ai) => ai !== recentSpeaker) ?? (enabledAis.includes(primaryAi) ? primaryAi : enabledAis[0] ?? null)
  const next = nextSpeaker ? describeMissingAngle(nextSpeaker) : null

  return {
    consensus,
    disagreement,
    missingAngle: next?.missing ?? 'The thread is balanced enough to move into Workflow when you are ready.',
    nextSpeaker,
    nextPrompt: next?.prompt ?? '@all, give one final focused round before moving to Workflow.',
  }
}
