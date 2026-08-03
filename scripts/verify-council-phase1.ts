import assert from 'node:assert/strict'
import {
  CouncilMessage,
  extractPreviousRoundReplies,
  findPreviousRoundBounds,
  summarizeContextBeforePreviousRound,
} from '../electron/councilPrompt'
import { buildCouncilModeratorSnapshot } from '../src/councilModerator'
import type {
  AiName as ModeratorAiName,
  CouncilMessage as ModeratorMessage,
} from '../src/types'
import { AI_ROLE_PRESETS } from '../src/types'

let nextId = 1

function message(
  kind: CouncilMessage['kind'],
  text: string,
  options: Partial<CouncilMessage> = {},
): CouncilMessage {
  return {
    id: `fixture-${nextId++}`,
    kind,
    text,
    createdAt: nextId,
    ...options,
  }
}

const displayNames = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
  grok: 'Grok',
  deepseek: 'DeepSeek',
  perplexity: 'Perplexity',
}

function replyNames(messages: CouncilMessage[]): string[] {
  return extractPreviousRoundReplies(messages).map((reply) => reply.ai)
}

function verifyAnsweredRoundDiscovery(): number {
  let assertions = 0

  const directRound = [
    message('user', 'Q1'),
    message('assistant', 'Claude answer', { ai: 'claude' }),
    message('assistant', 'Gemini answer', { ai: 'gemini' }),
    message('user', 'Q2'),
  ]
  assert.deepEqual(replyNames(directRound), ['claude', 'gemini'])
  assertions++

  const oneNote = [
    message('user', 'Q1'),
    message('assistant', 'Claude answer', { ai: 'claude' }),
    message('assistant', 'Gemini answer', { ai: 'gemini' }),
    message('user', 'Keep this note'),
    message('user', 'Q2'),
  ]
  assert.deepEqual(replyNames(oneNote), ['claude', 'gemini'])
  assertions++

  const twoNotes = [
    message('user', 'Q1'),
    message('assistant', 'Claude answer', { ai: 'claude' }),
    message('assistant', 'Gemini answer', { ai: 'gemini' }),
    message('user', 'First note'),
    message('user', 'Second note'),
    message('user', 'Q2'),
  ]
  assert.deepEqual(replyNames(twoNotes), ['claude', 'gemini'])
  assertions++

  const firstRound = [message('user', 'Q1')]
  assert.deepEqual(replyNames(firstRound), [])
  assert.equal(findPreviousRoundBounds(firstRound), null)
  assertions++

  const invalidReplies = [
    message('user', 'Q1'),
    message('assistant', 'Waiting', { ai: 'claude', pending: true }),
    message('assistant', 'Failed', { ai: 'gemini', error: true }),
    message('assistant', '   ', { ai: 'grok' }),
    message('user', 'Q2'),
  ]
  assert.deepEqual(replyNames(invalidReplies), [])
  assertions++

  const duplicateReply = [
    message('user', 'Q1'),
    message('assistant', 'Old Claude answer', { ai: 'claude' }),
    message('assistant', 'Gemini answer', { ai: 'gemini' }),
    message('assistant', 'Latest Claude answer', { ai: 'claude' }),
    message('user', 'Q2'),
  ]
  const deduped = extractPreviousRoundReplies(duplicateReply)
  assert.deepEqual(deduped.map((reply) => reply.ai), ['claude', 'gemini'])
  assert.equal(deduped.find((reply) => reply.ai === 'claude')?.text, 'Latest Claude answer')
  assertions++

  const contextWithSkippedNotes = [
    message('user', 'Older question'),
    message('assistant', 'Older answer', { ai: 'chatgpt' }),
    message('user', 'Q1'),
    message('assistant', 'Selected previous-round answer', { ai: 'claude' }),
    message('user', 'Keep first note'),
    message('user', 'Keep second note'),
    message('user', 'Q2'),
  ]
  const summary = summarizeContextBeforePreviousRound(
    contextWithSkippedNotes,
    displayNames,
    2000,
  )
  assert.match(summary, /Keep first note/)
  assert.match(summary, /Keep second note/)
  assert.match(summary, /Older answer/)
  assert.doesNotMatch(summary, /Selected previous-round answer/)
  assertions++

  const onlyInvalidReplyRounds = [
    message('user', 'Q1 background'),
    message('assistant', '', { ai: 'claude', error: true }),
    message('user', 'Q2'),
    message('assistant', '', { ai: 'gemini', error: true }),
    message('user', 'Q3'),
  ]
  assert.equal(findPreviousRoundBounds(onlyInvalidReplyRounds), null)
  const invalidRoundFallbackSummary = summarizeContextBeforePreviousRound(
    onlyInvalidReplyRounds,
    displayNames,
    2000,
  )
  assert.match(invalidRoundFallbackSummary, /Q1 background/)
  assert.doesNotMatch(invalidRoundFallbackSummary, /Q2/)
  assertions++

  return assertions
}

function moderatorMessage(
  text: string,
  ai: ModeratorAiName,
): ModeratorMessage {
  return {
    id: `moderator-${nextId++}`,
    kind: 'assistant',
    text,
    createdAt: nextId,
    ai,
  }
}

const allModeratorAis: ModeratorAiName[] = [
  'chatgpt',
  'claude',
  'deepseek',
  'gemini',
  'grok',
  'kimi',
  'perplexity',
]

