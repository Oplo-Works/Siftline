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

checkMatch(mainSource, /import \{ AI_NAMES, AI_ROLE_PRESETS, DEFAULT_ENABLED_AIS, type AiName \} from '\.\.\/src\/types\.js'/)
checkNoMatch(mainSource, /^(?:export )?type AiName\s*=/m)
checkNoMatch(promptSource, /^(?:export )?type AiName\s*=/m)
checkNoMatch(preloadSource, /^(?:export )?type AiName\s*=/m)
checkMatch(preloadSource, /^import type \{ AiName \} from '\.\.\/src\/types\.js'/m)
checkNoMatch(mainSource, /^const (?:AI_NAMES|DEFAULT_ENABLED_AI_NAMES)\b/m)
checkMatch(mainSource, /Promise\.all\(AI_NAMES\.map\(async \(aiName\)/)
checkMatch(mainSource, /if \(aiName === 'kimi'\) \{\s*return all\.some\(isKimiAuthenticatedCookie\)/)
checkMatch(mainSource, /if \(aiName === 'kimi'\) \{\s*return cookies\.some\(isKimiAuthenticatedCookie\)/)
checkMatch(mainSource, /const status = aiName === 'kimi' && !persistedStatus\s*\? await getKimiRendererLoginStatus\(\)/)
checkMatch(mainSource, /if \(name === 'kimi'\) \{\s*view\.webContents\.on\('did-finish-load',[\s\S]*?'login-status-changed'/)
checkMatch(mainSource, /accessTokenPresent: Boolean\(localStorage\.getItem\('access_token'\)\)/)
checkMatch(mainSource, /refreshTokenPresent: Boolean\(localStorage\.getItem\('refresh_token'\)\)/)
checkMatch(mainSource, /userIdPresent: Boolean\(localStorage\.getItem\('msh_user_id'\)\)/)

const {
  cookieDomainIncludes,
  isKimiAuthenticatedCookie,
  isKimiPageUrl,
  sanitizeKimiRendererAuthSignal,
  hasCompleteKimiRendererAuthSignal,
  getKimiRendererLoginStatus,
  sanitizeSnapshotLifecycle,
  getPersistedLoginStatus,
  sanitizeAttachmentSnapshot,
} = loadFunctions<{
  cookieDomainIncludes: (cookie: { domain?: string }, expectedDomain: string) => boolean
  isKimiAuthenticatedCookie: (cookie: { name: string; domain?: string }) => boolean
  isKimiPageUrl: (url: string) => boolean
  sanitizeKimiRendererAuthSignal: (value: unknown) => {
    accessTokenPresent: boolean
    refreshTokenPresent: boolean
    userIdPresent: boolean
  } | null
  hasCompleteKimiRendererAuthSignal: (signal: {
    accessTokenPresent: boolean
    refreshTokenPresent: boolean
    userIdPresent: boolean
  }) => boolean
  getKimiRendererLoginStatus: (
    webContents?: {
      isDestroyed: () => boolean
      getURL: () => string
      executeJavaScript: (script: string) => Promise<unknown>
    } | null,
    timeoutMs?: number,
  ) => Promise<boolean>
  sanitizeSnapshotLifecycle: (value?: string | null) => 'in-progress' | 'completed'
  getPersistedLoginStatus: (ai: string, cookies: Array<{ name: string; domain?: string }>) => Promise<boolean>
  sanitizeAttachmentSnapshot: (value: unknown) => { count: number; names: string[] }
}>(mainSource, [
  'cookieDomainIncludes',
  'isKimiAuthenticatedCookie',
  'isKimiPageUrl',
  'sanitizeKimiRendererAuthSignal',
  'hasCompleteKimiRendererAuthSignal',
  'getKimiRendererLoginStatus',
  'sanitizeSnapshotLifecycle',
  'getPersistedLoginStatus',
  'sanitizeAttachmentSnapshot',
])

check(cookieDomainIncludes({}, 'kimi.com'), false)
check(isKimiAuthenticatedCookie({ name: 'kimi-auth', domain: 'www.kimi.com' }), true)
check(isKimiAuthenticatedCookie({ name: 'kimi-auth', domain: '.kimi.com' }), true)
check(isKimiAuthenticatedCookie({ name: 'session-token', domain: 'www.kimi.com' }), false)
check(isKimiAuthenticatedCookie({ name: 'kimi-auth', domain: 'notkimi.com' }), false)
check(isKimiAuthenticatedCookie({ name: 'kimi-auth' }), false)
check(isKimiPageUrl('https://kimi.com/'), true)
check(isKimiPageUrl('https://www.kimi.com/chat/123'), true)
check(isKimiPageUrl('http://www.kimi.com/'), false)
check(isKimiPageUrl('https://kimi.com.example.test/'), false)
check(isKimiPageUrl('not a url'), false)
const completeKimiSignal = {
  accessTokenPresent: true,
  refreshTokenPresent: true,
  userIdPresent: true,
}
check(sanitizeKimiRendererAuthSignal(completeKimiSignal), completeKimiSignal)
check(sanitizeKimiRendererAuthSignal({ ...completeKimiSignal, userIdPresent: 'yes' }), null)
check(sanitizeKimiRendererAuthSignal({ accessTokenPresent: true }), null)
check(sanitizeKimiRendererAuthSignal(null), null)
check(hasCompleteKimiRendererAuthSignal(completeKimiSignal), true)
check(hasCompleteKimiRendererAuthSignal({ ...completeKimiSignal, refreshTokenPresent: false }), false)
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
  const kimiWebContents = (
    url: string,
    result: unknown,
    options: { destroyed?: boolean; reject?: boolean; never?: boolean } = {},
  ) => ({
    isDestroyed: () => Boolean(options.destroyed),
    getURL: () => url,
    executeJavaScript: async () => {
      if (options.reject) throw new Error('fixture rejection')
      if (options.never) return await new Promise<never>(() => {})
      return result
    },
  })

  check(await getKimiRendererLoginStatus(kimiWebContents('https://www.kimi.com/', completeKimiSignal), 10), true)
  check(await getKimiRendererLoginStatus(kimiWebContents('https://www.kimi.com/', { ...completeKimiSignal, accessTokenPresent: false }), 10), false)
  check(await getKimiRendererLoginStatus(kimiWebContents('https://www.kimi.com/', { accessTokenPresent: true }), 10), false)
  check(await getKimiRendererLoginStatus(kimiWebContents('https://kimi.com.example.test/', completeKimiSignal), 10), false)
  check(await getKimiRendererLoginStatus(kimiWebContents('https://www.kimi.com/', completeKimiSignal, { destroyed: true }), 10), false)
  check(await getKimiRendererLoginStatus(kimiWebContents('https://www.kimi.com/', completeKimiSignal, { reject: true }), 10), false)
  check(await getKimiRendererLoginStatus(kimiWebContents('https://www.kimi.com/', completeKimiSignal, { never: true }), 1), false)
  check(await getKimiRendererLoginStatus(null, 1), false)

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
