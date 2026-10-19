import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const PUBLIC_FILES = [
  'favicon.svg',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
]

// Emits sw.js with the full list of built files so the whole app works offline after the first visit.
function offlineServiceWorker(): Plugin {
  return {
    name: 'offline-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = ['./', ...Object.keys(bundle), ...PUBLIC_FILES]
      const hash = createHash('sha1')
      for (const item of Object.values(bundle)) {
        hash.update(item.fileName)
        hash.update(item.type === 'chunk' ? item.code : (item.source as string | Uint8Array))
      }
      const template = readFileSync('pwa/sw.template.js', 'utf8')
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template
          .replace('__VERSION__', hash.digest('hex').slice(0, 10))
          .replace('__PRECACHE__', JSON.stringify(files)),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the app works under any path (e.g. GitHub Pages /repo-name/).
  base: './',
  plugins: [react(), offlineServiceWorker()],
})
