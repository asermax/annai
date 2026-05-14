import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

// Read the canonical plugin version from .claude-plugin/plugin.json at build time
// so the rendered nav stays in sync with whatever ships in the marketplace.
const pluginManifest = JSON.parse(
  readFileSync(resolve(here, '../../../../.claude-plugin/plugin.json'), 'utf8'),
)

export default defineConfig({
  root: resolve(here, 'src/frontend'),
  base: '/',
  plugins: [react()],
  define: {
    __ANNAI_VERSION__: JSON.stringify(pluginManifest.version),
  },
  build: {
    outDir: resolve(here, 'dist/frontend'),
    emptyOutDir: true,
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@shared': resolve(here, 'src/shared'),
    },
  },
})
