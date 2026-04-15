/**
 * Perplexity AI Login Session Script
 *
 * Opens a login window in the persist:perplexity partition so that
 * the Perplexity panel in AI Council loads without authentication errors.
 *
 * Workarounds applied:
 *   - Full Chrome identity spoof (preload-chrome-spoof.js) to bypass
 *     Google's "This browser or app may not be secure" block
 *   - UA + sec-ch-ua header replacement to hide Electron identity
 *   - Same spoof applied to Google OAuth popups
 *
 * After login is detected the cookies are flushed to disk and the
 * window closes automatically after 3 seconds.
 */

import { app, BrowserWindow, session } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const CHROME_FULL  = process.versions.chrome
const CHROME_MAJOR = CHROME_FULL.split('.')[0]
const DESKTOP_UA   = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_MAJOR}.0.0.0 Safari/537.36`
const PARTITION    = 'persist:perplexity'

app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled')
app.commandLine.appendSwitch('disable-quic')

app.whenReady().then(async () => {
  const ses = session.fromPartition(PARTITION)
  ses.setUserAgent(DESKTOP_UA)

  // Replace UA and sec-ch-ua headers so Google OAuth accepts the request
  ses.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, (details, callback) => {
    const headers = {}
    const SKIP = new Set([
      'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform',
      'sec-ch-ua-full-version-list', 'user-agent', 'x-client-data',
    ])
    for (const [k, v] of Object.entries(details.requestHeaders)) {
      if (!SKIP.has(k.toLowerCase())) headers[k] = v
    }
    headers['user-agent']                  = DESKTOP_UA
    headers['sec-ch-ua']                   = `"Chromium";v="${CHROME_MAJOR}", "Google Chrome";v="${CHROME_MAJOR}", "Not-A.Brand";v="24"`
    headers['sec-ch-ua-mobile']            = '?0'
    headers['sec-ch-ua-platform']          = '"Windows"'
    headers['sec-ch-ua-full-version-list'] = `"Chromium";v="${CHROME_FULL}", "Google Chrome";v="${CHROME_FULL}", "Not-A.Brand";v="24.0.0.0"`
    callback({ requestHeaders: headers })
  })

  const SPOOF_PRELOAD = path.join(__dirname, 'electron', 'preload-chrome-spoof.js')

  const win = new BrowserWindow({
    width:  520,
    height: 720,
    title:  'Perplexity Login — AI Council Session Setup',
    webPreferences: {
      partition:        PARTITION,
      preload:          SPOOF_PRELOAD,
      contextIsolation: false,
      nodeIntegration:  false,
    },
  })

  win.setMenuBarVisibility(false)
  win.webContents.setUserAgent(DESKTOP_UA)

  // Allow Google / Apple OAuth popups and apply the same spoof so Google
  // does not show "This browser or app may not be secure"
  const OAUTH_ALLOWED = [
    'accounts.google.com',
    'oauth2.googleapis.com',
    'accounts.youtube.com',
    'perplexity.ai',
    'apple.com',
    'appleid.apple.com',
  ]

  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, '')
      const allowed = OAUTH_ALLOWED.some(d => hostname === d || hostname.endsWith('.' + d))
      if (!allowed) return { action: 'deny' }
    } catch {
      return { action: 'deny' }
    }
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width:  500,
        height: 660,
        title:  'Sign in',
        webPreferences: {
          partition:        PARTITION,
          preload:          SPOOF_PRELOAD,
          contextIsolation: false,
          nodeIntegration:  false,
        },
      },
    }
  })

  // Detect login completion in OAuth popups
  win.webContents.on('did-create-window', (popup) => {
    popup.setMenuBarVisibility(false)
    popup.webContents.setUserAgent(DESKTOP_UA)
    popup.webContents.on('did-navigate', async (_e, url) => {
      if (url.includes('perplexity.ai')) await checkAndFinish()
    })
  })

  // Detect login completion in the main window.
  // Guard with a 6-second grace period so that pre-existing cookies from a
  // previous session do not trigger an immediate exit before the user sees
  // the login page.
  const START_TIME = Date.now()
  const GRACE_MS   = 6_000

  win.webContents.on('did-navigate', async (_e, url) => {
    if (!url.includes('perplexity.ai')) return
    if (Date.now() - START_TIME < GRACE_MS) return   // too early — ignore
    await checkAndFinish()
  })

  let finished = false
  async function checkAndFinish() {
    if (finished) return

    const cookies = await ses.cookies.get({ domain: '.perplexity.ai' })

    const hasSession = cookies.some(c =>
      c.name.includes('session') ||
      c.name.includes('token')   ||
      c.name.includes('auth')    ||
      c.name.startsWith('pplx')  ||
      c.name === '__Secure-next-auth.session-token' ||
      c.name === 'next-auth.session-token'
    )

    if (!hasSession && cookies.length < 3) return

    finished = true
    console.log(`Login complete — ${cookies.length} cookies saved`)
    await ses.cookies.flushStore()

    win.setTitle('Login complete — closing in 3 s')
    win.webContents.executeJavaScript(`
      document.body.innerHTML =
        '<div style="font-family:sans-serif;text-align:center;padding:60px 30px;background:#f0f9ff">' +
        '<div style="font-size:64px">&#x2705;</div>' +
        '<h2 style="color:#0c4a6e;margin:16px 0">Perplexity login complete!</h2>' +
        '<p style="color:#0369a1">The Perplexity panel will load correctly when you start AI Council.</p>' +
        '<p style="color:#6b7280;font-size:13px;margin-top:24px">Closing in 3 seconds...</p>' +
        '</div>'
    `).catch(() => {})
    setTimeout(() => app.quit(), 3000)
  }

  win.loadURL('https://www.perplexity.ai', { userAgent: DESKTOP_UA })
  win.on('closed', () => app.quit())
})

app.on('window-all-closed', () => app.quit())
