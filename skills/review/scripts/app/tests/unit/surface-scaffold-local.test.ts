import { describe, it, expect } from 'vitest'

import { buildLocalScaffold } from '../../src/cli/surface/scaffold-local.ts'

const sampleDiff = [
  'diff --git a/src/a.ts b/src/a.ts',
  '--- a/src/a.ts',
  '+++ b/src/a.ts',
  '@@ -1,2 +1,3 @@',
  ' const a = 1',
  '-const b = 2',
  '+const b = 3',
  '+const c = 4',
  'diff --git a/src/b.ts b/src/b.ts',
  '--- a/src/b.ts',
  '+++ b/src/b.ts',
  '@@ -1 +1 @@',
  '-foo',
  '+bar',
  '',
].join('\n')

describe('buildLocalScaffold', () => {
  it('produces a schema-valid local surface with one unsorted group, derived stats, and the supplied subject metadata', () => {
    const surface = buildLocalScaffold(sampleDiff, '/some/repo', 'Agent draft', 'work/agent', 'HEAD')

    expect(surface.subject).toEqual({
      kind: 'local',
      title: 'Agent draft',
      branch: 'work/agent',
      baseRef: 'HEAD',
      stats: { additions: 3, deletions: 2, files: 2 },
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

  it('does not include any PR-shaped fields on the subject', () => {
    const surface = buildLocalScaffold(sampleDiff, '/some/repo', 'Agent draft', 'work/agent', 'main')
    const subject = surface.subject as Record<string, unknown>
    expect(subject.url).toBeUndefined()
    expect(subject.number).toBeUndefined()
    expect(subject.baseBranch).toBeUndefined()
  })

  it('shares diff id slugging with the PR scaffold (disambiguates colliding slugs)', () => {
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

    const surface = buildLocalScaffold(colliding, '/some/repo', 't', 'b', 'HEAD')
    expect(surface.groups[0]!.diffs.map(d => d.id)).toEqual(['diff-foo-ts', 'diff-foo-ts-2'])
  })
})
