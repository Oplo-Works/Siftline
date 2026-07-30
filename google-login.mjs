/**
 * Gemini / Google Login Session Script
 *
 * Opens a standalone Google login window in the persist:gemini partition so
 * OAuth can finish without parent-window WebAuthn/passkey interference.
 */

import { app, BrowserWindow, session } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const CHROME_FULL = process.versions.chrome
const CHROME_MAJOR = CHROME_FULL.split('.')[0]
const DESKTOP_UA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_MAJOR}.0.0.0 Safari/537.36`
const PARTITION = 'persist:gemini'

app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled')
app.commandLine.appendSwitch('disable-quic')
app.commandLine.appendSwitch('disable-features', 'WebAuthentication,WebAuthenticationCable,WebAuthenticationConditionalUI')

if (process.env.AI_COUNCIL_USERDATA) {
  app.setPath('userData', process.env.AI_COUNCIL_USERDATA)
}

app.whenReady().then(async () => {
  const ses = session.fromPartition(PARTITION)

  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === 'publickey-credentials-get' || permission === 'publickey-credentials-create') {
      callback(false)
      return
    }
    callback(true)
  })
  ses.setUserAgent(DESKTOP_UA)

  ses.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, (details, callback) => {
    const headers = {}
    const skip = new Set([
      'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform',
      'sec-ch-ua-full-version-list', 'user-agent', 'x-client-data',
    ])
    for (const [k, v] of Object.entries(details.requestHeaders)) {
      if (!skip.has(k.toLowerCase())) headers[k] = v
    }
    headers['user-agent'] = DESKTOP_UA
    headers['sec-ch-ua'] = `"Chromium";v="${CHROME_MAJOR}", "Google Chrome";v="${CHROME_MAJOR}", "Not-A.Brand";v="24"`
    headers['sec-ch-ua-mobile'] = '?0'
    headers['sec-ch-ua-platform'] = '"Windows"'
    headers['sec-ch-ua-full-version-list'] = `"Chromium";v="${CHROME_FULL}", "Google Chrome";v="${CHROME_FULL}", "Not-A.Brand";v="24.0.0.0"`
    callback({ requestHeaders: headers })
  })

  const SPOOF_PRELOAD = path.join(__dirname, 'electron', 'preload-chrome-spoof.js')

  const win = new BrowserWindow({
    width: 520,
    height: 700,
    title: 'Google Login - Siftline Session Setup',
    webPreferences: {
      partition: PARTITION,
      preload: SPOOF_PRELOAD,
      contextIsolation: false,
      nodeIntegration: false,
    },
  })

  win.setMenuBarVisibility(false)
  win.webContents.setUserAgent(DESKTOP_UA)

  const OAUTH_ALLOWED = [
    'accounts.google.com',
    'oauth2.googleapis.com',
    'accounts.youtube.com',
    'google.com',
    'gemini.google.com',
  ]

  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, '')
      const allowed = OAUTH_ALLOWED.some((d) => hostname === d || hostname.endsWith('.' + d))
      if (!allowed) return { action: 'deny' }
    } catch {
      return { action: 'deny' }
    }
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 500,
        height: 660,
        title: 'Sign in',
        webPreferences: {
          partition: PARTITION,
          preload: SPOOF_PRELOAD,
          contextIsolation: false,
          nodeIntegration: false,
        },
      },
    }
  })

  let finished = false

  async function hasGoogleSession() {
    const cookies = await ses.cookies.get({ domain: '.google.com' })
    return cookies.some((c) => c.name === 'SID' || c.name === '__Secure-1PSID')
  }

  async function checkAndFinish() {
    if (finished) return
    const loginDone = await hasGoogleSession()
    if (!loginDone) return

    finished = true
    const allCookies = await ses.cookies.get({})
    process.stdout.write(JSON.stringify(allCookies) + '\n')
    await ses.cookies.flushStore()

    win.setTitle('Login complete - closing in 3 s')
    win.webContents.executeJavaScript(`
      document.body.innerHTML =
        '<div style="font-family:sans-serif;text-align:center;padding:60px 30px;background:#f0fdf4">' +
        '<div style="font-size:64px">&#x2705;</div>' +
        '<h2 style="color:#166534;margin:16px 0">Google login complete!</h2>' +
        '<p style="color:#15803d">Gemini will now load correctly in Siftline.</p>' +
        '<p style="color:#6b7280;font-size:13px;margin-top:24px">Closing in 3 seconds...</p>' +
        '</div>'
    `).catch(() => {})
    setTimeout(() => app.quit(), 3000)
  }

  const attachPopupHandlers = (popup) => {
    popup.setMenuBarVisibility(false)
    popup.webContents.setUserAgent(DESKTOP_UA)
    popup.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
      if (permission === 'publickey-credentials-get' || permission === 'publickey-credentials-create') {
        callback(false)
        return
      }
      callback(true)
    })
    popup.webContents.on('did-navigate', () => setTimeout(() => checkAndFinish(), 500))
    popup.webContents.on('did-navigate-in-page', () => setTimeout(() => checkAndFinish(), 500))
    popup.webContents.on('did-finish-load', () => setTimeout(() => checkAndFinish(), 500))
  }

  win.webContents.on('did-create-window', attachPopupHandlers)
  win.webContents.on('did-navigate', () => setTimeout(() => checkAndFinish(), 500))
  win.webContents.on('did-navigate-in-page', () => setTimeout(() => checkAndFinish(), 500))
  win.webContents.on('did-finish-load', () => setTimeout(() => checkAndFinish(), 500))

  win.loadURL('https://accounts.google.com/signin', { userAgent: DESKTOP_UA })
  win.on('closed', () => app.quit())
})

app.on('window-all-closed', () => app.quit())
