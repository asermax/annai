import { describe, it, expect } from 'vitest'

import { buildScaffold } from '../../src/cli/surface/scaffold.ts'

const meta = {
  number: 42,
  title: 'Test PR',
  url: 'https://github.com/x/y/pull/42',
  headRefName: 'feature/x',
  baseRefName: 'main',
  additions: 5,
  deletions: 3,
  changedFiles: 2,
}

const sampleDiff = [
  'diff --git a/src/a.ts b/src/a.ts',
  '--- a/src/a.ts',
  '+++ b/src/a.ts',
  '@@ -1,2 +1,2 @@',
  ' const a = 1',
  '-const b = 2',
  '+const b = 3',
  'diff --git a/src/b.ts b/src/b.ts',
  '--- a/src/b.ts',
  '+++ b/src/b.ts',
  '@@ -1 +1 @@',
  '-foo',
  '+bar',
  '',
].join('\n')

describe('buildScaffold', () => {
  it('produces a schema-valid surface with one unsorted group containing every changed file', () => {
    const surface = buildScaffold(meta, sampleDiff, '/some/repo')

    expect(surface.subject).toEqual({
      kind: 'pr',
      url: 'https://github.com/x/y/pull/42',
      title: 'Test PR',
      number: 42,
      branch: 'feature/x',
      baseBranch: 'main',
      stats: { additions: 5, deletions: 3, files: 2 },
    })
    expect(surface.repo.path).toBe('/some/repo')
    expect(surface.tldr).toBe('')
    expect(surface.reviewPrompts).toEqual([])
    expect(surface.diagrams).toEqual([])

    expect(surface.groups).toHaveLength(1)
    const group = surface.groups[0]!
    expect(group.id).toBe('unsorted')
    expect(group.kind).toBe('supporting')
    expect(group.diffs.map(d => d.path)).toEqual(['src/a.ts', 'src/b.ts'])

    for (const d of group.diffs) {
      expect(d.annotations).toEqual([])
      expect(d.suggestions).toEqual([])
      expect(d.hunks.length).toBeGreaterThan(0)
    }
  })

  it('generates stable, unique diff ids derived from the file path', () => {
    const surface = buildScaffold(meta, sampleDiff, '/some/repo')
    const ids = surface.groups[0]!.diffs.map(d => d.id)
    expect(ids).toEqual(['diff-src-a-ts', 'diff-src-b-ts'])
  })

  it('disambiguates colliding slugs with a numeric suffix', () => {
    const colliding = [
      'diff --git a/foo.ts b/foo.ts',
      '--- a/foo.ts',
      '+++ b/foo.ts',
      '@@ -1 +1 @@',
      '-a',
      '+b',
      'diff --git a/foo_ts b/foo_ts',
      '--- a/foo_ts',
      '+++ b/foo_ts',
      '@@ -1 +1 @@',
      '-a',
      '+b',
      '',
    ].join('\n')

    const surface = buildScaffold(meta, colliding, '/some/repo')
    expect(surface.groups[0]!.diffs.map(d => d.id)).toEqual(['diff-foo-ts', 'diff-foo-ts-2'])
  })

  it('preserves parsed hunk content exactly', () => {
    const surface = buildScaffold(meta, sampleDiff, '/some/repo')
    const a = surface.groups[0]!.diffs.find(d => d.path === 'src/a.ts')!
    expect(a.hunks[0]!.header).toBe('@@ -1,2 +1,2 @@')
    expect(a.hunks[0]!.lines).toEqual([
      { kind: 'context', oldLine: 1, newLine: 1, content: 'const a = 1' },
      { kind: 'del', oldLine: 2, newLine: null, content: 'const b = 2' },
      { kind: 'add', oldLine: null, newLine: 2, content: 'const b = 3' },
    ])
  })
})
