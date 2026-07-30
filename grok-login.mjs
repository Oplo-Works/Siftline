/**
 * Grok Login Session Script
 *
 * Opens a standalone Grok login window in the persist:grok partition so
 * Google/X auth can finish without parent-window WebAuthn/passkey interference.
 */

import { app, BrowserWindow, session } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const CHROME_FULL = process.versions.chrome
const CHROME_MAJOR = CHROME_FULL.split('.')[0]
const DESKTOP_UA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_MAJOR}.0.0.0 Safari/537.36`
const PARTITION = 'persist:grok'

app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled')
app.commandLine.appendSwitch('disable-quic')
app.commandLine.appendSwitch('disable-features', 'WebAuthentication,WebAuthenticationCable,WebAuthenticationConditionalUI')

if (process.env.AI_COUNCIL_USERDATA) {
  app.setPath('userData', process.env.AI_COUNCIL_USERDATA)
}

app.whenReady().then(async () => {
  const ses = session.fromPartition(PARTITION)

  // --clear flag: wipe the entire persist:grok partition before login
  if (process.argv.includes('--clear')) {
    await ses.clearStorageData({
      storages: ['cookies', 'localstorage', 'sessionstorage', 'cachestorage', 'indexdb'],
    })
  }

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
    headers['Accept-Language'] = 'en-US,en;q=0.9'
    callback({ requestHeaders: headers })
  })

  const SPOOF_PRELOAD = path.join(__dirname, 'electron', 'preload-chrome-spoof.js')

  const isRelogin = process.argv.includes('--clear')

  const win = new BrowserWindow({
    width: 520,
    height: 720,
    title: isRelogin ? 'Grok Re-Login - Siftline Session Setup' : 'Grok Login - Siftline Session Setup',
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
    'x.com',
    'api.x.com',
    'twitter.com',
    'api.twitter.com',
    'accounts.google.com',
    'oauth2.googleapis.com',
    'grok.com',
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

  async function hasGrokSession() {
    const all = await ses.cookies.get({})
    const grokCookies = all.filter((c) => c.domain.includes('grok.com'))
    const hasGrokSSO = grokCookies.some((c) => c.name === 'sso' || c.name === 'sso-rw')
    return hasGrokSSO
  }

  async function hasReadyComposer(webContents) {
    try {
      const url = webContents.getURL()
      if (!/^https:\/\/([^.]+\.)?grok\.com\//.test(url)) return false
      return await webContents.executeJavaScript(`
        (() => {
          const selectors = [
            'textarea[placeholder*="Ask"]',
            'textarea[placeholder*="Grok"]',
            'textarea[placeholder*="Message"]',
            'div[contenteditable="true"][aria-label]',
            'div[contenteditable="true"]',
            'textarea'
          ];
          return selectors.some((sel) => !!document.querySelector(sel));
        })()
      `)
    } catch {
      return false
    }
  }

  async function checkAndFinish(webContents = win.webContents) {
    if (finished) return
    const loginDone = await hasGrokSession()
    if (!loginDone) return
    const composerReady = await hasReadyComposer(webContents)
    if (!composerReady) return

    finished = true
    const allCookies = await ses.cookies.get({})
    process.stdout.write(JSON.stringify(allCookies) + '\n')
    await ses.cookies.flushStore()

    win.setTitle('Login complete - closing in 3 s')
    win.webContents.executeJavaScript(`
      document.body.innerHTML =
        '<div style="font-family:sans-serif;text-align:center;padding:60px 30px;background:#eef2ff">' +
        '<div style="font-size:64px">&#x2705;</div>' +
        '<h2 style="color:#4338ca;margin:16px 0">Grok login complete!</h2>' +
        '<p style="color:#4f46e5">Grok will now load correctly in Siftline.</p>' +
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
    popup.webContents.on('did-navigate', () => setTimeout(() => checkAndFinish(popup.webContents), 500))
    popup.webContents.on('did-navigate-in-page', () => setTimeout(() => checkAndFinish(popup.webContents), 500))
    popup.webContents.on('did-finish-load', () => setTimeout(() => checkAndFinish(popup.webContents), 500))
  }

  win.webContents.on('did-create-window', attachPopupHandlers)
  win.webContents.on('did-navigate', () => setTimeout(() => checkAndFinish(win.webContents), 500))
  win.webContents.on('did-navigate-in-page', () => setTimeout(() => checkAndFinish(win.webContents), 500))
  win.webContents.on('did-finish-load', () => setTimeout(() => checkAndFinish(win.webContents), 500))

  win.loadURL('https://grok.com', { userAgent: DESKTOP_UA })
  win.on('closed', () => app.quit())
})

app.on('window-all-closed', () => app.quit())
