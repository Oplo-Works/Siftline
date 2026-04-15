/**
 * preload-chrome-spoof.js
 *
 * Bypasses Google login blocking — full Chrome spoofing preload
 *
 * Must be executed with contextIsolation: false.
 * (Isolated world cannot access page window)
 *
 * Blocks all vectors Google uses to detect Electron:
 *   1. window.chrome          — Key Chrome extension API skeleton
 *   2. navigator.userAgentData — Client Hints API (brand/version check)
 *   3. navigator.plugins       — embedded WebView detection (if 0)
 *   4. navigator.webdriver     — removes automation flag
 *   5. navigator.userAgent     — removes "Electron" string
 *   6. window.outerHeight/Width — headless/embedded detection (if 0)
 *   7. navigator.permissions   — blocks Notification permission fingerprinting
 *   8. process / global exposure — hides Node.js global objects
 */
; (function () {
  'use strict'

  // ── Version Info (process.versions.chrome is accessible in Electron preload) ──
  const CHROME_FULL = (typeof process !== 'undefined' && process.versions && process.versions.chrome)
    ? process.versions.chrome
    : '130.0.6723.116'  // Fallback: Current stable version
  const CHROME_MAJOR = CHROME_FULL.split('.')[0]

  // ── 1. window.chrome ─────────────────────────────────────────────────────
  // Google checks window.chrome existence + internal API structure + prototype.
  // Electron typically lacks window.chrome or exposes it incompletely.
  try {
    const chromeObj = {
      // chrome.app: PWA / install state API
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
        // onMessage / onConnect event stubs
        onConnect: { addListener: function () { }, removeListener: function () { }, hasListener: function () { return false } },
        onMessage: { addListener: function () { }, removeListener: function () { }, hasListener: function () { return false } },
        onInstalled: { addListener: function () { }, removeListener: function () { } },
        onStartup: { addListener: function () { }, removeListener: function () { } },
        onSuspend: { addListener: function () { }, removeListener: function () { } },
        onUpdateAvailable: { addListener: function () { }, removeListener: function () { } },
      },

      // chrome.loadTimes(): Official Chrome-only timing API
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

      // chrome.csi(): Chrome-specific performance metrics
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
  // Google uses this API to detect "Electron" or "Chromium only" in the brand list.
  // Real Chrome always includes "Google Chrome" and supports getHighEntropyValues().
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

  // ── 3. navigator.userAgent — removing "Electron" string ──────────────────────
  // Some Google services check the UA string directly on the JS side.
  try {
    const ua = navigator.userAgent.replace(/\s*Electron\/[\d.]+\s*/g, ' ').trim()
    Object.defineProperty(navigator, 'userAgent', {
      get: function () { return ua },
      configurable: true,
      enumerable: false,
    })
    // remove "Electron" from appVersion as well
    const appVersion = ua.replace(/^Mozilla\//, '')
    Object.defineProperty(navigator, 'appVersion', {
      get: function () { return appVersion },
      configurable: true,
      enumerable: false,
    })
  } catch (_) { }

  // ── 4. navigator.webdriver — automation detection flag ──────────────────────
  try {
    Object.defineProperty(navigator, 'webdriver', {
      get: function () { return false },
      configurable: true,
      enumerable: false,
    })
  } catch (_) { }

  // ── 5. navigator.plugins — Google detects headless/embedded if empty ────────
  // Chrome includes PDF Viewer plugins by default.
  try {
    if (!navigator.plugins || navigator.plugins.length === 0) {
      const pluginNames = [
        'PDF Viewer',
        'Chrome PDF Viewer',
        'Chromium PDF Viewer',
        'Microsoft Edge PDF Viewer',
        'WebKit built-in PDF',
      ]

      // Imitate PluginArray/Plugin prototype using Object.create as provided by the browser
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

      // match mimeTypes as well
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

  // ── 6. window.outerHeight / outerWidth — headless detected if 0 ──────────
  // outerHeight might appear as 0 in Electron's frameless windows
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

  // ── 7. navigator.permissions — Detected if Notification permission is 'denied' ──
  // Normally 'default' in real Chrome; Electron often returns 'denied'
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

  // ── 8. Hide global process (Detects Electron if exposed in renderer) ─────────────
  // Override with undefined instead of deleting due to potential risk with contextIsolation: false
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

  // ── 9. Remove "electron" path from Error.stack (Block advanced detection) ─────────────
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
