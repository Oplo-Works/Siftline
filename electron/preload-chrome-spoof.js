/**
 * preload-chrome-spoof.js
 *
 * Google 로그인 차단 우회 — Chrome 완전 위장 preload
 *
 * 반드시 contextIsolation: false 로 실행해야 합니다.
 * (isolated world에서는 페이지의 window에 접근 불가)
 *
 * Google이 Electron을 감지하는 모든 벡터를 차단:
 *   1. window.chrome          — 핵심 Chrome extension API 골격
 *   2. navigator.userAgentData — Client Hints API (brand/version 검사)
 *   3. navigator.plugins       — 0이면 embedded WebView로 간주
 *   4. navigator.webdriver     — automation 플래그 제거
 *   5. navigator.userAgent     — "Electron" 문자열 제거
 *   6. window.outerHeight/Width — 0이면 headless/embedded로 간주
 *   7. navigator.permissions   — Notification 권한 fingerprint 차단
 *   8. process / global 노출   — Node.js 전역 객체 은폐
 */
; (function () {
  'use strict'

  // ── 버전 정보 (process.versions.chrome는 Electron preload에서 접근 가능) ──
  const CHROME_FULL = (typeof process !== 'undefined' && process.versions && process.versions.chrome)
    ? process.versions.chrome
    : '130.0.6723.116'  // 폴백: 현재 안정 버전
  const CHROME_MAJOR = CHROME_FULL.split('.')[0]

  // ── 1. window.chrome ─────────────────────────────────────────────────────
  // Google은 window.chrome 존재 + 내부 API 구조 + prototype을 모두 검사합니다.
  // Electron은 window.chrome이 없거나 불완전하게 노출됩니다.
  try {
    const chromeObj = {
      // chrome.app: PWA / 설치 상태 API
      app: {
        isInstalled: false,
        InstallState: {
          DISABLED: 'disabled',
          INSTALLED: 'installed',
          NOT_INSTALLED: 'not_installed',
        },
        RunningState: {
          CANNOT_RUN: 'cannot_run',
          READY_TO_RUN: 'ready_to_run',
          RUNNING: 'running',
        },
        getDetails: function () { return null },
        getIsInstalled: function () { return false },
        installState: function (cb) { if (typeof cb === 'function') cb('not_installed') },
        runningState: function () { return 'cannot_run' },
      },

      // chrome.runtime: extension IPC API
      runtime: {
        id: undefined,
        connect: function () { return { postMessage: function () { }, disconnect: function () { }, onMessage: { addListener: function () { } }, onDisconnect: { addListener: function () { } } } },
        sendMessage: function () { },
        getManifest: function () { return null },
        getURL: function (p) { return 'chrome-extension://invalid/' + (p || '') },
        reload: function () { },
        requestUpdateCheck: function () { },
        lastError: undefined,
        OnInstalledReason: {
          CHROME_UPDATE: 'chrome_update',
          INSTALL: 'install',
          SHARED_MODULE_UPDATE: 'shared_module_update',
          UPDATE: 'update',
        },
        PlatformOs: {
          ANDROID: 'android', CROS: 'cros', LINUX: 'linux',
          MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win',
        },
        PlatformArch: {
          ARM: 'arm', ARM64: 'arm64', MIPS: 'mips',
          MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64',
        },
        PlatformNaclArch: {
          ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64',
          X86_32: 'x86-32', X86_64: 'x86-64',
        },
        RequestUpdateCheckStatus: {
          NO_UPDATE: 'no_update',
          THROTTLED: 'throttled',
          UPDATE_AVAILABLE: 'update_available',
        },
        // onMessage / onConnect 이벤트 스텁
        onConnect: { addListener: function () { }, removeListener: function () { }, hasListener: function () { return false } },
        onMessage: { addListener: function () { }, removeListener: function () { }, hasListener: function () { return false } },
        onInstalled: { addListener: function () { }, removeListener: function () { } },
        onStartup: { addListener: function () { }, removeListener: function () { } },
        onSuspend: { addListener: function () { }, removeListener: function () { } },
        onUpdateAvailable: { addListener: function () { }, removeListener: function () { } },
      },

      // chrome.loadTimes(): 실제 Chrome 전용 타이밍 API
      loadTimes: function () {
        const t = Date.now() / 1000
        return {
          commitLoadTime: t - 0.06,
          connectionInfo: 'h2',
          finishDocumentLoadTime: t - 0.01,
          finishLoadTime: t,
          firstPaintAfterLoadTime: 0,
          firstPaintTime: t - 0.02,
          navigationType: 'Other',
          npnNegotiatedProtocol: 'h2',
          requestTime: t - 0.12,
          startLoadTime: t - 0.10,
          wasAlternateProtocolAvailable: false,
          wasFetchedViaSpdy: true,
          wasNpnNegotiated: true,
        }
      },

      // chrome.csi(): Chrome-specific 성능 지표
      csi: function () {
        return {
          onloadT: Date.now(),
          pageT: performance.now(),
          startE: Date.now() - 120,
          tran: 15,
        }
      },
    }

    // window.chrome 이 이미 존재하면 덮어쓰지 않음 (실제 Chrome에서 실행될 경우 보호)
    if (!window.chrome) {
      Object.defineProperty(window, 'chrome', {
        value: chromeObj,
        writable: true,
        enumerable: true,
        configurable: false,
      })
    } else {
      // 이미 있어도 누락된 키 보완
      if (!window.chrome.runtime) window.chrome.runtime = chromeObj.runtime
      if (!window.chrome.app) window.chrome.app = chromeObj.app
    }
  } catch (_) { }

  // ── 2. navigator.userAgentData ────────────────────────────────────────────
  // Google은 이 API를 통해 brand 목록에서 "Electron"이나 "Chromium only"를 감지합니다.
  // 실제 Chrome은 항상 "Google Chrome"을 포함하며, getHighEntropyValues()를 지원합니다.
  try {
    const brands = [
      { brand: 'Not-A.Brand', version: '24' },
      { brand: 'Chromium', version: CHROME_MAJOR },
      { brand: 'Google Chrome', version: CHROME_MAJOR },
    ]
    const fullVersionList = [
      { brand: 'Not-A.Brand', version: '24.0.0.0' },
      { brand: 'Chromium', version: CHROME_FULL },
      { brand: 'Google Chrome', version: CHROME_FULL },
    ]

    const uaDataProto = {
      get brands() { return brands },
      get mobile() { return false },
      get platform() { return 'Windows' },
      getHighEntropyValues: function (hints) {
        const result = { mobile: false, platform: 'Windows' }
        if (!Array.isArray(hints)) return Promise.resolve(result)
        if (hints.includes('architecture')) result.architecture = 'x86'
        if (hints.includes('bitness')) result.bitness = '64'
        if (hints.includes('brands')) result.brands = brands
        if (hints.includes('fullVersionList')) result.fullVersionList = fullVersionList
        if (hints.includes('model')) result.model = ''
        if (hints.includes('platform')) result.platform = 'Windows'
        if (hints.includes('platformVersion')) result.platformVersion = '15.0.0'
        if (hints.includes('uaFullVersion')) result.uaFullVersion = CHROME_FULL
        if (hints.includes('wow64')) result.wow64 = false
        return Promise.resolve(result)
      },
      toJSON: function () {
        return { brands, mobile: false, platform: 'Windows' }
      },
    }

    Object.defineProperty(navigator, 'userAgentData', {
      get: function () { return uaDataProto },
      configurable: true,
      enumerable: false,
    })
  } catch (_) { }

  // ── 3. navigator.userAgent — "Electron" 문자열 제거 ──────────────────────
  // 일부 Google 서비스는 UA 문자열을 JS 측에서도 직접 검사합니다.
  try {
    const ua = navigator.userAgent.replace(/\s*Electron\/[\d.]+\s*/g, ' ').trim()
    Object.defineProperty(navigator, 'userAgent', {
      get: function () { return ua },
      configurable: true,
      enumerable: false,
    })
    // appVersion도 userAgent 기반에서 "Electron" 제거
    const appVersion = ua.replace(/^Mozilla\//, '')
    Object.defineProperty(navigator, 'appVersion', {
      get: function () { return appVersion },
      configurable: true,
      enumerable: false,
    })
  } catch (_) { }

  // ── 4. navigator.webdriver — automation 감지 플래그 ──────────────────────
  try {
    Object.defineProperty(navigator, 'webdriver', {
      get: function () { return false },
      configurable: true,
      enumerable: false,
    })
  } catch (_) { }

  // ── 5. navigator.plugins — 빈 목록이면 headless/embedded로 간주됨 ────────
  // Chrome은 기본적으로 PDF Viewer 플러그인들을 포함합니다.
  try {
    if (!navigator.plugins || navigator.plugins.length === 0) {
      const pluginNames = [
        'PDF Viewer',
        'Chrome PDF Viewer',
        'Chromium PDF Viewer',
        'Microsoft Edge PDF Viewer',
        'WebKit built-in PDF',
      ]

      // PluginArray/Plugin prototype은 브라우저가 제공하므로 Object.create로 모방
      const fakePluginArray = []
      fakePluginArray.item = function (i) { return this[i] || null }
      fakePluginArray.namedItem = function (n) { return this.find(function (p) { return p.name === n }) || null }
      fakePluginArray.refresh = function () { }

      pluginNames.forEach(function (name) {
        try {
          const plugin = Object.create(navigator.plugins[0] ? navigator.plugins[0].__proto__ : Plugin.prototype)
          Object.defineProperties(plugin, {
            name: { value: name, enumerable: true },
            filename: { value: 'internal-pdf-viewer', enumerable: true },
            description: { value: 'Portable Document Format', enumerable: true },
            length: { value: 1, enumerable: true },
          })
          fakePluginArray.push(plugin)
        } catch (_) { }
      })

      Object.defineProperty(fakePluginArray, 'length', {
        get: function () { return pluginNames.length },
        enumerable: true,
      })

      Object.defineProperty(navigator, 'plugins', {
        get: function () { return fakePluginArray },
        configurable: true,
        enumerable: false,
      })

      // mimeTypes도 맞춰줌
      const fakeMimeTypes = [
        { type: 'application/pdf', suffixes: 'pdf', description: '', enabledPlugin: fakePluginArray[0] },
        { type: 'text/pdf', suffixes: 'pdf', description: '', enabledPlugin: fakePluginArray[0] },
      ]
      fakeMimeTypes.item = function (i) { return this[i] || null }
      fakeMimeTypes.namedItem = function (n) { return this.find(function (m) { return m.type === n }) || null }
      Object.defineProperty(fakeMimeTypes, 'length', { get: function () { return 2 }, enumerable: true })

      Object.defineProperty(navigator, 'mimeTypes', {
        get: function () { return fakeMimeTypes },
        configurable: true,
        enumerable: false,
      })
    }
  } catch (_) { }

  // ── 6. window.outerHeight / outerWidth — 0이면 headless 감지됨 ──────────
  // Electron의 frameless 창에서 outerHeight가 0으로 보이는 경우가 있음
  try {
    if (window.outerHeight === 0) {
      Object.defineProperty(window, 'outerHeight', {
        get: function () { return window.innerHeight + 88 },
        configurable: true,
      })
    }
    if (window.outerWidth === 0) {
      Object.defineProperty(window, 'outerWidth', {
        get: function () { return window.innerWidth },
        configurable: true,
      })
    }
  } catch (_) { }

  // ── 7. navigator.permissions — Notification 권한이 'denied'이면 감지됨 ──
  // 실제 Chrome에서는 'default'(미결정)가 정상이며, Electron은 종종 'denied' 반환
  try {
    const _origQuery = navigator.permissions.query.bind(navigator.permissions)
    Object.defineProperty(navigator.permissions, 'query', {
      value: function (desc) {
        if (desc && desc.name === 'notifications') {
          return Promise.resolve({ state: 'default', onchange: null })
        }
        return _origQuery(desc)
      },
      configurable: true,
      writable: true,
    })
  } catch (_) { }

  // ── 8. process 전역 은폐 (렌더러에서 노출되면 Electron 감지) ─────────────
  // contextIsolation: false 일 때 위험할 수 있으므로 삭제 대신 undefined 오버라이드
  try {
    if (typeof window.process !== 'undefined') {
      Object.defineProperty(window, 'process', {
        value: undefined,
        configurable: true,
        writable: true,
        enumerable: false,
      })
    }
  } catch (_) { }

  // ── 9. Error.stack에서 "electron" 경로 제거 (고급 감지 차단) ─────────────
  try {
    const _OrigError = window.Error
    function PatchedError(msg) {
      const err = new _OrigError(msg)
      if (err.stack) {
        err.stack = err.stack.replace(/\s*at.*electron.*\n?/g, '')
      }
      return err
    }
    PatchedError.prototype = _OrigError.prototype
    PatchedError.captureStackTrace = _OrigError.captureStackTrace
    window.Error = PatchedError
  } catch (_) { }

})()
