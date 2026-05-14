import '@testing-library/jest-dom/vitest'

import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// vitest.config sets `globals: false`, which disables @testing-library/react's
// auto-cleanup. Mount it manually so each test starts with a clean DOM.
afterEach(() => cleanup())

// jsdom doesn't ship ResizeObserver. Minimal stub so components that use it
// (Note observes its own height) can mount in tests.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  ;(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub
}
