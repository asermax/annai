import { describe, it, expect } from 'vitest'

import { validateMermaidSourceOrThrow } from '../../src/cli/surface/mermaid-validate.ts'

describe('validateMermaidSourceOrThrow', () => {
  it('accepts a valid flowchart', async () => {
    await expect(
      validateMermaidSourceOrThrow('test', 'flowchart LR\n  A --> B'),
    ).resolves.toBeUndefined()
  })

  it('accepts a valid ERD', async () => {
    await expect(
      validateMermaidSourceOrThrow('test', 'erDiagram\n  A ||--o{ B : has'),
    ).resolves.toBeUndefined()
  })

  it('rejects nonsense input with a CLI-friendly error', async () => {
    await expect(
      validateMermaidSourceOrThrow('test', 'this is not mermaid'),
    ).rejects.toThrow(/mermaid syntax error/)
  })

  it('mentions --skip-validate in the error message', async () => {
    await expect(
      validateMermaidSourceOrThrow('cmd-x', 'garbage'),
    ).rejects.toThrow(/--skip-validate/)
  })
})
