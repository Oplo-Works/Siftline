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
    || /출처|근거|자료에\s*따르면|데이터|통계|연구|인용|최신|현재|보고서|보도|증거/.test(text)
}

function hasRiskSignals(text: string): boolean {
  return /\b(risk|caution|trade-?off|however|but|limit|downside|edge case|objection|failure mode|assumption)\b/i.test(text)
    || /리스크|위험|주의|트레이드오프|단점|한계|다만|그러나|엣지\s*케이스|반론|실패(?:\s*모드)?|가정/.test(text)
}

function hasActionSignals(text: string): boolean {
  return /\b(should|next step|recommend|try|use|start|do this|action|plan)\b/i.test(text)
    || /해야|권장|추천|다음\s*단계|시도|실행|계획|방안|조치/.test(text)
}

function hasSynthesisSignals(text: string): boolean {
  return /\b(overall|in summary|big picture|across|combine|synthesize|framing|context|system|pattern|audience)\b/i.test(text)
    || /전반적|요약하면|큰\s*그림|종합|통합|맥락|패턴|구조|대상\s*독자|시스템/.test(text)
}

function hasNuanceSignals(text: string): boolean {
  return /\b(nuance|trade-?off|ethical|safety|correctness|subtle|ambiguous|edge case|human impact|reputation)\b/i.test(text)
    || /뉘앙스|미묘|윤리|안전|정확성|모호|인적\s*영향|사람(?:에게)?\s*미치는\s*영향|평판|균형/.test(text)
}

function hasReasoningSignals(text: string): boolean {
  return /\b(first principles|reasoning|derive|logic|algorithm|math|code|constraint|minimal|cleaner route|optimization)\b/i.test(text)
    || /제일\s*원리|첫\s*원리|원리|추론|도출|논리|알고리즘|수학|코드|제약|최소|최적화/.test(text)
}

function hasDeepResearchSignals(text: string): boolean {
  return /\b(long[- ]context|long document|multiple documents?|deep research|deep analysis|corpus|cross-reference|literature review|comprehensive research)\b/i.test(text)
    || /장문|긴\s*문서|다중\s*문서|여러\s*문서|심층\s*연구|심층\s*분석|교차\s*(?:검증|참조)|문헌\s*검토|전체\s*맥락|자료\s*전반/.test(text)
}

function hasStructureSignals(text: string): boolean {
  return /(^|\n)\s*[-*]|\d+\./.test(text)
}

function hasConciseSignals(text: string): boolean {
  const normalized = normalize(text)
  if (!normalized) return false
  if (/[가-힣]/.test(normalized)) return normalized.length <= 300
  const words = normalized.split(' ').filter(Boolean).length
  return words <= 110
}

function describeMissingAngle(ai: AiName): { missing: string; prompt: string } {
  switch (ai) {
    case 'perplexity':
      return {
        missing: 'The discussion still needs source-grounded fact checking or freshness validation.',
        prompt: '@Perplexity, verify the strongest current answer with current sources, flag unsupported claims, and separate evidence from inference.',
      }
    case 'grok':
      return {
        missing: 'The discussion still needs sharper real-world objections, incentives, or failure modes.',
        prompt: '@Grok, challenge the current favorite answer and surface the biggest real-world failure mode.',
      }
    case 'chatgpt':
      return {
        missing: 'The discussion still needs a clearer practical recommendation, tone, or next-step takeaway.',
        prompt: '@ChatGPT, turn the current best answer into the clearest, most actionable version for the user.',
      }
    case 'claude':
      return {
        missing: 'The discussion still needs nuance, tradeoff handling, correctness, or safety analysis.',
        prompt: '@Claude, weigh the tradeoffs, preserve important nuance, and flag correctness or safety concerns in the strongest current answer.',
      }
    case 'gemini':
      return {
        missing: 'The discussion still needs broader context integration and system-level synthesis.',
        prompt: '@Gemini, connect the strongest ideas into a broad-context system view and surface any missing background.',
      }
    case 'deepseek':
      return {
        missing: 'The discussion still needs first-principles reasoning or a cleaner logic, math, code, or systems route.',
        prompt: '@DeepSeek, re-derive the problem from fundamentals and find the cleanest minimal solution.',
      }
    case 'zai':
      return {
        missing: `The discussion still needs ${AI_ROLE_PRESETS.zai.title.toLowerCase()} coverage across long or multi-document context.`,
        prompt: `@Z.ai, use your ${AI_ROLE_PRESETS.zai.role} role to synthesize the full long-context record, cross-check multiple documents, and surface what shorter reviews missed.`,
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
  const nuanceCount = texts.filter(hasNuanceSignals).length
  const reasoningCount = texts.filter(hasReasoningSignals).length
  const deepResearchCount = texts.filter(hasDeepResearchSignals).length

  let consensus = 'The discussion is still exploratory and has not converged on one clear direction yet.'
  if (evidenceCount >= 2) {
    consensus = 'Multiple replies converge on grounding the answer with facts, freshness, or stronger evidence.'
  } else if (reasoningCount >= 2) {
    consensus = 'Multiple replies converge on rechecking the answer from logic, constraints, or first principles.'
  } else if (nuanceCount >= 2) {
    consensus = 'Multiple replies converge on preserving nuance, tradeoffs, or correctness concerns.'
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
  } else if (reasoningCount > 0 && reasoningCount < assistantMessages.length) {
    disagreement = 'Some replies rebuild the logic from fundamentals while others focus on framing or usability.'
  } else if (nuanceCount > 0 && nuanceCount < assistantMessages.length) {
    disagreement = 'Some replies preserve nuance and tradeoffs while others optimize for a cleaner directive.'
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
  if (enabledAis.includes('claude') && nuanceCount === 0) speakerOrder.push('claude')
  if (enabledAis.includes('gemini') && synthesisCount === 0) speakerOrder.push('gemini')
  if (enabledAis.includes('zai') && deepResearchCount === 0) speakerOrder.push('zai')
  if (enabledAis.includes('deepseek') && reasoningCount === 0) speakerOrder.push('deepseek')

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
