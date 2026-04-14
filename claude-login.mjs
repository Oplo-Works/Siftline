/**
 * Claude AI 로그인 세션 준비 스크립트
 *
 * - persist:claude 파티션에 Anthropic 계정 로그인 후 쿠키를 저장합니다.
 * - 저장된 쿠키는 메인 앱(AI Council) 실행 시 Claude 패널이 정상 로드되도록 합니다.
 * - 로그인 완료 후 창을 닫으면 자동 종료됩니다.
 */

import { app, BrowserWindow, session } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 메인 앱과 동일한 UA/파티션 사용
const CHROME_FULL  = process.versions.chrome
const CHROME_MAJOR = CHROME_FULL.split('.')[0]
const DESKTOP_UA   = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_MAJOR}.0.0.0 Safari/537.36`
const PARTITION    = 'persist:claude'   // 메인 앱과 동일한 파티션

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
  const SPOOF_PRELOAD = path.join(__dirname, 'electron', 'preload-chrome-spoof.js')
  const win = new BrowserWindow({
    width:  520,
    height: 720,
    title:  'Claude 로그인 — AI Council 세션 준비',
    webPreferences: {
      partition:        PARTITION,
      preload:          SPOOF_PRELOAD,
      contextIsolation: false,
      nodeIntegration:  false,
    },
  })

  win.setMenuBarVisibility(false)
  win.webContents.setUserAgent(DESKTOP_UA)

  // ── Google OAuth 팝업 처리 ────────────────────────────────────────────────
  // claude.ai에서 "Continue with Google" 클릭 시 Google OAuth 팝업이 열림.
  // 팝업에도 동일한 preload + partition + UA를 적용해야 Google이 Electron을 감지하지 못함.
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

  // 팝업 창에도 UA 설정 + 세션 쿠키 완료 감지 적용
  win.webContents.on('did-create-window', (popup) => {
    popup.setMenuBarVisibility(false)
    popup.webContents.setUserAgent(DESKTOP_UA)

    popup.webContents.on('did-navigate', async (_e, url) => {
      // Google OAuth 완료 후 claude.ai로 돌아오면 로그인 완료
      if (!url.startsWith('https://claude.ai')) return
      const cookies = await ses.cookies.get({ domain: 'claude.ai' })
      const hasSession = cookies.length > 0
      if (hasSession) {
        console.log(`✅ Claude 로그인 완료 (OAuth) — 쿠키 ${cookies.length}개 저장됨`)
        await ses.cookies.flushStore()
        win.setTitle('✅ 로그인 완료 — 3초 후 창이 닫힙니다')
        win.webContents.executeJavaScript(`
          document.body.innerHTML =
            '<div style="font-family:sans-serif;text-align:center;padding:60px 30px;background:#fdf4ff">' +
            '<div style="font-size:64px">✅</div>' +
            '<h2 style="color:#6b21a8;margin:16px 0">Claude 로그인 완료!</h2>' +
            '<p style="color:#7e22ce">AI Council을 실행하면 Claude 패널이 정상 로드됩니다.</p>' +
            '<p style="color:#6b7280;font-size:13px;margin-top:24px">3초 후 자동으로 닫힙니다...</p>' +
            '</div>'
        `).catch(() => {})
        setTimeout(() => app.quit(), 3000)
      }
    })
  })

  // 로그인 완료 감지: claude.ai 메인 페이지로 이동하면 완료 처리
  win.webContents.on('did-navigate', async (_e, url) => {
    // 로그인 후 claude.ai 도메인에 도달했는지 확인
    const isOnClaude = url.startsWith('https://claude.ai') && !url.includes('/login') && !url.includes('/oauth')

    if (!isOnClaude) return

    // 쿠키 확인 (Anthropic 세션 쿠키)
    const cookies = await ses.cookies.get({ domain: 'claude.ai' })
    const hasSession = cookies.some(c =>
      c.name === 'sessionKey' ||
      c.name === '__Secure-next-auth.session-token' ||
      c.name === 'lastActiveOrg' ||
      c.name.startsWith('ch_')
    )

    if (hasSession || cookies.length > 0) {
      console.log(`✅ Claude 로그인 완료 — 쿠키 ${cookies.length}개 저장됨`)
      await ses.cookies.flushStore()   // 디스크에 즉시 저장

      // 완료 안내 후 3초 뒤 자동 종료
      win.setTitle('✅ 로그인 완료 — 3초 후 창이 닫힙니다')
      win.webContents.executeJavaScript(`
        document.body.innerHTML =
          '<div style="font-family:sans-serif;text-align:center;padding:60px 30px;background:#fdf4ff">' +
          '<div style="font-size:64px">✅</div>' +
          '<h2 style="color:#6b21a8;margin:16px 0">Claude 로그인 완료!</h2>' +
          '<p style="color:#7e22ce">AI Council을 실행하면 Claude 패널이 정상 로드됩니다.</p>' +
          '<p style="color:#6b7280;font-size:13px;margin-top:24px">3초 후 자동으로 닫힙니다...</p>' +
          '</div>'
      `).catch(() => {})
      setTimeout(() => app.quit(), 3000)
    }
  })

  // Claude 로그인 페이지로 시작
  win.loadURL('https://claude.ai/login', { userAgent: DESKTOP_UA })

  // 창 닫히면 종료
  win.on('closed', () => app.quit())
})

app.on('window-all-closed', () => app.quit())
