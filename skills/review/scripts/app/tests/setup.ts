import '@testing-library/jest-dom/vitest'

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
