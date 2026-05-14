import { describe, it, expect } from 'vitest'

import { parseUnifiedDiff } from '../../src/shared/diff-parser.ts'

// Most of these fixtures are deliberately small chunks that mimic the
// shape `git diff` emits — including the blank lines, no-newline marker,
// and renames the parser has to handle.

describe('parseUnifiedDiff', () => {
  it('parses a simple modification', () => {
    const diff = [
      'diff --git a/src/foo.ts b/src/foo.ts',
      'index 1111111..2222222 100644',
      '--- a/src/foo.ts',
      '+++ b/src/foo.ts',
      '@@ -1,3 +1,3 @@',
      ' const a = 1',
      '-const b = 2',
      '+const b = 3',
      ' const c = 4',
      '',
    ].join('\n')

    const files = parseUnifiedDiff(diff)
    expect(files).toHaveLength(1)
    expect(files[0]!.path).toBe('src/foo.ts')
    expect(files[0]!.hunks).toHaveLength(1)
    expect(files[0]!.hunks[0]!.header).toBe('@@ -1,3 +1,3 @@')
    expect(files[0]!.hunks[0]!.lines).toEqual([
      { kind: 'context', oldLine: 1, newLine: 1, content: 'const a = 1' },
      { kind: 'del', oldLine: 2, newLine: null, content: 'const b = 2' },
      { kind: 'add', oldLine: null, newLine: 2, content: 'const b = 3' },
      { kind: 'context', oldLine: 3, newLine: 3, content: 'const c = 4' },
    ])
  })

  it('treats empty hunk lines as context with empty content', () => {
    const diff = [
      'diff --git a/x b/x',
      '--- a/x',
      '+++ b/x',
      '@@ -1,4 +1,4 @@',
      ' line1',
      '',
      ' line3',
      '-line4',
      '+line4!',
      '',
    ].join('\n')

    const lines = parseUnifiedDiff(diff)[0]!.hunks[0]!.lines
    expect(lines[1]).toEqual({ kind: 'context', oldLine: 2, newLine: 2, content: '' })
    expect(lines[2]).toEqual({ kind: 'context', oldLine: 3, newLine: 3, content: 'line3' })
    expect(lines[3]).toEqual({ kind: 'del', oldLine: 4, newLine: null, content: 'line4' })
    expect(lines[4]).toEqual({ kind: 'add', oldLine: null, newLine: 4, content: 'line4!' })
  })

  it('handles single-line @@ headers (no comma counts)', () => {
    const diff = [
      'diff --git a/x b/x',
      '--- a/x',
      '+++ b/x',
      '@@ -3 +3 @@',
      '-old',
      '+new',
      '',
    ].join('\n')

    const hunk = parseUnifiedDiff(diff)[0]!.hunks[0]!
    expect(hunk.lines).toEqual([
      { kind: 'del', oldLine: 3, newLine: null, content: 'old' },
      { kind: 'add', oldLine: null, newLine: 3, content: 'new' },
    ])
  })

  it('parses an added file (--- /dev/null)', () => {
    const diff = [
      'diff --git a/new.ts b/new.ts',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/new.ts',
      '@@ -0,0 +1,2 @@',
      '+const a = 1',
      '+const b = 2',
      '',
    ].join('\n')

    const file = parseUnifiedDiff(diff)[0]!
    expect(file.path).toBe('new.ts')
    expect(file.hunks[0]!.lines).toEqual([
      { kind: 'add', oldLine: null, newLine: 1, content: 'const a = 1' },
      { kind: 'add', oldLine: null, newLine: 2, content: 'const b = 2' },
    ])
  })

  it('parses a deleted file (+++ /dev/null) and derives path from --- a/<path>', () => {
    const diff = [
      'diff --git a/gone.ts b/gone.ts',
      'deleted file mode 100644',
      '--- a/gone.ts',
      '+++ /dev/null',
      '@@ -1,2 +0,0 @@',
      '-const a = 1',
      '-const b = 2',
      '',
    ].join('\n')

    const file = parseUnifiedDiff(diff)[0]!
    expect(file.path).toBe('gone.ts')
    expect(file.hunks[0]!.lines).toEqual([
      { kind: 'del', oldLine: 1, newLine: null, content: 'const a = 1' },
      { kind: 'del', oldLine: 2, newLine: null, content: 'const b = 2' },
    ])
  })

  it('records pure renames with no hunks', () => {
    const diff = [
      'diff --git a/old.ts b/new.ts',
      'similarity index 100%',
      'rename from old.ts',
      'rename to new.ts',
      '',
    ].join('\n')

    const files = parseUnifiedDiff(diff)
    expect(files).toHaveLength(1)
    expect(files[0]!.path).toBe('new.ts')
    expect(files[0]!.hunks).toEqual([])
  })

  it('records renames with content changes under the new path', () => {
    const diff = [
      'diff --git a/old.ts b/new.ts',
      'similarity index 90%',
      'rename from old.ts',
      'rename to new.ts',
      '--- a/old.ts',
      '+++ b/new.ts',
      '@@ -1,2 +1,2 @@',
      ' const a = 1',
      '-const b = 2',
      '+const b = 3',
      '',
    ].join('\n')

    const file = parseUnifiedDiff(diff)[0]!
    expect(file.path).toBe('new.ts')
    expect(file.hunks).toHaveLength(1)
    expect(file.hunks[0]!.lines).toHaveLength(3)
  })

  it('skips "\\ No newline at end of file" markers', () => {
    const diff = [
      'diff --git a/x b/x',
      '--- a/x',
      '+++ b/x',
      '@@ -1,1 +1,1 @@',
      '-old',
      '\\ No newline at end of file',
      '+new',
      '\\ No newline at end of file',
      '',
    ].join('\n')

    const hunk = parseUnifiedDiff(diff)[0]!.hunks[0]!
    expect(hunk.lines).toEqual([
      { kind: 'del', oldLine: 1, newLine: null, content: 'old' },
      { kind: 'add', oldLine: null, newLine: 1, content: 'new' },
    ])
  })

  it('handles multiple files in one diff', () => {
    const diff = [
      'diff --git a/a.ts b/a.ts',
      '--- a/a.ts',
      '+++ b/a.ts',
      '@@ -1 +1 @@',
      '-a',
      '+A',
      'diff --git a/b.ts b/b.ts',
      '--- a/b.ts',
      '+++ b/b.ts',
      '@@ -1 +1 @@',
      '-b',
      '+B',
      '',
    ].join('\n')

    const files = parseUnifiedDiff(diff)
    expect(files.map(f => f.path)).toEqual(['a.ts', 'b.ts'])
    expect(files[0]!.hunks[0]!.lines[1]!.content).toBe('A')
    expect(files[1]!.hunks[0]!.lines[1]!.content).toBe('B')
  })

  it('treats added/deleted lines whose content starts with "+++"/"---" as content, not headers', () => {
    // An added line whose payload is `++ tricky` would render as `+++ tricky`
    // in the diff. The parser must NOT mistake this for a `+++ b/<path>` header.
    const diff = [
      'diff --git a/x b/x',
      '--- a/x',
      '+++ b/x',
      '@@ -1,2 +1,2 @@',
      '-keep',
      '+++ tricky',
      ' tail',
      '',
    ].join('\n')

    const hunk = parseUnifiedDiff(diff)[0]!.hunks[0]!
    expect(hunk.lines).toEqual([
      { kind: 'del', oldLine: 1, newLine: null, content: 'keep' },
      { kind: 'add', oldLine: null, newLine: 1, content: '++ tricky' },
      { kind: 'context', oldLine: 2, newLine: 2, content: 'tail' },
    ])
  })

  it('keeps line counters consistent across multiple hunks in one file', () => {
    const diff = [
      'diff --git a/x b/x',
      '--- a/x',
      '+++ b/x',
      '@@ -1,2 +1,2 @@',
      ' a',
      '-b',
      '+B',
      '@@ -10,2 +10,2 @@',
      ' j',
      '-k',
      '+K',
      '',
    ].join('\n')

    const hunks = parseUnifiedDiff(diff)[0]!.hunks
    expect(hunks).toHaveLength(2)
    expect(hunks[1]!.lines[0]).toEqual({ kind: 'context', oldLine: 10, newLine: 10, content: 'j' })
    expect(hunks[1]!.lines[2]).toEqual({ kind: 'add', oldLine: null, newLine: 11, content: 'K' })
  })
})
