import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { getSequentialCouncilTargets } from '../electron/councilPrompt'
import { AI_NAMES, DEFAULT_ENABLED_AIS } from '../src/types'

const EXPECTED_AI_ORDER = [
  'chatgpt',
  'claude',
  'deepseek',
  'gemini',
  'grok',
  'kimi',
  'perplexity',
] as const
const EXPECTED_DEFAULTS = ['chatgpt', 'claude', 'gemini'] as const

const repoRoot = process.cwd()
const mainPath = path.join(repoRoot, 'electron', 'main.ts')
const promptPath = path.join(repoRoot, 'electron', 'councilPrompt.ts')
const preloadPath = path.join(repoRoot, 'electron', 'preload.ts')
const mainSource = fs.readFileSync(mainPath, 'utf8')
const promptSource = fs.readFileSync(promptPath, 'utf8')
const preloadSource = fs.readFileSync(preloadPath, 'utf8')

let assertions = 0

function check(value: unknown, expected: unknown): void {
  assert.deepEqual(value, expected)
  assertions += 1
}

function checkMatch(value: string, pattern: RegExp): void {
  assert.match(value, pattern)
  assertions += 1
}

function checkNoMatch(value: string, pattern: RegExp): void {
  assert.doesNotMatch(value, pattern)
  assertions += 1
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
  const resultExpression = `{ ${names.join(', ')} }`
  return new Function(`const views = new Map();\n${transpiled}\nreturn ${resultExpression}`)() as T
}

check(AI_NAMES, [...EXPECTED_AI_ORDER])
check(DEFAULT_ENABLED_AIS, [...EXPECTED_DEFAULTS])
check(
  getSequentialCouncilTargets([...AI_NAMES], 'chatgpt', AI_NAMES),
  [...EXPECTED_AI_ORDER],
)
check(
  getSequentialCouncilTargets([...AI_NAMES], 'gemini', AI_NAMES),
  ['gemini', ...EXPECTED_AI_ORDER.filter((ai) => ai !== 'gemini')],
)

checkMatch(mainSource, /import \{ AI_NAMES, DEFAULT_ENABLED_AIS, type AiName \} from '\.\.\/src\/types\.js'/)
checkNoMatch(mainSource, /^(?:export )?type AiName\s*=/m)
checkNoMatch(promptSource, /^(?:export )?type AiName\s*=/m)
checkNoMatch(preloadSource, /^(?:export )?type AiName\s*=/m)
checkMatch(preloadSource, /^import type \{ AiName \} from '\.\.\/src\/types\.js'/m)
checkNoMatch(mainSource, /^const (?:AI_NAMES|DEFAULT_ENABLED_AI_NAMES)\b/m)
checkMatch(mainSource, /Promise\.all\(AI_NAMES\.map\(async \(aiName\)/)
checkMatch(mainSource, /if \(aiName === 'kimi'\) \{\s*return all\.some\(isKimiAuthenticatedCookie\)/)
checkMatch(mainSource, /if \(aiName === 'kimi'\) \{\s*return cookies\.some\(isKimiAuthenticatedCookie\)/)

const { cookieDomainIncludes, isKimiAuthenticatedCookie, sanitizeSnapshotLifecycle, getPersistedLoginStatus, sanitizeAttachmentSnapshot } = loadFunctions<{
  cookieDomainIncludes: (cookie: { domain?: string }, expectedDomain: string) => boolean
  isKimiAuthenticatedCookie: (cookie: { name: string; domain?: string }) => boolean
  sanitizeSnapshotLifecycle: (value?: string | null) => 'in-progress' | 'completed'
  getPersistedLoginStatus: (ai: string, cookies: Array<{ name: string; domain?: string }>) => Promise<boolean>
  sanitizeAttachmentSnapshot: (value: unknown) => { count: number; names: string[] }
}>(mainSource, ['cookieDomainIncludes', 'isKimiAuthenticatedCookie', 'sanitizeSnapshotLifecycle', 'getPersistedLoginStatus', 'sanitizeAttachmentSnapshot'])

check(cookieDomainIncludes({}, 'kimi.com'), false)
check(isKimiAuthenticatedCookie({ name: 'kimi-auth', domain: 'www.kimi.com' }), true)
check(isKimiAuthenticatedCookie({ name: 'kimi-auth', domain: '.kimi.com' }), true)
check(isKimiAuthenticatedCookie({ name: 'session-token', domain: 'www.kimi.com' }), false)
check(isKimiAuthenticatedCookie({ name: 'kimi-auth', domain: 'notkimi.com' }), false)
check(isKimiAuthenticatedCookie({ name: 'kimi-auth' }), false)
check(sanitizeSnapshotLifecycle(undefined), 'in-progress')
check(sanitizeSnapshotLifecycle(null), 'in-progress')
check(sanitizeSnapshotLifecycle('completed'), 'completed')
check(sanitizeSnapshotLifecycle('unexpected'), 'in-progress')
check(sanitizeAttachmentSnapshot(null), { count: 0, names: [] })
check(sanitizeAttachmentSnapshot({ count: '2', names: 'file.png' }), { count: 0, names: [] })
check(sanitizeAttachmentSnapshot({ count: 2, names: ['one.png', 7, 'two.jpg'] }), { count: 2, names: ['one.png', 'two.jpg'] })

checkMatch(mainSource, /interface PersistedCouncilSnapshotRecord[\s\S]*?label\?: string \| null[\s\S]*?lifecycle\?: CouncilSnapshotLifecycle \| string \| null/)
checkMatch(mainSource, /function sanitizeCouncilSnapshotRecord\(record: PersistedCouncilSnapshotRecord\): CouncilSnapshotRecord/)

async function finish(): Promise<void> {
  check(await getPersistedLoginStatus('gemini', [{ name: 'SID', domain: '.google.com' }]), true)
  check(await getPersistedLoginStatus('gemini', [{ name: 'anonymous', domain: '.google.com' }]), false)
  check(await getPersistedLoginStatus('claude', [{ name: 'any', domain: '.claude.ai' }]), true)
  check(await getPersistedLoginStatus('grok', [{ name: 'sso', domain: '.grok.com' }]), true)
  check(await getPersistedLoginStatus('deepseek', [{ name: 'session_id', domain: '.deepseek.com' }]), true)
  check(await getPersistedLoginStatus('perplexity', [{ name: '__Secure-next-auth.session-token', domain: '.perplexity.ai' }]), true)
  check(await getPersistedLoginStatus('kimi', [{ name: 'kimi-auth', domain: 'www.kimi.com' }]), true)
  check(await getPersistedLoginStatus('chatgpt', [{ name: 'session', domain: '.chatgpt.com' }]), false)

  console.log(`Phase 2 verification: ${assertions} assertions PASS`)
  console.log(`AI_NAMES order: ${AI_NAMES.join(' -> ')}`)
  console.log(`DEFAULT_ENABLED_AIS: ${DEFAULT_ENABLED_AIS.join(' -> ')}`)
}

void finish().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
