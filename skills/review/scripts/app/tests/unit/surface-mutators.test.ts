import { describe, it, expect } from 'vitest'

import type { Diff, Surface } from '../../src/shared/surface.ts'
import {
  annotationAdd,
  annotationDrop,
  diagramAdd,
  diagramDrop,
  diffDrop,
  diffMove,
  groupAdd,
  groupDrop,
  suggestionAdd,
  suggestionDrop,
} from '../../src/shared/surface-mutators.ts'

const makeDiff = (id: string, path = `${id}.ts`): Diff => ({
  id,
  path,
  hunks: [],
  annotations: [],
  suggestions: [],
})

const baseSurface = (): Surface => ({
  pr: {
    url: 'https://github.com/x/y/pull/1',
    title: 't',
    number: 1,
    branch: 'b',
    baseBranch: 'main',
    stats: { additions: 0, deletions: 0, files: 0 },
  },
  tldr: '',
  repo: { path: '.' },
  groups: [
    {
      id: 'unsorted',
      kind: 'supporting',
      title: 'Unsorted',
      intro: '',
      diffs: [makeDiff('d-foo'), makeDiff('d-bar')],
    },
  ],
})

describe('groupAdd', () => {
  it('appends by default', () => {
    const out = groupAdd(baseSurface(), { id: 'g1', kind: 'entry-point', title: 'Entry' })
    expect(out.groups.map(g => g.id)).toEqual(['unsorted', 'g1'])
  })

  it('honours --before', () => {
    const out = groupAdd(baseSurface(), { id: 'g1', kind: 'base-context', title: 'Base', before: 'unsorted' })
    expect(out.groups.map(g => g.id)).toEqual(['g1', 'unsorted'])
  })

  it('honours --after', () => {
    const s = groupAdd(baseSurface(), { id: 'g1', kind: 'entry-point', title: 'a' })
    const out = groupAdd(s, { id: 'g2', kind: 'entry-point', title: 'b', after: 'unsorted' })
    expect(out.groups.map(g => g.id)).toEqual(['unsorted', 'g2', 'g1'])
  })

  it('rejects duplicate ids', () => {
    expect(() => groupAdd(baseSurface(), { id: 'unsorted', kind: 'supporting', title: 'dup' }))
      .toThrow(/already exists/)
  })

  it('rejects unknown --before', () => {
    expect(() => groupAdd(baseSurface(), { id: 'g1', kind: 'supporting', title: 't', before: 'nope' }))
      .toThrow(/not found/)
  })
})

describe('groupDrop', () => {
  it('removes an empty group', () => {
    const s = groupAdd(baseSurface(), { id: 'empty', kind: 'supporting', title: 't' })
    const out = groupDrop(s, 'empty')
    expect(out.groups.map(g => g.id)).toEqual(['unsorted'])
  })

  it('refuses to drop a group with diffs', () => {
    expect(() => groupDrop(baseSurface(), 'unsorted')).toThrow(/still has/)
  })

  it('throws on unknown id', () => {
    expect(() => groupDrop(baseSurface(), 'nope')).toThrow(/not found/)
  })
})

describe('diffMove', () => {
  it('moves a diff to another group, appending by default', () => {
    const s = groupAdd(baseSurface(), { id: 'entry', kind: 'entry-point', title: 'Entry' })
    const out = diffMove(s, { diffId: 'd-foo', toGroup: 'entry' })
    expect(out.groups.find(g => g.id === 'unsorted')!.diffs.map(d => d.id)).toEqual(['d-bar'])
    expect(out.groups.find(g => g.id === 'entry')!.diffs.map(d => d.id)).toEqual(['d-foo'])
  })

  it('honours --position', () => {
    const s = groupAdd(baseSurface(), { id: 'entry', kind: 'entry-point', title: 'Entry' })
    const after1 = diffMove(s, { diffId: 'd-foo', toGroup: 'entry' })
    const after2 = diffMove(after1, { diffId: 'd-bar', toGroup: 'entry', position: 0 })
    expect(after2.groups.find(g => g.id === 'entry')!.diffs.map(d => d.id)).toEqual(['d-bar', 'd-foo'])
  })

  it('reorders within the same group', () => {
    const out = diffMove(baseSurface(), { diffId: 'd-bar', toGroup: 'unsorted', position: 0 })
    expect(out.groups[0]!.diffs.map(d => d.id)).toEqual(['d-bar', 'd-foo'])
  })

  it('throws on unknown diff', () => {
    expect(() => diffMove(baseSurface(), { diffId: 'nope', toGroup: 'unsorted' })).toThrow(/diff/)
  })

  it('throws on unknown target group', () => {
    expect(() => diffMove(baseSurface(), { diffId: 'd-foo', toGroup: 'nope' })).toThrow(/group/)
  })
})

