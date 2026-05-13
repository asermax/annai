import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { surfaceSchema } from '../../src/shared/surface.ts'

const here = dirname(fileURLToPath(import.meta.url))
const examplePath = resolve(here, '../../../../references/surface-example.json')

const loadExample = (): unknown => JSON.parse(readFileSync(examplePath, 'utf8'))

describe('surfaceSchema', () => {
  it('accepts the bundled example surface', () => {
    const example = loadExample()
    const parsed = surfaceSchema.parse(example)
    expect(parsed.pr.number).toBeGreaterThan(0)
    expect(parsed.groups.length).toBeGreaterThan(0)
  })

  it('rejects an unknown annotation kind', () => {
    const example = loadExample() as { groups: Array<{ diffs: Array<{ annotations: Array<{ kind: string }> }> }> }
    example.groups[0]!.diffs[0]!.annotations[0]!.kind = 'totally-made-up'
    expect(() => surfaceSchema.parse(example)).toThrow()
  })

  it('rejects an unknown group kind', () => {
    const example = loadExample() as { groups: Array<{ kind: string }> }
    example.groups[0]!.kind = 'not-a-real-kind'
    expect(() => surfaceSchema.parse(example)).toThrow()
  })

  it('rejects a negative line range', () => {
    const example = loadExample() as { groups: Array<{ diffs: Array<{ annotations: Array<{ lineRange: [number, number] }> }> }> }
    example.groups[0]!.diffs[0]!.annotations[0]!.lineRange = [-1, 5]
    expect(() => surfaceSchema.parse(example)).toThrow()
  })
})
