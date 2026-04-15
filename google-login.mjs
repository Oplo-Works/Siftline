/**
 * Google login session preparation script
 *
 * - Log in to your Google account in the persist:gemini partition to save cookies.
 * - Saved cookies allow the Gemini panel to load without 502 errors when the main app (AI Council) runs.
 * - Automatically closes when the window is closed after login.
 */

import { app, BrowserWindow, session, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Use same UA/partition as main app
const CHROME_FULL  = process.versions.chrome
const CHROME_MAJOR = CHROME_FULL.split('.')[0]
const DESKTOP_UA   = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_MAJOR}.0.0.0 Safari/537.36`
const PARTITION    = 'persist:gemini'   // Same partition as main app

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
  // preload-chrome-spoof.js: Mask window.chrome / navigator.userAgentData / plugins
  // to prevent Google from detecting Electron.
  // contextIsolation: false is mandatory — if true, preload runs in an isolated world
  // and cannot access the page window (masking becomes invalid).
  const SPOOF_PRELOAD = path.join(__dirname, 'electron', 'preload-chrome-spoof.js')
  const win = new BrowserWindow({
    width:  520,
    height: 680,
    title:  'Google Login — AI Council Session Preparation',
    webPreferences: {
      partition:        PARTITION,
      preload:          SPOOF_PRELOAD,
      contextIsolation: false,   // Must be false for MAIN world injection
      nodeIntegration:  false,
    },
  })

  win.setMenuBarVisibility(false)
  win.webContents.setUserAgent(DESKTOP_UA)

  // Login completion detection: marked as complete when navigating to myaccount.google.com or gemini.google.com after login
  win.webContents.on('did-navigate', async (_e, url) => {
    const isLoggedIn =
      url.startsWith('https://myaccount.google.com') ||
      url.startsWith('https://gemini.google.com')    ||
      url.includes('accounts.google.com/signin/v2/challenge/pwd') === false && url.includes('google.com/') && !url.includes('accounts.google.com/v3/signin')

    // Check cookies
    const cookies = await ses.cookies.get({ domain: '.google.com' })
    const hasSID  = cookies.some(c => c.name === 'SID' || c.name === '__Secure-1PSID')

    if (hasSID) {
      console.log(`✅ Google Login Complete — ${cookies.length} cookies saved`)
      await ses.cookies.flushStore()   // Save to disk immediately

      // Show completion notice and exit after 3s
      win.setTitle('✅ Login Complete — Closing window in 3 seconds')
      win.webContents.executeJavaScript(`
        document.body.innerHTML =
          '<div style="font-family:sans-serif;text-align:center;padding:60px 30px;background:#f0fdf4">' +
          '<div style="font-size:64px">✅</div>' +
          '<h2 style="color:#166534;margin:16px 0">Google Login Complete!</h2>' +
          '<p style="color:#15803d">Gemini will now load correctly in the AI Council app.</p>' +
          '<p style="color:#6b7280;font-size:13px;margin-top:24px">Window will close automatically in 3 seconds...</p>' +
          '</div>'
      `).catch(() => {})
      setTimeout(() => app.quit(), 3000)
    }
  })

  // Start with Google login page
  win.loadURL('https://accounts.google.com/signin', { userAgent: DESKTOP_UA })

  // Exit on window close
  win.on('closed', () => app.quit())
})

app.on('window-all-closed', () => app.quit())
