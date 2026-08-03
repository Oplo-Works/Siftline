import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { buildCouncilModeratorSnapshot } from '../src/councilModerator'
import {
  AI_NAMES,
  AI_ROLE_PRESETS,
  type AiName,
  type CouncilMessage,
} from '../src/types'

const repoRoot = process.cwd()
let assertions = 0

function check(condition: unknown, message: string): asserts condition {
  assert.ok(condition, message)
  assertions++
}

const expectedOrder: AiName[] = [
  'chatgpt',
  'claude',
  'deepseek',
  'gemini',
  'grok',
  'kimi',
  'perplexity',
]

const expectedTitles: Record<AiName, string> = {
  chatgpt: 'Versatile Creative Generalist',
  claude: 'Long-Document Analyst',
  deepseek: 'Technical Reasoning Solver',
  gemini: 'Multimodal Context Synthesizer',
  grok: 'Real-Time Reality Critic',
  kimi: 'Long-Context Deep Analyst',
  perplexity: 'Source-Grounded Verifier',
}

const expectedRoles: Record<AiName, string> = {
  chatgpt: 'Versatile Creative and Communication Generalist',
  claude: 'Long-Document Reasoner and Careful Drafter',
  deepseek: 'First-Principles Technical Reasoning Solver',
  gemini: 'Multimodal Broad-Context Synthesizer',
  grok: 'Real-Time Trend and Adversarial Reality Critic',
  kimi: 'Long-Context Deep Research Analyst',
  perplexity: 'Source-Grounded Fact Verifier with Citations',
}

assert.deepEqual(AI_NAMES, expectedOrder)
assertions++
assert.deepEqual(Object.keys(AI_ROLE_PRESETS), expectedOrder)
assertions++

for (const ai of AI_NAMES) {
  const preset = AI_ROLE_PRESETS[ai]
  assert.equal(preset.title, expectedTitles[ai])
  assert.equal(preset.role, expectedRoles[ai])
  check(preset.focus.trim().length > 0, `${ai} focus must be non-empty`)
  check(preset.outputGuide.includes('Respond with three short sections:'), `${ai} output guide shape must remain explicit`)

  const titleTerms = new Set(preset.title.toLowerCase().split(/[^a-z]+/).filter((word) => word.length >= 5))
  const roleTerms = new Set(preset.role.toLowerCase().split(/[^a-z]+/).filter((word) => word.length >= 5))
  check([...titleTerms].some((term) => roleTerms.has(term)), `${ai} title and prompt role must remain semantically aligned`)
  assertions += 2
}

const moderatorMessages: CouncilMessage[] = [
  {
    id: 'role-0',
    kind: 'assistant',
    ai: 'perplexity',
    text: 'According to current sources and data, you should recommend the next step. Overall context and system patterns matter.',
    timestamp: 0,
  },
  {
    id: 'role-1',
    kind: 'assistant',
    ai: 'claude',
    text: 'However, risk and failure mode require nuance, safety, and first principles logic under constraints.',
    timestamp: 1,
  },
]

const moderator = buildCouncilModeratorSnapshot(moderatorMessages, AI_NAMES, 'chatgpt')
assert.equal(moderator.nextSpeaker, 'kimi')
assert.match(moderator.missingAngle, new RegExp(AI_ROLE_PRESETS.kimi.title, 'i'))
assert.match(moderator.nextPrompt, new RegExp(AI_ROLE_PRESETS.kimi.role))
assertions += 3

const mainSource = fs.readFileSync(path.join(repoRoot, 'electron', 'main.ts'), 'utf8')
check(!mainSource.includes('AI_REVIEWER_BRIEFS'), 'duplicate active reviewer brief table must be absent')
check(!mainSource.includes('AI_REVIEWER_PERSONAS'), 'dead reviewer persona table must be absent')
check(!/function\s+buildReviewerPrompt\s*\(/.test(mainSource), 'dead reviewer prompt builder must be absent')
check(mainSource.includes('AI_ROLE_PRESETS[reviewerAi]'), 'review prompt must consume the canonical role object')

console.log(`Council Phase 3 verification: assertions=${assertions} PASS`)
