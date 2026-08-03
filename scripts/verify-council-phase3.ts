import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

import { buildCouncilModeratorSnapshot } from '../src/councilModerator'
import {
  parseCouncilIntent,
  summarizeCouncilMessages,
  type CouncilMessage as PromptCouncilMessage,
} from '../electron/councilPrompt'
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

function loadFunctions<T extends Record<string, unknown>>(source: string, names: string[]): T {
  const sourceFile = ts.createSourceFile('fixture.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const declarations = sourceFile.statements.filter(
    (node): node is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(node) && Boolean(node.name && names.includes(node.name.text)),
  )
  assert.equal(declarations.length, names.length, `Expected functions: ${names.join(', ')}`)
  const selected = declarations.map((node) => node.getText(sourceFile)).join('\n')
  const transpiled = ts.transpileModule(selected, {
    compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2020 },
  }).outputText
  return new Function(`${transpiled}\nreturn { ${names.join(', ')} }`)() as T
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
const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'App.tsx'), 'utf8')
const accountsSource = fs.readFileSync(path.join(repoRoot, 'src', 'components', 'AccountsPanel.tsx'), 'utf8')
check(!mainSource.includes('AI_REVIEWER_BRIEFS'), 'duplicate active reviewer brief table must be absent')
check(!mainSource.includes('AI_REVIEWER_PERSONAS'), 'dead reviewer persona table must be absent')
check(!/function\s+buildReviewerPrompt\s*\(/.test(mainSource), 'dead reviewer prompt builder must be absent')
check(mainSource.includes('AI_ROLE_PRESETS[reviewerAi]'), 'review prompt must consume the canonical role object')

const { cloneCouncilRetryEnvelope, councilRetryHasAvailableAttachments, sanitizeCouncilFailureMessage } = loadFunctions<{
  cloneCouncilRetryEnvelope: (envelope: {
    ai: AiName
    promptText: string
    filePaths: string[]
    attachedFiles: Array<{ name: string; path: string; ext: string }>
    prebuiltPrompt: string
    dispatchMode: 'single' | 'broadcast'
    intent: { kind: 'mention' | 'all'; targetAi?: AiName; targetAis?: AiName[]; note: string }
  }) => {
    ai: AiName
    promptText: string
    filePaths: string[]
    attachedFiles: Array<{ name: string; path: string; ext: string }>
    prebuiltPrompt: string
    dispatchMode: 'single' | 'broadcast'
    intent: { kind: 'mention' | 'all'; targetAi?: AiName; targetAis?: AiName[]; note: string }
  }
  councilRetryHasAvailableAttachments: (
    envelope: {
      filePaths: string[]
      attachedFiles: Array<{ name: string; path: string; ext: string }>
    },
    exists: (filePath: string) => boolean,
  ) => boolean
  sanitizeCouncilFailureMessage: (
    errorMessage: string,
    envelope: {
      filePaths: string[]
      attachedFiles: Array<{ name: string; path: string; ext: string }>
    },
  ) => string
}>(mainSource, ['cloneCouncilRetryEnvelope', 'councilRetryHasAvailableAttachments', 'sanitizeCouncilFailureMessage'])

const replayFixture = {
  ai: 'gemini' as const,
  promptText: '@Gemini retry this',
  filePaths: ['fixture-a.png'],
  attachedFiles: [{ name: 'fixture-a.png', path: 'fixture-a.png', ext: 'png' }],
  prebuiltPrompt: 'exact expanded prompt',
  dispatchMode: 'broadcast' as const,
  intent: { kind: 'all' as const, targetAis: ['gemini', 'claude'] as AiName[], note: 'original dispatch' },
}
const replayClone = cloneCouncilRetryEnvelope(replayFixture)
replayFixture.filePaths[0] = 'mutated.png'
replayFixture.attachedFiles[0].path = 'mutated.png'
replayFixture.intent.targetAis[0] = 'grok'
assert.deepEqual(replayClone.filePaths, ['fixture-a.png'])
assert.deepEqual(replayClone.attachedFiles, [{ name: 'fixture-a.png', path: 'fixture-a.png', ext: 'png' }])
assert.deepEqual(replayClone.intent.targetAis, ['gemini', 'claude'])
assertions += 3
assert.equal(councilRetryHasAvailableAttachments(replayClone, (filePath) => filePath === 'fixture-a.png'), true)
assert.equal(councilRetryHasAvailableAttachments(replayClone, () => false), false)
assertions += 2
const privatePath = 'C:\\private\\fixture-a.png'
const redacted = sanitizeCouncilFailureMessage(
  `Failed to read ${privatePath} and C:/private/fixture-a.png`,
  {
    filePaths: [privatePath],
    attachedFiles: [{ name: 'fixture-a.png', path: privatePath, ext: 'png' }],
  },
)
assert.equal(redacted.includes('C:\\private'), false)
assert.equal(redacted.includes('C:/private'), false)
assert.equal((redacted.match(/\[attachment\]/g) ?? []).length, 2)
assertions += 3
check(/if \(!replay \|\| replay\.ai !== ai \|\| replay\.promptText !== promptText\)[\s\S]*?return cloneCouncilRoomState\(\)[\s\S]*?councilRetryHasAvailableAttachments/.test(mainSource), 'missing runtime replay must stop before attachment/send checks')
check(/await enqueueCouncilTurn\([\s\S]*?retryEnvelope\.filePaths,[\s\S]*?retryEnvelope\.attachedFiles,[\s\S]*?prebuiltPrompt: retryEnvelope\.prebuiltPrompt/.test(mainSource), 'retry must dispatch exact prompt and both attachment forms')
check(!/store\.set\([^\n]*councilFailedReplay/.test(mainSource), 'runtime replay must never be persisted')
check(/councilFailedReplay = null[\s\S]*?councilTurnChain/.test(mainSource), 'runtime replay must start empty after app restart')
check(/function clearFailedCouncilTurn[\s\S]*?councilRoom\.failedTurn = null\s+councilFailedReplay = null/.test(mainSource), 'public and runtime failure state must clear together')
check((mainSource.match(/councilRoom = runtime\s+councilFailedReplay = null/g) ?? []).length === 2, 'both snapshot load paths must discard runtime replay state')
check(/if \(ai === 'kimi'\) \{\s*await onOpenKimiPanel\(\)\s*return\s*\}[\s\S]*?openLoginWindow\(ai\)/.test(accountsSource), 'Kimi Accounts action must bypass standalone login IPC')
check(/ai === 'kimi' \? 'Open panel'/.test(accountsSource), 'Kimi Accounts action must use an explicit panel label')
const kimiPanelHandler = appSource.match(/const handleOpenKimiPanel = useCallback\(async \(\) => \{([\s\S]*?)\n  \}, \[enabledAis, interactionMode, primaryAi\]\)/)?.[1] ?? ''
check(kimiPanelHandler.length > 0, 'App must define the dedicated Kimi panel handler')
check(!kimiPanelHandler.includes('setPrimaryAi'), 'Kimi panel handler must not change Council primary')
check(/syncCouncilRoomContext\(\{\s*participants,\s*primaryAi,\s*\}\)/.test(kimiPanelHandler), 'Kimi panel handler must sync the existing primary')
check(/if \(aiName === 'kimi'\) \{[\s\S]*?return false\s*\}[\s\S]*?STANDALONE_LOGIN_SCRIPTS\[aiName\]/.test(mainSource), 'main must guard Kimi before standalone script lookup')
check(!/^\s*kimi:\s*'kimi-login\.mjs'/m.test(mainSource), 'Kimi standalone helper must not be in the product login map')

const { getComposerLineSignature, composerLineSignaturesMatch } = loadFunctions<{
  getComposerLineSignature: (text: string) => string[]
  composerLineSignaturesMatch: (expected: string[], observed: string[]) => boolean
}>(mainSource, [
  'normalizeComposerText',
  'getComposerLineSignature',
  'composerLineSignaturesMatch',
])
const expectedLineSignature = getComposerLineSignature('A\n\nB')
const flattenedLineSignature = getComposerLineSignature('A B')
const foldedBlankLineSignature = getComposerLineSignature('A\nB')
assert.deepEqual(expectedLineSignature, ['A', 'B'])
assert.equal(composerLineSignaturesMatch(expectedLineSignature, flattenedLineSignature), false)
assert.equal(composerLineSignaturesMatch(expectedLineSignature, foldedBlankLineSignature), true)
assert.deepEqual(getComposerLineSignature('  A  \r\n\u200b\r\n B  \n'), ['A', 'B'])
assertions += 4
check(/ok: comparable === comparableExpected && identityMatches/.test(mainSource), 'observation build must keep the existing composer pass gate')
check(/structureEnforced: false/.test(mainSource), 'structure metrics must remain observation-only before the seven-provider matrix')
check(/\[clipboard-lock\] begin #[^`]+waitMs=\$\{waitMs\}/.test(mainSource), 'clipboard begin log must include queue wait time')
check(/\[clipboard-lock\] end #[^`]+waitMs=\$\{waitMs\} holdMs=\$\{holdMs\}/.test(mainSource), 'clipboard end log must include wait and hold time')
check(!/\[clipboard-lock\][^\n]*(?:promptText|clipboard\.read|imgPath)/.test(mainSource), 'clipboard timing logs must not include content or paths')

const displayNames: Record<AiName, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  deepseek: 'DeepSeek',
  gemini: 'Gemini',
  grok: 'Grok',
  kimi: 'Kimi',
  perplexity: 'Perplexity',
}

const summaryMessages: PromptCouncilMessage[] = [
  { id: 'old', kind: 'user', text: 'oldest background', createdAt: 1 },
  { id: 'middle', kind: 'assistant', ai: 'claude', text: 'middle analysis', createdAt: 2 },
  { id: 'new', kind: 'system', text: 'newest decision', createdAt: 3 },
]
const middleLine = '- Claude: middle analysis'
const newestLine = '- System: newest decision'
const newestTwoBudget = middleLine.length + 1 + newestLine.length
assert.equal(
  summarizeCouncilMessages(summaryMessages, newestTwoBudget, displayNames),
  `${middleLine}\n${newestLine}`,
)
assertions++
assert.equal(
  summarizeCouncilMessages(summaryMessages, newestLine.length, displayNames),
  newestLine,
)
assertions++
assert.equal(
  summarizeCouncilMessages(summaryMessages, newestLine.length - 1, displayNames),
  'No earlier context.',
)
assertions++
assert.equal(parseCouncilIntent('A transcript-only note without a mention.').kind, 'none')
assertions++

console.log(`Council Phase 3 verification: assertions=${assertions} PASS`)
