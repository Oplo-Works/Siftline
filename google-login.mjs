/**
 * Google 로그인 세션 준비 스크립트
 *
 * - persist:gemini 파티션에 Google 계정 로그인 후 쿠키를 저장합니다.
 * - 저장된 쿠키는 메인 앱(AI Council) 실행 시 Gemini 패널이 502 없이 로드되도록 합니다.
 * - 로그인 완료 후 창을 닫으면 자동 종료됩니다.
 */

import { app, BrowserWindow, session, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 메인 앱과 동일한 UA/파티션 사용
const CHROME_FULL  = process.versions.chrome
const CHROME_MAJOR = CHROME_FULL.split('.')[0]
const DESKTOP_UA   = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_MAJOR}.0.0.0 Safari/537.36`
const PARTITION    = 'persist:gemini'   // 메인 앱과 동일한 파티션

app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled')

app.whenReady().then(async () => {
  const ses = session.fromPartition(PARTITION)
  ses.setUserAgent(DESKTOP_UA)

  // ── UA 헤더 스푸핑 (메인 앱과 동일) ─────────────────────────────────────
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

  // ── 로그인 창 ────────────────────────────────────────────────────────────
  // preload-chrome-spoof.js: Google이 Electron을 감지하지 못하도록
  //   window.chrome / navigator.userAgentData / plugins 등을 Chrome으로 위장.
  // contextIsolation: false 필수 — true이면 preload가 isolated world에서 실행되어
  //   페이지의 window에 접근 불가 (스푸핑이 무효화됨).
  const SPOOF_PRELOAD = path.join(__dirname, 'electron', 'preload-chrome-spoof.js')
  const win = new BrowserWindow({
    width:  520,
    height: 680,
    title:  'Google 로그인 — AI Council 세션 준비',
    webPreferences: {
      partition:        PARTITION,
      preload:          SPOOF_PRELOAD,
      contextIsolation: false,   // MAIN world 주입을 위해 반드시 false
      nodeIntegration:  false,
    },
  })

  win.setMenuBarVisibility(false)
  win.webContents.setUserAgent(DESKTOP_UA)

  // 로그인 완료 감지: 로그인 후 myaccount.google.com 또는 gemini.google.com 으로 이동하면 완료 처리
  win.webContents.on('did-navigate', async (_e, url) => {
    const isLoggedIn =
      url.startsWith('https://myaccount.google.com') ||
      url.startsWith('https://gemini.google.com')    ||
      url.includes('accounts.google.com/signin/v2/challenge/pwd') === false && url.includes('google.com/') && !url.includes('accounts.google.com/v3/signin')

    // 쿠키 확인
    const cookies = await ses.cookies.get({ domain: '.google.com' })
    const hasSID  = cookies.some(c => c.name === 'SID' || c.name === '__Secure-1PSID')

    if (hasSID) {
      console.log(`✅ Google 로그인 완료 — 쿠키 ${cookies.length}개 저장됨`)
      await ses.cookies.flushStore()   // 디스크에 즉시 저장

      // 완료 안내 후 3초 뒤 자동 종료
      win.setTitle('✅ 로그인 완료 — 3초 후 창이 닫힙니다')
      win.webContents.executeJavaScript(`
        document.body.innerHTML =
          '<div style="font-family:sans-serif;text-align:center;padding:60px 30px;background:#f0fdf4">' +
          '<div style="font-size:64px">✅</div>' +
          '<h2 style="color:#166534;margin:16px 0">Google 로그인 완료!</h2>' +
          '<p style="color:#15803d">AI Council을 실행하면 Gemini가 정상 로드됩니다.</p>' +
          '<p style="color:#6b7280;font-size:13px;margin-top:24px">3초 후 자동으로 닫힙니다...</p>' +
          '</div>'
      `).catch(() => {})
      setTimeout(() => app.quit(), 3000)
    }
  })

  // Google 로그인 페이지로 시작
  win.loadURL('https://accounts.google.com/signin', { userAgent: DESKTOP_UA })

  // 창 닫히면 종료
  win.on('closed', () => app.quit())
})

app.on('window-all-closed', () => app.quit())
