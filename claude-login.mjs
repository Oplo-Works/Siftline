/**
 * Claude AI login session preparation script
 *
 * - Log in to your Anthropic account in the persist:claude partition to save cookies.
 * - Saved cookies allow the Claude panel to load normally when the main app (AI Council) runs.
 * - Automatically closes when the window is closed after login.
 */

import { app, BrowserWindow, session } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Use same UA/partition as main app
const CHROME_FULL  = process.versions.chrome
const CHROME_MAJOR = CHROME_FULL.split('.')[0]
const DESKTOP_UA   = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_MAJOR}.0.0.0 Safari/537.36`
const PARTITION    = 'persist:claude'   // Same partition as main app

app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled')

app.whenReady().then(async () => {
  const ses = session.fromPartition(PARTITION)
  ses.setUserAgent(DESKTOP_UA)

  // ── UA header spoofing (Same as main app) ─────────────────────────────────────
  ses.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, (details, callback) => {
    const headers = {}
    const SKIP = new Set([
      'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform',
      'sec-ch-ua-full-version-list', 'user-agent',
    ])
    for (const [k, v] of Object.entries(details.requestHeaders)) {
      if (!SKIP.has(k.toLowerCase())) headers[k] = v
    }
    headers['user-agent']                   = DESKTOP_UA
    headers['sec-ch-ua']                    = `"Chromium";v="${CHROME_MAJOR}", "Google Chrome";v="${CHROME_MAJOR}", "Not-A.Brand";v="24"`
    headers['sec-ch-ua-mobile']             = '?0'
    headers['sec-ch-ua-platform']           = '"Windows"'
    headers['sec-ch-ua-full-version-list']  = `"Chromium";v="${CHROME_FULL}", "Google Chrome";v="${CHROME_FULL}", "Not-A.Brand";v="24.0.0.0"`
    callback({ requestHeaders: headers })
  })

  // ── Login Window ────────────────────────────────────────────────────────────
  const SPOOF_PRELOAD = path.join(__dirname, 'electron', 'preload-chrome-spoof.js')
  const win = new BrowserWindow({
    width:  520,
    height: 720,
    title:  'Claude Login — AI Council Session Preparation',
    webPreferences: {
      partition:        PARTITION,
      preload:          SPOOF_PRELOAD,
      contextIsolation: false,
      nodeIntegration:  false,
    },
  })

  win.setMenuBarVisibility(false)
  win.webContents.setUserAgent(DESKTOP_UA)

  // ── Google OAuth popup handling ────────────────────────────────────────────────
  // Google OAuth popup opens when clicking "Continue with Google" on claude.ai.
  // Must apply same preload + partition + UA to popups so Google doesn't detect Electron.
  const OAUTH_ALLOWED = [
    'accounts.google.com',
    'oauth2.googleapis.com',
    'accounts.youtube.com',
    'claude.ai',
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
        width: 500,
        height: 660,
        webPreferences: {
          partition:        PARTITION,
          preload:          SPOOF_PRELOAD,
          contextIsolation: false,
          nodeIntegration:  false,
        },
      },
    }
  })

  // Apply UA + session cookie detection logic to popup windows
  win.webContents.on('did-create-window', (popup) => {
    popup.setMenuBarVisibility(false)
    popup.webContents.setUserAgent(DESKTOP_UA)

    popup.webContents.on('did-navigate', async (_e, url) => {
      // Login complete when returning to claude.ai after Google OAuth
      if (!url.startsWith('https://claude.ai')) return
      const cookies = await ses.cookies.get({ domain: 'claude.ai' })
      const hasSession = cookies.length > 0
      if (hasSession) {
        console.log(`✅ Claude login complete (OAuth) — ${cookies.length} cookies saved`)
        await ses.cookies.flushStore()
        win.setTitle('✅ Login Complete — Closing window in 3 seconds')
        win.webContents.executeJavaScript(`
          document.body.innerHTML =
            '<div style="font-family:sans-serif;text-align:center;padding:60px 30px;background:#fdf4ff">' +
            '<div style="font-size:64px">✅</div>' +
            '<h2 style="color:#6b21a8;margin:16px 0">Claude Login Complete!</h2>' +
            '<p style="color:#7e22ce">Claude panel will now load correctly in the AI Council app.</p>' +
            '<p style="color:#6b7280;font-size:13px;margin-top:24px">Window will close automatically in 3 seconds...</p>' +
            '</div>'
        `).catch(() => {})
        setTimeout(() => app.quit(), 3000)
      }
    })
  })

  // Login completion detection: marked as complete when navigating to claude.ai main page
  win.webContents.on('did-navigate', async (_e, url) => {
    // Check if reached claude.ai domain after login
    const isOnClaude = url.startsWith('https://claude.ai') && !url.includes('/login') && !url.includes('/oauth')

    if (!isOnClaude) return

    // Check cookies (Anthropic session cookies)
    const cookies = await ses.cookies.get({ domain: 'claude.ai' })
    const hasSession = cookies.some(c =>
      c.name === 'sessionKey' ||
      c.name === '__Secure-next-auth.session-token' ||
      c.name === 'lastActiveOrg' ||
      c.name.startsWith('ch_')
    )

    if (hasSession || cookies.length > 0) {
      console.log(`✅ Claude login complete — ${cookies.length} cookies saved`)
      await ses.cookies.flushStore()   // Save to disk immediately

      // Show completion notice and exit after 3s
      win.setTitle('✅ Login Complete — Closing window in 3 seconds')
      win.webContents.executeJavaScript(`
        document.body.innerHTML =
          '<div style="font-family:sans-serif;text-align:center;padding:60px 30px;background:#fdf4ff">' +
          '<div style="font-size:64px">✅</div>' +
          '<h2 style="color:#6b21a8;margin:16px 0">Claude Login Complete!</h2>' +
          '<p style="color:#7e22ce">Claude panel will now load correctly in the AI Council app.</p>' +
          '<p style="color:#6b7280;font-size:13px;margin-top:24px">Window will close automatically in 3 seconds...</p>' +
          '</div>'
      `).catch(() => {})
      setTimeout(() => app.quit(), 3000)
    }
  })

  // Start with Claude login page
  win.loadURL('https://claude.ai/login', { userAgent: DESKTOP_UA })

  // Exit on window close
  win.on('closed', () => app.quit())
})

app.on('window-all-closed', () => app.quit())
