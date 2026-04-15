/**
 * preload-en-locale.js
 *
 * Overrides navigator.language / navigator.languages so the page sees
 * en-US instead of the Windows system locale (e.g. ko-KR).
 *
 * Must run with contextIsolation: false so the property definitions are
 * visible to the page's own JavaScript (same V8 context).
 *
 * Kept intentionally minimal — no Error patching, no chrome object spoofing.
 * Safe to use on any AI site that reads navigator.language for its UI locale.
 */
;(function () {
  try {
    Object.defineProperty(navigator, 'language', {
      get: () => 'en-US',
      configurable: true,
    })
    Object.defineProperty(navigator, 'languages', {
      get: () => Object.freeze(['en-US', 'en']),
      configurable: true,
    })
  } catch (_) {
    // Some sub-frames may already have the property locked — ignore silently.
  }
})()