describe('diffDrop', () => {
  it('removes a diff', () => {
    const out = diffDrop(baseSurface(), 'd-foo')
    expect(out.groups[0]!.diffs.map(d => d.id)).toEqual(['d-bar'])
  })

  it('throws on unknown id', () => {
    expect(() => diffDrop(baseSurface(), 'nope')).toThrow(/diff/)
  })
})

describe('annotation mutators', () => {
  it('appends annotations in call order', () => {
    const s1 = annotationAdd(baseSurface(), {
      diffId: 'd-foo',
      id: 'a1',
      kind: 'note',
      title: 't1',
      body: 'b1',
      lineRange: [1, 2],
    })
    const s2 = annotationAdd(s1, {
      diffId: 'd-foo',
      id: 'a2',
      kind: 'question',
      title: 't2',
      body: 'b2',
      lineRange: [3, 4],
    })
    expect(s2.groups[0]!.diffs[0]!.annotations.map(a => a.id)).toEqual(['a1', 'a2'])
  })

  it('rejects duplicate annotation ids on the same diff', () => {
    const s1 = annotationAdd(baseSurface(), {
      diffId: 'd-foo',
      id: 'a1',
      kind: 'note',
      title: 't',
      body: 'b',
      lineRange: [1, 2],
    })
    expect(() => annotationAdd(s1, {
      diffId: 'd-foo',
      id: 'a1',
      kind: 'note',
      title: 't',
      body: 'b',
      lineRange: [1, 2],
    })).toThrow(/already exists/)
  })

  it('drops an annotation', () => {
    const s1 = annotationAdd(baseSurface(), {
      diffId: 'd-foo',
      id: 'a1',
      kind: 'note',
      title: 't',
      body: 'b',
      lineRange: [1, 2],
    })
    const s2 = annotationDrop(s1, 'd-foo', 'a1')
    expect(s2.groups[0]!.diffs[0]!.annotations).toEqual([])
  })

  it('throws when dropping an unknown annotation', () => {
    expect(() => annotationDrop(baseSurface(), 'd-foo', 'nope')).toThrow(/annotation/)
  })
})

describe('suggestion mutators', () => {
  it('appends a suggestion with optional code', () => {
    const s = suggestionAdd(baseSurface(), {
      diffId: 'd-foo',
      id: 's1',
      body: 'change this',
      lineRange: [1, 1],
      suggestionCode: 'const x = 1',
    })
    expect(s.groups[0]!.diffs[0]!.suggestions[0]).toEqual({
      id: 's1',
      body: 'change this',
      lineRange: [1, 1],
      suggestionCode: 'const x = 1',
    })
  })

  it('drops a suggestion', () => {
    const s1 = suggestionAdd(baseSurface(), {
      diffId: 'd-foo',
      id: 's1',
      body: 'b',
      lineRange: [1, 1],
    })
    const s2 = suggestionDrop(s1, 'd-foo', 's1')
    expect(s2.groups[0]!.diffs[0]!.suggestions).toEqual([])
  })
})

describe('diagram mutators', () => {
  it('adds and removes a surface-level diagram', () => {
    const s1 = diagramAdd(baseSurface(), { id: 'flow', title: 'Flow', source: 'flowchart TD\n A --> B' })
    expect(s1.diagrams).toEqual([{ id: 'flow', title: 'Flow', source: 'flowchart TD\n A --> B' }])

    const s2 = diagramDrop(s1, 'flow')
    expect(s2.diagrams).toEqual([])
  })

  it('adds and removes a group-level diagram', () => {
    const s1 = diagramAdd(baseSurface(), {
      id: 'erd',
      title: 'ERD',
      source: 'erDiagram\n A ||--o{ B : has',
      groupId: 'unsorted',
    })
    expect(s1.groups[0]!.diagrams).toEqual([{ id: 'erd', title: 'ERD', source: 'erDiagram\n A ||--o{ B : has' }])

    const s2 = diagramDrop(s1, 'erd', 'unsorted')
    expect(s2.groups[0]!.diagrams).toEqual([])
  })

  it('rejects duplicate diagram ids at the same scope', () => {
    const s1 = diagramAdd(baseSurface(), { id: 'flow', source: 'flowchart TD\n A --> B' })
    expect(() => diagramAdd(s1, { id: 'flow', source: 'flowchart TD\n A --> B' })).toThrow(/already exists/)
  })

  it('throws when dropping a missing diagram', () => {
    expect(() => diagramDrop(baseSurface(), 'nope')).toThrow(/diagram/)
  })
})