function verifyEnglishModeratorBaseline(): number {
  let assertions = 0

  const evidenceSnapshot = buildCouncilModeratorSnapshot([
    moderatorMessage(
      'According to current sources and data, the recommendation is supported.',
      'perplexity',
    ),
    moderatorMessage(
      'A recent study provides evidence, and first principles logic confirms the constraint.',
      'deepseek',
    ),
  ], allModeratorAis, 'chatgpt')
  assert.deepEqual(evidenceSnapshot, {
    consensus: 'Multiple replies converge on grounding the answer with facts, freshness, or stronger evidence.',
    disagreement: 'Some replies rebuild the logic from fundamentals while others focus on framing or usability.',
    missingAngle: 'The discussion still needs sharper real-world objections, incentives, or failure modes.',
    nextSpeaker: 'grok',
    nextPrompt: '@Grok, challenge the current favorite answer and surface the biggest real-world failure mode.',
  })
  assertions++

  const actionSynthesisSnapshot = buildCouncilModeratorSnapshot([
    moderatorMessage(
      'You should start with this next step and use a clear action plan.',
      'chatgpt',
    ),
    moderatorMessage(
      'Overall, the big picture combines context, system relationships, and audience needs.',
      'gemini',
    ),
  ], allModeratorAis, 'chatgpt')
  assert.deepEqual(actionSynthesisSnapshot, {
    consensus: 'The discussion is still exploratory and has not converged on one clear direction yet.',
    disagreement: 'There is some tension between practical execution advice and broader strategic framing.',
    missingAngle: 'The discussion still needs source-grounded fact checking or freshness validation.',
    nextSpeaker: 'perplexity',
    nextPrompt: '@Perplexity, verify the strongest current answer with current sources, flag unsupported claims, and separate evidence from inference.',
  })
  assertions++

  return assertions
}

function verifyKoreanModeratorAndKimi(): number {
  let assertions = 0

  const koreanSnapshot = buildCouncilModeratorSnapshot([
    moderatorMessage(
      '현재 데이터와 통계 근거를 보면 이 방안을 권장하며 다음 단계로 실행해야 합니다.',
      'perplexity',
    ),
    moderatorMessage(
      '연구와 출처를 재검토하면 제일 원리와 논리적 제약도 함께 봐야 합니다.',
      'deepseek',
    ),
  ], allModeratorAis, 'chatgpt')
  assert.equal(
    koreanSnapshot?.consensus,
    'Multiple replies converge on grounding the answer with facts, freshness, or stronger evidence.',
  )
  assert.equal(
    koreanSnapshot?.disagreement,
    'Some replies rebuild the logic from fundamentals while others focus on framing or usability.',
  )
  assertions++

  const englishBoundarySnapshot = buildCouncilModeratorSnapshot([
    moderatorMessage(Array(110).fill('plain').join(' '), 'claude'),
    moderatorMessage(Array(111).fill('plain').join(' '), 'gemini'),
  ], allModeratorAis, 'chatgpt')
  assert.equal(
    englishBoundarySnapshot?.disagreement,
    'Some replies push for a concise answer while others favor fuller explanation and context.',
  )
  assertions++

  const koreanBoundarySnapshot = buildCouncilModeratorSnapshot([
    moderatorMessage('가'.repeat(300), 'claude'),
    moderatorMessage('가'.repeat(301), 'gemini'),
  ], allModeratorAis, 'chatgpt')
  assert.equal(
    koreanBoundarySnapshot?.disagreement,
    'Some replies push for a concise answer while others favor fuller explanation and context.',
  )
  assertions++

  const allAnglesExceptDeepResearch = [
    moderatorMessage(
      'According to current sources and data, you should recommend the next step. Overall context and system patterns matter.',
      'perplexity',
    ),
    moderatorMessage(
      'However, risk and failure mode require nuance, safety, and first principles logic under constraints.',
      'claude',
    ),
  ]
  const kimiMissingSnapshot = buildCouncilModeratorSnapshot(
    allAnglesExceptDeepResearch,
    allModeratorAis,
    'chatgpt',
  )
  assert.equal(kimiMissingSnapshot?.nextSpeaker, 'kimi')
  assert.match(kimiMissingSnapshot?.nextPrompt ?? '', new RegExp(AI_ROLE_PRESETS.kimi.title))
  assert.match(kimiMissingSnapshot?.missingAngle ?? '', /long-context deep analyst/i)
  assertions++

  const deepResearchPresentSnapshot = buildCouncilModeratorSnapshot([
    allAnglesExceptDeepResearch[0],
    moderatorMessage(
      'However, risk and failure mode require nuance, safety, and first principles logic under constraints. A long-context deep research review across multiple documents confirms the result.',
      'claude',
    ),
  ], allModeratorAis, 'chatgpt')
  assert.notEqual(deepResearchPresentSnapshot?.nextSpeaker, 'kimi')
  assertions++

  const kimiDisabledSnapshot = buildCouncilModeratorSnapshot(
    allAnglesExceptDeepResearch,
    allModeratorAis.filter((ai) => ai !== 'kimi'),
    'chatgpt',
  )
  assert.notEqual(kimiDisabledSnapshot?.nextSpeaker, 'kimi')
  assertions++

  const recentKimiSnapshot = buildCouncilModeratorSnapshot([
    allAnglesExceptDeepResearch[0],
    moderatorMessage(
      'However, risk and failure mode require nuance, safety, and first principles logic under constraints.',
      'kimi',
    ),
  ], allModeratorAis, 'chatgpt')
  assert.notEqual(recentKimiSnapshot?.nextSpeaker, 'kimi')
  assertions++

  return assertions
}

const s2Assertions = verifyAnsweredRoundDiscovery()
const englishBaselineAssertions = verifyEnglishModeratorBaseline()
const s3Assertions = verifyKoreanModeratorAndKimi()
console.log(
  `Council Phase 1 verification: S2 assertions=${s2Assertions} PASS; ` +
    `S3 English baseline assertions=${englishBaselineAssertions} PASS; ` +
    `S3 Korean/Kimi assertions=${s3Assertions} PASS`,
)
