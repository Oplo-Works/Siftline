/**
 * Perplexity AI Login Session Script
 *
 * Opens a login window in the persist:perplexity partition so that
 * the Perplexity panel in Siftline loads without authentication errors.
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
// Prevent Windows Security passkey/FIDO2 dialog from appearing during Google OAuth
app.commandLine.appendSwitch('disable-features', 'WebAuthentication,WebAuthenticationCable,WebAuthenticationConditionalUI')

// Use the same userData directory as the main app so persist:* sessions are shared.
// Without this the spawned Electron process defaults to the "Electron" app name
// and stores cookies in a completely different directory.
if (process.env.AI_COUNCIL_USERDATA) {
  app.setPath('userData', process.env.AI_COUNCIL_USERDATA)
}

app.whenReady().then(async () => {
  const ses = session.fromPartition(PARTITION)
  ses.setUserAgent(DESKTOP_UA)

  // Block WebAuthn permission requests at the session level as well
  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === 'publickey-credentials-get' || permission === 'publickey-credentials-create') {
      callback(false)
      return
    }
    callback(true)
  })

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
    title:  'Perplexity Login — Siftline Session Setup',
    webPreferences: {
      partition:        PARTITION,
      preload:          SPOOF_PRELOAD,
      contextIsolation: false,
      nodeIntegration:  false,
    },
  })

  win.setMenuBarVisibility(false)
  win.webContents.setUserAgent(DESKTOP_UA)

  // Allow Google / Apple OAuth popups
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

  // ── Login completion detection ─────────────────────────────────────────────
  // Strategy: track OAuth flow state by navigation events rather than wall-clock
  // time.  We know login is complete only after:
  //   (A) the window (or popup) visited Google/Apple AND
  //   (B) it subsequently navigated back to perplexity.ai AND
  //   (C) __Secure-next-auth.session-token cookie is present
  //
  // This avoids both premature closes (visitor cookies on first load) and
  // missed completions (OAuth completing faster than a fixed grace period).

  let oauthVisited = false   // true once Google/Apple OAuth page was seen

  const isOAuthProvider = (url) =>
    url.includes('accounts.google.com') ||
    url.includes('appleid.apple.com') ||
    url.includes('oauth2.googleapis.com')

  let finished = false
  async function checkAndFinish() {
    if (finished) return
    if (!oauthVisited) return   // haven't gone through OAuth yet

    const cookies = await ses.cookies.get({ domain: '.perplexity.ai' })

    // __Secure-next-auth.session-token is only written upon a *completed* login
    const hasRealSession = cookies.some(c =>
      c.name === '__Secure-next-auth.session-token' ||
      c.name === 'next-auth.session-token'
    )
    if (!hasRealSession) return

    finished = true
    // Transfer all cookies to the main app via stdout so the parent process
    // can import them directly into its in-memory Chromium cookie cache.
    const allCookies = await ses.cookies.get({})
    process.stdout.write(JSON.stringify(allCookies) + '\n')
    console.log(`Perplexity login complete — ${cookies.length} cookies saved`)
    await ses.cookies.flushStore()

    win.setTitle('Login complete — closing in 3 s')
    win.webContents.executeJavaScript(`
      document.body.innerHTML =
        '<div style="font-family:sans-serif;text-align:center;padding:60px 30px;background:#f0f9ff">' +
        '<div style="font-size:64px">&#x2705;</div>' +
        '<h2 style="color:#0c4a6e;margin:16px 0">Perplexity login complete!</h2>' +
        '<p style="color:#0369a1">Closing in 3 seconds...</p>' +
        '</div>'
    `).catch(() => {})
    setTimeout(() => app.quit(), 3000)
  }

  // Main window navigation tracking
  win.webContents.on('did-navigate', async (_e, url) => {
    if (isOAuthProvider(url)) {
      oauthVisited = true
      return
    }
    if (url.includes('perplexity.ai')) {
      await checkAndFinish()
    }
  })

  win.webContents.on('did-navigate-in-page', async (_e, url) => {
    if (url.includes('perplexity.ai') && oauthVisited) {
      await checkAndFinish()
    }
  })

  // Popup tracking (for popup-based OAuth flow)
  win.webContents.on('did-create-window', (popup) => {
    popup.setMenuBarVisibility(false)
    popup.webContents.setUserAgent(DESKTOP_UA)

    // Block WebAuthn in popup too
    popup.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
      if (permission === 'publickey-credentials-get' || permission === 'publickey-credentials-create') {
        callback(false)
        return
      }
      callback(true)
    })

    popup.webContents.on('did-navigate', async (_e, url) => {
      if (isOAuthProvider(url)) {
        oauthVisited = true
        return
      }
      if (url.includes('perplexity.ai')) {
        // Give the server a moment to set the session cookie
        setTimeout(() => checkAndFinish(), 500)
      }
    })
  })

  win.loadURL('https://www.perplexity.ai', { userAgent: DESKTOP_UA })
  win.on('closed', () => app.quit())
})

app.on('window-all-closed', () => app.quit())
