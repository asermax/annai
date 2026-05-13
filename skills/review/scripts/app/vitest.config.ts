import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
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
