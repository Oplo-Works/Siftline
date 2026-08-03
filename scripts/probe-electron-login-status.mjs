const port = Number(process.argv[2] || 9224)

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
  throw new Error('Renderer CDP target did not appear')
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
    const handlers = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) handlers.reject(new Error(message.error.message))
    else handlers.resolve(message.result)
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

const target = await waitForRendererTarget()
const cdp = await connectCdp(target.webSocketDebuggerUrl)
let kimiCdp
try {
  const status = await evaluate(cdp.call, `window.electronAPI.getLoginStatus()`)
  const roomMetadata = await evaluate(cdp.call, `window.electronAPI.getCouncilRoom().then((room) => ({
    status: room.status,
    participants: room.participants,
    primaryAi: room.primaryAi,
    messageCount: room.messages.length,
    pendingCount: room.messages.filter((message) => message.pending).length,
    errorCount: room.messages.filter((message) => message.error).length
  }))`)
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json())
  const kimiTarget = targets.find((candidate) =>
    candidate.type === 'page' && String(candidate.url).includes('kimi.com') && candidate.webSocketDebuggerUrl
  )
  if (kimiTarget) kimiCdp = await connectCdp(kimiTarget.webSocketDebuggerUrl)
  const cookieResult = kimiCdp
    ? await kimiCdp.call('Network.getCookies', { urls: ['https://kimi.com/', 'https://www.kimi.com/'] })
    : { cookies: [] }
  const kimiCookies = cookieResult.cookies
    .filter((cookie) => String(cookie.domain || '').includes('kimi.com'))
    .map((cookie) => ({
      name: cookie.name,
      domain: cookie.domain,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
    }))
    .sort((a, b) => `${a.domain}/${a.name}`.localeCompare(`${b.domain}/${b.name}`))
  console.log(`LOGIN_STATUS=${JSON.stringify(status)}`)
  console.log(`LOGIN_STATUS_KEYS=${Object.keys(status).join(',')}`)
  console.log(`LOGIN_STATUS_VALUE_TYPES=${Object.values(status).map((value) => typeof value).join(',')}`)
  console.log(`COUNCIL_ROOM_METADATA=${JSON.stringify(roomMetadata)}`)
  console.log(`KIMI_COOKIE_METADATA=${JSON.stringify(kimiCookies)}`)
  if (process.argv.includes('--chat-smoke')) {
    const smoke = await evaluate(cdp.call, `(async () => {
      const before = await window.electronAPI.getCouncilRoom()
      const after = await window.electronAPI.sendCouncilMessage({
        text: '@ChatGPT Phase 2 typecheck smoke. Reply with only: PHASE2 CHAT SMOKE OK',
        participants: before.participants,
        primaryAi: before.primaryAi,
        attachedFiles: []
      })
      const reply = [...after.messages].reverse().find((message) => message.kind === 'assistant')
      return {
        beforeCount: before.messages.length,
        afterCount: after.messages.length,
        status: after.status,
        replyAi: reply?.ai ?? null,
        replyError: Boolean(reply?.error),
        replyPending: Boolean(reply?.pending),
        replyChars: typeof reply?.text === 'string' ? reply.text.length : 0
      }
    })()`)
    console.log(`CHAT_SMOKE=${JSON.stringify(smoke)}`)
  }
} finally {
  kimiCdp?.socket.close()
  cdp.socket.close()
}
