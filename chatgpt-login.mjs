/**
 * ChatGPT Login Session Script
 *
 * Opens a login window in the persist:chatgpt partition so that
 * the ChatGPT panel in AI Council loads without authentication errors.
 *
 * Workarounds applied:
 *   - Full Chrome identity spoof (preload-chrome-spoof.js) to bypass
 *     Google's "This browser or app may not be secure" block
 *   - UA + sec-ch-ua header replacement to hide Electron identity
 *   - Same spoof applied to Google and Microsoft OAuth popups
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
const PARTITION    = 'persist:chatgpt'

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

  // Block WebAuthn permission requests at the session level as well
  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === 'publickey-credentials-get' || permission === 'publickey-credentials-create') {
      callback(false)
      return
    }
    callback(true)
  })
  ses.setUserAgent(DESKTOP_UA)

  // Replace UA and sec-ch-ua headers so Google / Microsoft OAuth accepts the request
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
    title:  'ChatGPT Login — AI Council Session Setup',
    webPreferences: {
      partition:        PARTITION,
      preload:          SPOOF_PRELOAD,
      contextIsolation: false,
      nodeIntegration:  false,
    },
  })

  win.setMenuBarVisibility(false)
  win.webContents.setUserAgent(DESKTOP_UA)

  // Allow Google / Microsoft / Apple OAuth popups and apply the same spoof
  const OAUTH_ALLOWED = [
    'accounts.google.com',
    'oauth2.googleapis.com',
    'accounts.youtube.com',
    'login.microsoftonline.com',
    'login.live.com',
    'microsoft.com',
    'openai.com',
    'chatgpt.com',
    'auth.openai.com',
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

  const START_TIME = Date.now()
  const GRACE_MS   = 8_000

  // Detect login completion in OAuth popups.
  // The popup navigates through Google → auth.openai.com → chatgpt.com.
  // We guard with GRACE_MS so intermediate redirects don't trigger early close.
  win.webContents.on('did-create-window', (popup) => {
    popup.setMenuBarVisibility(false)
    popup.webContents.setUserAgent(DESKTOP_UA)
    popup.webContents.on('did-navigate', async (_e, url) => {
      if (!url.includes('chatgpt.com') && !url.includes('openai.com')) return
      if (Date.now() - START_TIME < GRACE_MS) return
      await checkAndFinish()
    })
  })

  // Detect login completion in the main window.
  win.webContents.on('did-navigate', async (_e, url) => {
    if (!url.includes('chatgpt.com') && !url.includes('openai.com')) return
    if (Date.now() - START_TIME < GRACE_MS) return
    await checkAndFinish()
  })

  let finished = false
  async function checkAndFinish() {
    if (finished) return

    // URL check: must be on chatgpt.com (not auth pages)
    const mainUrl = win.webContents.getURL()
    if (!mainUrl.startsWith('https://chatgpt.com/') || mainUrl.includes('/auth/')) return

    // DOM check: when NOT logged in, chatgpt.com shows <a href="/auth/login">.
    // When logged in that link is absent.  This distinguishes the logged-out
    // homepage from the logged-in homepage (both are at chatgpt.com/).
    let loginDone = false
    try {
      loginDone = await win.webContents.executeJavaScript(`
        (function() {
          const loginLink = document.querySelector('a[href="/auth/login"]')
          return !loginLink
        })()
      `)
    } catch { return }

    if (!loginDone) return

    finished = true
    // Transfer all cookies to the main app via stdout so the parent process
    // can import them directly into its in-memory Chromium cookie cache.
    // (Writing to SQLite alone is not enough — the parent's in-memory cache
    //  won't pick up changes made by a separate Electron process.)
    const allCookies = await ses.cookies.get({})
    process.stdout.write(JSON.stringify(allCookies) + '\n')
    await ses.cookies.flushStore()
    console.log(`Login complete — URL: ${mainUrl}`)

    win.setTitle('Login complete — closing in 3 s')
    win.webContents.executeJavaScript(`
      document.body.innerHTML =
        '<div style="font-family:sans-serif;text-align:center;padding:60px 30px;background:#f0fdf4">' +
        '<div style="font-size:64px">&#x2705;</div>' +
        '<h2 style="color:#14532d;margin:16px 0">ChatGPT login complete!</h2>' +
        '<p style="color:#166534">The ChatGPT panel will load correctly when you start AI Council.</p>' +
        '<p style="color:#6b7280;font-size:13px;margin-top:24px">Closing in 3 seconds...</p>' +
        '</div>'
    `).catch(() => {})
    setTimeout(() => app.quit(), 3000)
  }

  win.loadURL('https://chatgpt.com/auth/login', { userAgent: DESKTOP_UA })
  win.on('closed', () => app.quit())
})

app.on('window-all-closed', () => app.quit())
