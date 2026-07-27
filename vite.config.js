import { defineConfig, createLogger } from 'vite'
import react from '@vitejs/plugin-react'
import { createBackendReporter, PROXY_ERROR_PATTERN } from './vite.backend-proxy.js'

// Where `npm run dev` sends /api during development. Overridable so the frontend
// can be pointed at the deployed Render API without editing this file.
const API_TARGET = process.env.VITE_DEV_API_TARGET || 'http://localhost:3001'

// Vite prints a full stack trace for EVERY failed proxy request, and the health
// probe polls constantly — so a stopped backend produced one trace every few
// seconds. `backend` reports the same fact once per state change instead, so
// Vite's version is dropped here rather than duplicated.
const logger = createLogger()
const logError = logger.error.bind(logger)
logger.error = (msg, options) => {
  if (typeof msg === 'string' && PROXY_ERROR_PATTERN.test(msg)) return
  logError(msg, options)
}

// Built with the logger, not console, so status lines get Vite's timestamp
// prefix and sit in the same output stream as the rest of the dev server.
const backend = createBackendReporter({ target: API_TARGET, logger })

export default defineConfig({
  plugins: [react(), backend.plugin],
  customLogger: logger,
  server: {
    proxy: {
      '/api': {
        target: API_TARGET,
        // Matches the default Vite applies to the string shorthand this replaces.
        changeOrigin: true,
        configure: backend.configure,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
})
