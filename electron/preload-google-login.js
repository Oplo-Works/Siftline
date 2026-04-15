/**
 * Preload specifically for Google login window
 *
 * Runs with contextIsolation: false and interacts directly with the page window.
 * Spoofs APIs Google uses to detect embedded browsers as Chrome:
 *   - window.chrome (Chrome extensions API skeleton)
 *   - navigator.userAgentData (sec-ch-ua client hints)
 *   - navigator.plugins (detection fails if list is empty)
 */
;(function () {
  const CHROME_MAJOR = process.versions.chrome.split('.')[0]
  const CHROME_FULL  = process.versions.chrome

  // ── 1. window.chrome ──────────────────────────────────────────────────────
  // Google validates browsers by checking for window.chrome presence and internal structure.
  if (!window.chrome) {
    Object.defineProperty(window, 'chrome', {
      writable: true,
      enumerable: true,
      configurable: false,
      value: {
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
          getDetails:     function () { return null },
          getIsInstalled: function () { return false },
          installState:   function (cb) { cb('not_installed') },
          runningState:   function () { return 'cannot_run' },
        },
        runtime: {
          id: undefined,
          connect:           function () {},
          sendMessage:       function () {},
          getManifest:       function () { return null },
          getURL:            function (p) { return p },
          reload:            function () {},
          requestUpdateCheck: function () {},
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
        },
        // Chrome's page loading timing API
        loadTimes: function () {
          const now = Date.now() / 1000
          return {
            commitLoadTime: now - 0.05,
            connectionInfo: 'h2',
            finishDocumentLoadTime: now,
            finishLoadTime: now + 0.01,
            firstPaintAfterLoadTime: 0,
            firstPaintTime: now - 0.01,
            navigationType: 'Other',
            npnNegotiatedProtocol: 'h2',
            requestTime: now - 0.1,
            startLoadTime: now - 0.08,
            wasAlternateProtocolAvailable: false,
            wasFetchedViaSpdy: true,
            wasNpnNegotiated: true,
          }
        },
        // Chrome performance metrics API
        csi: function () {
          return {
            onloadT: Date.now(),
            pageT: performance.now(),
            startE: Date.now() - 100,
            tran: 15,
          }
        },
      },
    })
  }

  // ── 2. navigator.userAgentData ────────────────────────────────────────────
  // Electron often returns "Chromium" alone or invalid values instead of "Google Chrome".
  try {
    const brands = [
      { brand: 'Chromium',      version: CHROME_MAJOR },
      { brand: 'Google Chrome', version: CHROME_MAJOR },
      { brand: 'Not-A.Brand',   version: '24' },
    ]
    const uaData = {
      brands,
      mobile: false,
      platform: 'Windows',
      getHighEntropyValues: async function (hints) {
        const result = { mobile: false, platform: 'Windows' }
        if (hints.includes('architecture'))    result.architecture    = 'x86'
        if (hints.includes('bitness'))         result.bitness         = '64'
        if (hints.includes('brands'))          result.brands          = brands
        if (hints.includes('fullVersionList')) result.fullVersionList = [
          { brand: 'Chromium',      version: CHROME_FULL },
          { brand: 'Google Chrome', version: CHROME_FULL },
          { brand: 'Not-A.Brand',   version: '24.0.0.0' },
        ]
        if (hints.includes('model'))           result.model           = ''
        if (hints.includes('platformVersion')) result.platformVersion = '10.0.0'
        if (hints.includes('uaFullVersion'))   result.uaFullVersion   = CHROME_FULL
        if (hints.includes('wow64'))           result.wow64           = false
        return result
      },
      toJSON: function () {
        return { brands, mobile: false, platform: 'Windows' }
      },
    }
    Object.defineProperty(navigator, 'userAgentData', {
      get: () => uaData,
      configurable: true,
    })
  } catch (_) {}

  // ── 3. navigator.plugins — Google detects embedded browsers if plugins.length is 0 ──
  try {
    if (navigator.plugins.length === 0) {
      const fakePlugins = ['PDF Viewer', 'Chrome PDF Viewer', 'Chromium PDF Viewer',
                           'Microsoft Edge PDF Viewer', 'WebKit built-in PDF']
      const pluginArray = fakePlugins.map((name, i) => {
        const plugin = Object.create(Plugin.prototype)
        Object.defineProperties(plugin, {
          name:        { value: name, enumerable: true },
          filename:    { value: 'internal-pdf-viewer', enumerable: true },
          description: { value: 'Portable Document Format', enumerable: true },
          length:      { value: 0, enumerable: true },
        })
        return plugin
      })
      pluginArray.item    = (i) => pluginArray[i] || null
      pluginArray.namedItem = (n) => pluginArray.find(p => p.name === n) || null
      pluginArray.refresh = () => {}
      Object.defineProperty(navigator, 'plugins', {
        get: () => pluginArray,
        configurable: true,
      })
    }
  } catch (_) {}

  // ── 4. Remove webdriver flag ─────────────────────────────────────────────
  try {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
      configurable: true,
    })
  } catch (_) {}
})()
