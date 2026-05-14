import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

const pluginManifest = JSON.parse(
  readFileSync(resolve(here, '../../../../.claude-plugin/plugin.json'), 'utf8'),
)

export default defineConfig({
  plugins: [react()],
  define: {
    __ANNAI_VERSION__: JSON.stringify(pluginManifest.version),
  },
  test: {
    globals: false,
    environmentMatchGlobs: [
      ['tests/frontend/**', 'jsdom'],
      ['tests/unit/**', 'node'],
    ],
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@shared': resolve(here, 'src/shared'),
    },
  },
})
