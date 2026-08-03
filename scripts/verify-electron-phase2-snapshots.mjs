import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const repoRoot = process.cwd()
const electronExe = path.join(repoRoot, 'node_modules', 'electron', 'dist', 'electron.exe')
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'siftline-phase2-snapshots-'))
const configPath = path.join(tempRoot, 'config.json')
const port = 9300 + Math.floor(Math.random() * 500)
const savedAtOld = 1_700_000_000_000
const savedAtNew = 1_700_000_010_000

function legacySnapshot(id, title, savedAt) {
  return {
    id,
    title,
    savedAt,
    messageCount: 1,
    isFavorite: false,
    room: {
      participants: ['chatgpt', 'claude', 'gemini'],
      primaryAi: 'gemini',
      status: 'idle',
      pendingAi: null,
      messages: [{
        id: `${id}-message`,
        kind: 'user',
        text: `Synthetic ${title}`,
        createdAt: savedAt,
        pending: false,
      }],
      lastIntent: null,
      failedTurn: null,
    },
    uiState: { pinnedCandidateIds: [], selectedCandidateId: null },
    insight: {
      workflowReady: false,
      workflowPreview: null,
      moderatorConsensus: null,
      moderatorNextSpeaker: null,
      moderatorNextPrompt: null,
    },
  }
}

const seededConfig = {
  chatHistory: [],
  windowBounds: { x: 0, y: 0, width: 1280, height: 720 },
  apiKeys: {},
  apiKeyOrder: ['chatgpt', 'claude', 'deepseek', 'gemini', 'grok', 'kimi', 'perplexity'],
  councilRoomSnapshot: null,
  councilUiState: { pinnedCandidateIds: [], selectedCandidateId: null },
  councilSnapshots: [
    legacySnapshot('legacy-old', 'Legacy Old', savedAtOld),
    legacySnapshot('legacy-new', 'Legacy New', savedAtNew),
  ],
  activeCouncilSnapshotId: null,
  telegram: { enabled: false, botToken: '', chatId: '', lastUpdateId: 0 },
}
fs.writeFileSync(configPath, JSON.stringify(seededConfig, null, 2), 'utf8')

const child = spawn(electronExe, [
  '.',
  `--user-data-dir=${tempRoot}`,
  `--remote-debugging-port=${port}`,
], {
  cwd: repoRoot,
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
})

let stderr = ''
child.stderr.on('data', (chunk) => {
  stderr += chunk.toString()
  if (stderr.length > 4000) stderr = stderr.slice(-4000)
})

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForRendererTarget() {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json())
      const renderer = targets.find((target) =>
        target.type === 'page' && String(target.url).includes('/dist/index.html')
      ) ?? targets.find((target) =>
        target.type === 'page' && String(target.title) === 'Siftline'
      )
      if (renderer?.webSocketDebuggerUrl) return renderer
    } catch {
      // Electron is still starting.
    }
    await delay(250)
  }
  throw new Error(`Renderer CDP target did not appear. stderr=${stderr.replace(/\s+/g, ' ').slice(-500)}`)
}

async function connectCdp(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  let nextId = 1
  const pending = new Map()
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (!message.id || !pending.has(message.id)) return
    const { resolve, reject } = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) reject(new Error(message.error.message))
    else resolve(message.result)
  })
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
  return { socket, call }
}

async function evaluate(call, expression) {
  const result = await call('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
  }
  return result.result.value
}

async function waitForApi(call) {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    const ready = await evaluate(call, `typeof window.electronAPI?.getCouncilSnapshots === 'function'`)
    if (ready) return
    await delay(200)
  }
  throw new Error('electronAPI did not become ready')
}

function readRawSnapshots() {
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  return raw.councilSnapshots
}

function findSnapshot(snapshots, id) {
  const snapshot = snapshots.find((item) => item.id === id)
  assert.ok(snapshot, `Missing snapshot ${id}`)
  return snapshot
}

