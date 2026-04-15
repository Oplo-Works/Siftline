/**
 * grok-login.mjs
 *
 * Opens an isolated Electron window so you can log in to Grok (grok.com)
 * via X (Twitter) or Google SSO.  Once the login is detected the window
 * closes automatically and the session cookies are stored in the
 * "persist:grok" partition — the same one used by the AI Council panel.
 *
 * Usage:
 *   node grok-login.mjs        (via grok-login.bat)
 */

import { app, BrowserWindow, session } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Config ────────────────────────────────────────────────────────────────────
const PARTITION   = 'persist:grok'
const START_URL   = 'https://grok.com'
const WIN_TITLE   = 'Grok Login — AI Council'
const GRACE_MS    = 6_000   // ignore navigation events for the first 6 s

// Chrome identity spoof — prevents X/Grok from detecting Electron
const CHROME_FULL  = process.versions.chrome
const CHROME_MAJOR = CHROME_FULL.split('.')[0]
const USER_AGENT   =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  `Chrome/${CHROME_MAJOR}.0.0.0 Safari/537.36`

const CLIENT_HINTS = {
  'sec-ch-ua':
    `"Chromium";v="${CHROME_MAJOR}", "Google Chrome";v="${CHROME_MAJOR}", "Not-A.Brand";v="24"`,
  'sec-ch-ua-mobile':   '?0',
  'sec-ch-ua-platform': '"Windows"',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return true when Grok session cookies indicate a logged-in user. */
async function isLoggedIn(ses) {
  const all = await ses.cookies.get({})
  // X (Twitter) auth cookies — used for Grok SSO
  const xCookies   = all.filter((c) => c.domain.includes('x.com') || c.domain.includes('twitter.com'))
  const grokCookies = all.filter((c) => c.domain.includes('grok.com'))
  const hasXAuth    = xCookies.some(
    (c) => c.name === 'auth_token' || c.name === 'ct0' || c.name === 'sso' || c.name === 'sso-rw'
  )
  const hasGrokSes  = grokCookies.length >= 2
  return hasXAuth || hasGrokSes
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.commandLine.appendSwitch('disable-quic')
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled')

app.whenReady().then(async () => {
  const loginSes = session.fromPartition(PARTITION)

  // Spoof Chrome client-hint headers and force English locale for all requests
  loginSes.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, (details, callback) => {
    const headers = { ...details.requestHeaders }
    headers['User-Agent'] = USER_AGENT
    headers['Accept-Language'] = 'en-US,en;q=0.9'
    Object.assign(headers, CLIENT_HINTS)
    callback({ requestHeaders: headers })
  })

  const win = new BrowserWindow({
    width:  520,
    height: 720,
    title:  WIN_TITLE,
    webPreferences: {
      partition:        PARTITION,
      contextIsolation: true,
      nodeIntegration:  false,
    },
  })

  // Allow X/Google OAuth popups
  const ALLOWED = [
    'x.com', 'api.x.com', 'twitter.com', 'api.twitter.com',
    'accounts.google.com', 'oauth2.googleapis.com',
    'grok.com',
  ]
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '')
      if (ALLOWED.some((d) => host === d || host.endsWith('.' + d))) {
        return { action: 'allow', overrideBrowserWindowOptions: { webPreferences: { partition: PARTITION } } }
      }
    } catch { /* ignore */ }
    return { action: 'deny' }
  })

  let done = false
  const START = Date.now()

  async function checkAndFinish(url) {
    if (done) return
    if (Date.now() - START < GRACE_MS) return
    if (!(await isLoggedIn(loginSes))) return
    done = true
    console.log('Grok login detected — cookies saved to persist:grok session.')
    console.log('You can close this window or it will close automatically.')
    setTimeout(() => { if (!win.isDestroyed()) win.close() }, 1_500)
  }

  win.webContents.on('did-navigate',         (_e, url) => checkAndFinish(url))
  win.webContents.on('did-finish-load',       ()        => checkAndFinish(win.webContents.getURL()))
  win.webContents.on('did-navigate-in-page',  (_e, url) => checkAndFinish(url))

  win.loadURL(START_URL, { userAgent: USER_AGENT })

  win.on('closed', () => {
    console.log('Login window closed.')
    app.quit()
  })
})
