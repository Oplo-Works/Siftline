/**
 * dev.mjs — Cross-platform dev launcher for AI Council
 * Starts Vite dev server then launches Electron once server is ready
 */
import { spawn } from 'child_process'
import waitOn from 'wait-on'

const VITE_URL = 'http://localhost:5173'

// Start Vite
const vite = spawn('npx', ['vite'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, FORCE_COLOR: '1' },
})

vite.on('error', (err) => {
  console.error('Vite failed to start:', err)
  process.exit(1)
})

console.log('[dev] Starting Vite...')

// Wait for Vite to be ready, then launch Electron
waitOn({ resources: [VITE_URL], timeout: 30000 })
  .then(() => {
    console.log('[dev] Vite ready. Launching Electron...')
    const electron = spawn(
      'npx',
      ['electron', '.'],
      {
        stdio: 'inherit',
        shell: true,
        env: {
          ...process.env,
          NODE_ENV: 'development',
          VITE_DEV_SERVER_URL: VITE_URL,
          FORCE_COLOR: '1',
        },
      }
    )

    electron.on('close', (code) => {
      console.log(`[dev] Electron exited (${code}). Stopping Vite.`)
      vite.kill()
      process.exit(code ?? 0)
    })
  })
  .catch((err) => {
    console.error('[dev] Timed out waiting for Vite:', err.message)
    vite.kill()
    process.exit(1)
  })

process.on('SIGINT', () => {
  vite.kill()
  process.exit(0)
})
