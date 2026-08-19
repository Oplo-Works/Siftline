/// <reference types="vite/client" />

declare module '*.png' {
  const src: string
  export default src
}

// Injected via vite.config.ts `define` — ISO timestamp of the build/dev start.
declare const __BUILD_DATE__: string
