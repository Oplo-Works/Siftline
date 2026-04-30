import {
  AiName,
  AI_DISPLAY_NAMES,
  AI_ROLE_PRESETS,
  CouncilMessage,
} from './types'

export interface CouncilCandidateComparison {
  recommendedId: string
  recommendedAi: AiName
  recommendedAiLabel: string
  recommendedReason: string
  candidateNotes: Array<{
    id: string
    aiLabel: string
    roleTitle: string
    strength: string
    caution: string
  }>
  remainingRisks: string[]
}

export interface CouncilMergedCandidate {
  title: string
  description: string
  preferredPrimaryAi: AiName
  contributorLabels: string[]
  draftText: string
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function countWords(text: string): number {
  return normalize(text).split(' ').filter(Boolean).length
}

function hasStructuredFormatting(text: string): boolean {
  return /(^|\n)\s*[-*•]|\d+\./.test(text)
}

function hasEvidenceSignals(text: string): boolean {
  return /\b(source|sources|according|reported|data|study|studies|today|latest|current|evidence|citation)\b/i.test(text)
}

function hasRiskSignals(text: string): boolean {
  return /\b(risk|caution|trade-?off|however|but|limit|downside|edge case|objection|failure mode|assumption)\b/i.test(text)
}

function hasActionSignals(text: string): boolean {
  return /\b(should|next step|recommend|try|use|start|do this|action)\b/i.test(text)
}

function hasSynthesisSignals(text: string): boolean {
  return /\b(overall|in summary|big picture|across|combine|synthesize|framing|context|system|pattern|audience)\b/i.test(text)
}

function hasNuanceSignals(text: string): boolean {
  return /\b(nuance|trade-?off|ethical|safety|correctness|subtle|ambiguous|human impact|reputation)\b/i.test(text)
}

function hasReasoningSignals(text: string): boolean {
  return /\b(first principles|reasoning|derive|logic|algorithm|math|code|constraint|minimal|cleaner route|optimization)\b/i.test(text)
}

function truncateText(text: string, maxChars: number): string {
  const normalized = normalize(text)
  if (normalized.length <= maxChars) return normalized
  return `${normalized.slice(0, maxChars - 3).trimEnd()}...`
}

function scoreCandidate(message: CouncilMessage): number {
  const text = message.text
  const words = countWords(text)
  let score = 0

  if (words >= 60 && words <= 220) score += 2
  else if (words >= 30) score += 1

  if (hasStructuredFormatting(text)) score += 1
  if (hasEvidenceSignals(text)) score += 1
  if (hasRiskSignals(text)) score += 1
  if (hasActionSignals(text)) score += 1
  if (hasSynthesisSignals(text)) score += 1
  if (hasNuanceSignals(text)) score += 1
  if (hasReasoningSignals(text)) score += 1

  switch (message.ai) {
    case 'perplexity':
      if (hasEvidenceSignals(text)) score += 1
      break
    case 'claude':
      if (hasNuanceSignals(text) || hasStructuredFormatting(text)) score += 1
      break
    case 'chatgpt':
      if (hasActionSignals(text)) score += 1
      break
    case 'gemini':
      if (hasSynthesisSignals(text)) score += 1
      break
    case 'grok':
      if (hasRiskSignals(text)) score += 1
      break
    case 'deepseek':
      if (hasReasoningSignals(text) || words <= 120) score += 1
      break
    default:
      break
  }

  return score
}

function buildStrength(message: CouncilMessage): string {
  const ai = message.ai!
  const role = AI_ROLE_PRESETS[ai]
  const text = message.text

  if (ai === 'perplexity' && hasEvidenceSignals(text)) {
    return 'Best for source-grounded fact checking, freshness, and evidence discipline.'
  }
  if (ai === 'claude' && (hasNuanceSignals(text) || hasStructuredFormatting(text))) {
    return 'Best at preserving nuance, tradeoffs, correctness, and safety concerns.'
  }
  if (ai === 'chatgpt' && hasActionSignals(text)) {
    return 'Best practical usefulness, communication clarity, and next-step execution.'
  }
  if (ai === 'gemini' && hasSynthesisSignals(text)) {
    return 'Best broad-context synthesis and strongest system-level framing of the discussion.'
  }
  if (ai === 'grok' && hasRiskSignals(text)) {
    return 'Best at surfacing objections, incentives, risks, and real-world failure modes.'
  }
  if (ai === 'deepseek') {
    return 'Best at first-principles reasoning for logic, math, code, systems, and cleaner routes.'
  }

  return `${role.title} strength comes through most clearly in this reply.`
}

function buildCaution(message: CouncilMessage): string {
  const words = countWords(message.text)
  if (words < 35) return 'May be too brief to stand alone without reviewer expansion.'
  if (words > 260) return 'May be denser than needed and could benefit from simplification.'
  if (!hasEvidenceSignals(message.text) && message.ai === 'perplexity') {
    return 'Could use more explicit source grounding, freshness cues, or evidence boundaries.'
  }
  if (!hasRiskSignals(message.text) && message.ai === 'grok') {
    return 'Reality-test and failure-mode pressure are lighter here than expected from Grok.'
  }
  if (!hasActionSignals(message.text) && message.ai === 'chatgpt') {
    return 'Useful, but the actionable takeaway could be sharper.'
  }
  if (!hasNuanceSignals(message.text) && message.ai === 'claude') {
    return 'Could surface more nuance, tradeoffs, or correctness and safety implications.'
  }
  if (!hasReasoningSignals(message.text) && message.ai === 'deepseek') {
    return 'Could show the first-principles reasoning path or cleaner minimal route more explicitly.'
  }
  return 'Still worth reviewer pressure-testing before finalizing.'
}

export function compareCouncilCandidates(
  messages: CouncilMessage[],
  selectedCandidateId?: string | null
): CouncilCandidateComparison | null {
  const candidates = messages.filter((message) => message.kind === 'assistant' && message.ai)
  if (candidates.length < 2) return null

  const scored = candidates
    .map((message) => ({ message, score: scoreCandidate(message) }))
    .sort((a, b) => {
      if (selectedCandidateId) {
        if (a.message.id === selectedCandidateId) return -1
        if (b.message.id === selectedCandidateId) return 1
      }
      return b.score - a.score
    })

  const recommended = scored[0]!.message
  const recommendedAiLabel = AI_DISPLAY_NAMES[recommended.ai!]
  const recommendedReason = buildStrength(recommended)

  const candidateNotes = scored.map(({ message }) => ({
    id: message.id,
    aiLabel: AI_DISPLAY_NAMES[message.ai!],
    roleTitle: AI_ROLE_PRESETS[message.ai!].title,
    strength: buildStrength(message),
    caution: buildCaution(message),
  }))

  const remainingRisks: string[] = []
  if (!candidates.some((message) => hasEvidenceSignals(message.text))) {
    remainingRisks.push('None of the pinned candidates strongly signals evidence or freshness yet.')
  }
  if (!candidates.some((message) => hasRiskSignals(message.text))) {
    remainingRisks.push('The set still needs sharper risk, counterargument, or edge-case pressure.')
  }
  if (!candidates.some((message) => hasActionSignals(message.text))) {
    remainingRisks.push('The set may still need a more concrete action plan or practical takeaway.')
  }
  if (remainingRisks.length === 0) {
    remainingRisks.push('Candidate coverage is balanced, but the final workflow should still reconcile trade-offs.')
  }

  return {
    recommendedId: recommended.id,
    recommendedAi: recommended.ai!,
    recommendedAiLabel,
    recommendedReason,
    candidateNotes,
    remainingRisks,
  }
}

export function buildCouncilMergedCandidate(
  messages: CouncilMessage[],
  selectedCandidateId?: string | null
): CouncilMergedCandidate | null {
  const candidates = messages.filter((message) => message.kind === 'assistant' && message.ai)
  if (candidates.length < 2) return null

  const comparison = compareCouncilCandidates(candidates, selectedCandidateId)
  if (!comparison) return null

  const selectedCandidate = selectedCandidateId
    ? candidates.find((message) => message.id === selectedCandidateId)
    : undefined
  const preferredPrimary = (selectedCandidate?.ai ?? comparison.recommendedAi) as AiName

  const evidenceCandidate = candidates.find((message) => message.ai === 'perplexity' && hasEvidenceSignals(message.text))
    ?? candidates.find((message) => hasEvidenceSignals(message.text))
  const structureCandidate = candidates.find((message) => message.ai === 'claude' && hasStructuredFormatting(message.text))
    ?? candidates.find((message) => hasStructuredFormatting(message.text))
  const nuanceCandidate = candidates.find((message) => message.ai === 'claude' && hasNuanceSignals(message.text))
    ?? candidates.find((message) => hasNuanceSignals(message.text))
  const actionCandidate = candidates.find((message) => message.ai === 'chatgpt' && hasActionSignals(message.text))
    ?? candidates.find((message) => hasActionSignals(message.text))
  const riskCandidate = candidates.find((message) => message.ai === 'grok' && hasRiskSignals(message.text))
    ?? candidates.find((message) => hasRiskSignals(message.text))
  const reasoningCandidate = candidates.find((message) => message.ai === 'deepseek' && hasReasoningSignals(message.text))
    ?? candidates.find((message) => hasReasoningSignals(message.text))
  const synthesisCandidate = candidates.find((message) => message.ai === 'gemini' && hasSynthesisSignals(message.text))
    ?? selectedCandidate
    ?? candidates.find((message) => hasSynthesisSignals(message.text))
    ?? candidates[0]

  const uniqueContributors = Array.from(
    new Set(
      [synthesisCandidate, evidenceCandidate, nuanceCandidate, structureCandidate, reasoningCandidate, actionCandidate, riskCandidate]
        .filter(Boolean)
        .map((message) => AI_DISPLAY_NAMES[message!.ai!])
    )
  )

  const draftSections = [
    `Core answer direction: ${truncateText(synthesisCandidate!.text, 260)}`,
    evidenceCandidate
      ? `Facts or freshness to preserve: ${truncateText(evidenceCandidate.text, 220)}`
      : null,
    structureCandidate
      ? `Logical structure to preserve: ${truncateText(structureCandidate.text, 220)}`
      : null,
    nuanceCandidate
      ? `Nuance or tradeoffs to preserve: ${truncateText(nuanceCandidate.text, 220)}`
      : null,
    reasoningCandidate
      ? `First-principles reasoning to preserve: ${truncateText(reasoningCandidate.text, 220)}`
      : null,
    actionCandidate
      ? `Practical next-step angle: ${truncateText(actionCandidate.text, 220)}`
      : null,
    riskCandidate
      ? `Risks or objections to keep visible: ${truncateText(riskCandidate.text, 220)}`
      : null,
    'Merged instruction: combine the strongest evidence, reasoning, practicality, and risk coverage into one coherent primary draft before reviewer feedback begins.',
  ].filter(Boolean) as string[]

  const description = uniqueContributors.length > 0
    ? `Combines the strongest parts of ${uniqueContributors.join(', ')} into one workflow seed draft.`
    : 'Combines the strongest pinned council replies into one workflow seed draft.'

  return {
    title: 'Merged Council Draft',
    description,
    preferredPrimaryAi: preferredPrimary,
    contributorLabels: uniqueContributors,
    draftText: draftSections.join('\n'),
  }
}
