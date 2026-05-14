import type { KeyboardEvent } from 'react'

// Returns an onKeyDown handler that fires `save()` on Ctrl/Cmd+Enter.
// Ctrl covers Linux/Windows, meta covers macOS.
export const onSubmitKey = (save: () => void) => (e: KeyboardEvent<HTMLTextAreaElement>): void => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    save()
  }
}
