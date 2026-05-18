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
    expect(parsed.subject.kind).toBe('pr')
    if (parsed.subject.kind === 'pr') {
      expect(parsed.subject.number).toBeGreaterThan(0)
    }
    expect(parsed.groups.length).toBeGreaterThan(0)
  })

  it('accepts a local-subject surface', () => {
    const local = {
      subject: {
        kind: 'local',
        title: 'Agent draft',
        branch: 'work/x',
        baseRef: 'HEAD',
        stats: { additions: 1, deletions: 0, files: 1 },
      },
      tldr: '',
      repo: { path: '.' },
      groups: [],
    }
    const parsed = surfaceSchema.parse(local)
    expect(parsed.subject.kind).toBe('local')
  })

  it('rejects an unknown subject kind', () => {
    const example = loadExample() as { subject: { kind: string } }
    example.subject.kind = 'not-a-real-kind'
    expect(() => surfaceSchema.parse(example)).toThrow()
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
