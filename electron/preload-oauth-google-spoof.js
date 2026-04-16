/**
 * preload-oauth-google-spoof.js
 *
 * Domain-gated Chrome spoofing preload.
 *
 * Unlike preload-chrome-spoof.js (which is used for Gemini and runs on every
 * page), this preload is safe to attach to the ChatGPT / Perplexity BrowserViews
 * because it does NOTHING unless the current page is on a Google/Microsoft/Apple
 * OAuth domain.  On the AI sites' own pages it is completely inert.
 *
 * Requires contextIsolation: false so that Object.defineProperty patches land
 * in the page's own V8 context (not just the isolated preload world).
 */
;(function () {
  'use strict'

  // Only activate on Google / Microsoft / Apple OAuth pages
  const OAUTH_HOSTS = [
    'accounts.google.com',
    'oauth2.googleapis.com',
    'accounts.youtube.com',
    'login.microsoftonline.com',
    'login.live.com',
    'microsoft.com',
    'appleid.apple.com',
    'apple.com',
  ]

  try {
    const h = window.location.hostname.replace(/^www\./, '')
    const isOAuth = OAUTH_HOSTS.some((d) => h === d || h.endsWith('.' + d))
    if (!isOAuth) return   // ← early exit; do nothing on chatgpt.com / perplexity.ai
  } catch (_) {
    return
  }

  // ── Version info ─────────────────────────────────────────────────────────────
  const CHROME_FULL = (typeof process !== 'undefined' && process.versions?.chrome)
    ? process.versions.chrome
    : '130.0.6723.116'
  const CHROME_MAJOR = CHROME_FULL.split('.')[0]

  // ── 1. window.chrome ─────────────────────────────────────────────────────────
  try {
    if (!window.chrome) {
      Object.defineProperty(window, 'chrome', {
        value: {
          app: {
            isInstalled: false,
            getDetails: function () { return null },
            getIsInstalled: function () { return false },
            installState: function (cb) { if (typeof cb === 'function') cb('not_installed') },
            runningState: function () { return 'cannot_run' },
          },
          runtime: {
            id: undefined,
            connect: function () {
              return { postMessage: function () {}, disconnect: function () {},
                onMessage: { addListener: function () {} },
                onDisconnect: { addListener: function () {} } }
            },
            sendMessage: function () {},
            getManifest: function () { return null },
            getURL: function (p) { return 'chrome-extension://invalid/' + (p || '') },
            lastError: undefined,
            onMessage:  { addListener: function () {}, removeListener: function () {}, hasListener: function () { return false } },
            onConnect:  { addListener: function () {}, removeListener: function () {}, hasListener: function () { return false } },
            onInstalled:{ addListener: function () {}, removeListener: function () {} },
          },
          loadTimes: function () {
            const t = Date.now() / 1000
            return { commitLoadTime: t - 0.06, connectionInfo: 'h2',
              finishDocumentLoadTime: t - 0.01, finishLoadTime: t,
              firstPaintAfterLoadTime: 0, firstPaintTime: t - 0.02,
              navigationType: 'Other', npnNegotiatedProtocol: 'h2',
              requestTime: t - 0.12, startLoadTime: t - 0.10,
              wasAlternateProtocolAvailable: false,
              wasFetchedViaSpdy: true, wasNpnNegotiated: true }
          },
          csi: function () {
            return { onloadT: Date.now(), pageT: performance.now(),
              startE: Date.now() - 120, tran: 15 }
          },
        },
        writable: true, enumerable: true, configurable: false,
      })
    } else {
      if (!window.chrome.runtime) window.chrome.runtime = { id: undefined }
    }
  } catch (_) {}

  // ── 2. navigator.userAgentData (Client Hints — brand list) ───────────────────
  try {
    const brands = [
      { brand: 'Not-A.Brand', version: '24' },
      { brand: 'Chromium',    version: CHROME_MAJOR },
      { brand: 'Google Chrome', version: CHROME_MAJOR },
    ]
    const fullVersionList = [
      { brand: 'Not-A.Brand', version: '24.0.0.0' },
      { brand: 'Chromium',    version: CHROME_FULL },
      { brand: 'Google Chrome', version: CHROME_FULL },
    ]
    Object.defineProperty(navigator, 'userAgentData', {
      get: function () {
        return {
          get brands() { return brands },
          get mobile() { return false },
          get platform() { return 'Windows' },
          getHighEntropyValues: function (hints) {
            const r = { mobile: false, platform: 'Windows' }
            if (!Array.isArray(hints)) return Promise.resolve(r)
            if (hints.includes('architecture'))   r.architecture   = 'x86'
            if (hints.includes('bitness'))        r.bitness        = '64'
            if (hints.includes('brands'))         r.brands         = brands
            if (hints.includes('fullVersionList'))r.fullVersionList= fullVersionList
            if (hints.includes('model'))          r.model          = ''
            if (hints.includes('platform'))       r.platform       = 'Windows'
            if (hints.includes('platformVersion'))r.platformVersion= '15.0.0'
            if (hints.includes('uaFullVersion'))  r.uaFullVersion  = CHROME_FULL
            if (hints.includes('wow64'))          r.wow64          = false
            return Promise.resolve(r)
          },
          toJSON: function () { return { brands, mobile: false, platform: 'Windows' } },
        }
      },
      configurable: true, enumerable: false,
    })
  } catch (_) {}

  // ── 3. navigator.userAgent — remove "Electron" string ────────────────────────
  try {
    const ua = navigator.userAgent.replace(/\s*Electron\/[\d.]+\s*/g, ' ').trim()
    Object.defineProperty(navigator, 'userAgent', {
      get: function () { return ua }, configurable: true, enumerable: false,
    })
    const appVer = ua.replace(/^Mozilla\//, '')
    Object.defineProperty(navigator, 'appVersion', {
      get: function () { return appVer }, configurable: true, enumerable: false,
    })
  } catch (_) {}

  // ── 4. navigator.webdriver ───────────────────────────────────────────────────
  try {
    Object.defineProperty(navigator, 'webdriver', {
      get: function () { return false }, configurable: true, enumerable: false,
    })
  } catch (_) {}

  // ── 5. navigator.plugins — non-empty (Google checks for 0 plugins) ───────────
  try {
    if (!navigator.plugins || navigator.plugins.length === 0) {
      const names = ['PDF Viewer','Chrome PDF Viewer','Chromium PDF Viewer',
                     'Microsoft Edge PDF Viewer','WebKit built-in PDF']
      const arr = []
      arr.item       = (i) => arr[i] || null
      arr.namedItem  = (n) => arr.find((p) => p.name === n) || null
      arr.refresh    = () => {}
      names.forEach((name) => {
        try {
          const p = Object.create(Plugin.prototype)
          Object.defineProperties(p, {
            name:        { value: name, enumerable: true },
            filename:    { value: 'internal-pdf-viewer', enumerable: true },
            description: { value: 'Portable Document Format', enumerable: true },
            length:      { value: 1, enumerable: true },
          })
          arr.push(p)
        } catch (_) {}
      })
      Object.defineProperty(arr, 'length', { get: () => names.length, enumerable: true })
      Object.defineProperty(navigator, 'plugins', {
        get: function () { return arr }, configurable: true, enumerable: false,
      })
    }
  } catch (_) {}

  // ── 6. navigator.permissions — 'notifications' should be 'default' not 'denied' ─
  try {
    const _orig = navigator.permissions.query.bind(navigator.permissions)
    Object.defineProperty(navigator.permissions, 'query', {
      value: function (desc) {
        if (desc?.name === 'notifications') {
          return Promise.resolve({ state: 'default', onchange: null })
        }
        return _orig(desc)
      },
      configurable: true, writable: true,
    })
  } catch (_) {}

  // ── 7. outerHeight / outerWidth — headless/embedded if 0 ─────────────────────
  try {
    if (window.outerHeight === 0)
      Object.defineProperty(window, 'outerHeight', { get: () => window.innerHeight + 88, configurable: true })
    if (window.outerWidth === 0)
      Object.defineProperty(window, 'outerWidth',  { get: () => window.innerWidth,       configurable: true })
  } catch (_) {}

  // NOTE: We intentionally skip window.process hiding and Error patching here.
  // Those are safe for Gemini but can interfere with React on other pages.
})()