let cdp
try {
  const target = await waitForRendererTarget()
  cdp = await connectCdp(target.webSocketDebuggerUrl)
  await waitForApi(cdp.call)

  const initial = await evaluate(cdp.call, `window.electronAPI.getCouncilSnapshots()`)
  assert.deepEqual(initial.map((snapshot) => snapshot.id), ['legacy-new', 'legacy-old'])
  for (const expected of [
    ['legacy-old', savedAtOld],
    ['legacy-new', savedAtNew],
  ]) {
    const snapshot = findSnapshot(initial, expected[0])
    assert.equal(snapshot.label, null)
    assert.equal(snapshot.note, null)
    assert.equal(snapshot.lastOpenedAt, expected[1])
    assert.equal(snapshot.isArchived, false)
    assert.equal(snapshot.lifecycle, 'in-progress')
  }

  const rawAfterRead = readRawSnapshots()
  for (const snapshot of rawAfterRead) {
    assert.equal(Object.hasOwn(snapshot, 'label'), false)
    assert.equal(Object.hasOwn(snapshot, 'lifecycle'), false)
  }

  const loaded = await evaluate(cdp.call, `window.electronAPI.loadCouncilSnapshot('legacy-old')`)
  assert.equal(loaded.room.messages[0].text, 'Synthetic Legacy Old')
  let summaries = await evaluate(cdp.call, `window.electronAPI.getCouncilSnapshots()`)
  assert.ok(findSnapshot(summaries, 'legacy-old').lastOpenedAt > savedAtNew)

  summaries = await evaluate(cdp.call, `window.electronAPI.annotateCouncilSnapshot('legacy-old', { label: 'Phase2', note: 'Synthetic legacy fixture' })`)
  assert.equal(findSnapshot(summaries, 'legacy-old').label, 'Phase2')
  assert.equal(findSnapshot(summaries, 'legacy-old').note, 'Synthetic legacy fixture')

  summaries = await evaluate(cdp.call, `window.electronAPI.toggleCouncilSnapshotLifecycle('legacy-old')`)
  assert.equal(findSnapshot(summaries, 'legacy-old').lifecycle, 'completed')
  summaries = await evaluate(cdp.call, `window.electronAPI.toggleCouncilSnapshotLifecycle('legacy-old')`)
  assert.equal(findSnapshot(summaries, 'legacy-old').lifecycle, 'in-progress')

  summaries = await evaluate(cdp.call, `window.electronAPI.toggleCouncilSnapshotArchived('legacy-old')`)
  assert.equal(findSnapshot(summaries, 'legacy-old').isArchived, true)
  summaries = await evaluate(cdp.call, `window.electronAPI.toggleCouncilSnapshotArchived('legacy-old')`)
  assert.equal(findSnapshot(summaries, 'legacy-old').isArchived, false)

  const rawAfterMutation = readRawSnapshots()
  for (const snapshot of rawAfterMutation) {
    for (const field of ['label', 'note', 'lastOpenedAt', 'isArchived', 'lifecycle']) {
      assert.equal(Object.hasOwn(snapshot, field), true, `${snapshot.id} missing ${field}`)
    }
  }

  console.log('Saved Session isolated integration: PASS')
  console.log('Initial order: legacy-new -> legacy-old')
  console.log('Read-only normalization persisted: false')
  console.log('Mutation persisted current fields: true')
  console.log(`Isolated profile: ${tempRoot}`)
} finally {
  try {
    if (cdp) {
      void cdp.call('Browser.close').catch(() => {})
      await delay(500)
      cdp.socket.close()
    }
    const deadline = Date.now() + 5000
    while (child.exitCode === null && Date.now() < deadline) await delay(100)
    if (child.exitCode === null && child.pid) {
      spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' })
    }
  } finally {
    const resolvedTemp = path.resolve(tempRoot)
    const resolvedSystemTemp = path.resolve(os.tmpdir()) + path.sep
    assert.ok(resolvedTemp.startsWith(resolvedSystemTemp), 'Refusing to delete a non-temp path')
    fs.rmSync(resolvedTemp, { recursive: true, force: true })
    console.log(`Isolated profile removed: ${!fs.existsSync(resolvedTemp)}`)
  }
}
