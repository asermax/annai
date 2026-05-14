import type { Hunk } from './surface.ts'

export interface FileDiff {
  path: string
  hunks: Hunk[]
}

const HUNK_HEADER_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/

// Parse a unified diff (the output of `git diff` / `gh pr diff`) into the
// typed shape the surface schema expects. Accepts adds (`+++ b/<path>`
// with `--- /dev/null`), deletes (`--- a/<path>` with `+++ /dev/null`),
// pure renames (no hunks), and regular modifications.
export const parseUnifiedDiff = (text: string): FileDiff[] => {
  const files: FileDiff[] = []
  let current: FileDiff | null = null

  // Per-file header state captured between `diff --git` and the first
  // hunk so we can decide what path to record.
  let pendingOldPath: string | null = null
  let pendingNewPath: string | null = null
  let renameTo: string | null = null
  let inHeader = true  // resets to true on every `diff --git`

  let currentHunk: Hunk | null = null
  let oldLn = 0
  let newLn = 0
  // Lines remaining in the current hunk, sourced from the `@@` header
  // counts. We stop consuming hunk lines once both reach zero so that
  // trailing blank lines (after the last hunk in the diff) don't get
  // misclassified as context.
  let oldRemaining = 0
  let newRemaining = 0

  const ensureFile = (): FileDiff | null => {
    if (current != null) return current
    const path = renameTo ?? pendingNewPath ?? pendingOldPath
    if (path == null) return null

    const file: FileDiff = { path, hunks: [] }
    current = file
    files.push(file)
    return file
  }

  const resetFileState = (): void => {
    current = null
    currentHunk = null
    pendingOldPath = null
    pendingNewPath = null
    renameTo = null
    inHeader = true
    oldRemaining = 0
    newRemaining = 0
  }

  for (const line of text.split('\n')) {
    if (line.startsWith('diff --git ')) {
      resetFileState()
      continue
    }

    // File headers — `--- ` / `+++ ` only count outside hunks. An added
    // line whose payload starts with `++ ` would otherwise be misread as
    // a header.
    if (inHeader && line.startsWith('--- ')) {
      const target = line.slice(4)
      pendingOldPath = target === '/dev/null'
        ? null
        : target.startsWith('a/') ? target.slice(2) : target
      continue
    }

    if (inHeader && line.startsWith('+++ ')) {
      const target = line.slice(4)
      pendingNewPath = target === '/dev/null'
        ? null
        : target.startsWith('b/') ? target.slice(2) : target
      continue
    }

    if (inHeader && line.startsWith('rename to ')) {
      renameTo = line.slice('rename to '.length)
      // Pure renames may have no hunks — record the file now so we don't
      // lose it.
      ensureFile()
      continue
    }

    if (line.startsWith('@@')) {
      const m = HUNK_HEADER_RE.exec(line)
      if (m == null) continue

      const file = ensureFile()
      inHeader = false
      if (file == null) continue  // /dev/null on both sides; skip

      oldLn = parseInt(m[1]!, 10)
      // Counts are optional in the header — `@@ -3 +3 @@` means 1 line
      // on each side.
      oldRemaining = m[2] != null ? parseInt(m[2], 10) : 1
      newLn = parseInt(m[3]!, 10)
      newRemaining = m[4] != null ? parseInt(m[4], 10) : 1
      currentHunk = { header: line, lines: [] }
      file.hunks.push(currentHunk)
      continue
    }

    if (currentHunk == null) continue
    if (oldRemaining <= 0 && newRemaining <= 0) continue

    if (line.startsWith('\\ No newline at end of file')) continue

    if (line.startsWith('+')) {
      currentHunk.lines.push({
        kind: 'add',
        oldLine: null,
        newLine: newLn,
        content: line.slice(1),
      })
      newLn += 1
      newRemaining -= 1
      continue
    }

    if (line.startsWith('-')) {
      currentHunk.lines.push({
        kind: 'del',
        oldLine: oldLn,
        newLine: null,
        content: line.slice(1),
      })
      oldLn += 1
      oldRemaining -= 1
      continue
    }

    // Context line. Empty hunk lines have no leading space — treat them
    // as context with empty content so the line counters advance.
    const content = line.startsWith(' ') ? line.slice(1) : ''
    currentHunk.lines.push({
      kind: 'context',
      oldLine: oldLn,
      newLine: newLn,
      content,
    })
    oldLn += 1
    newLn += 1
    oldRemaining -= 1
    newRemaining -= 1
  }

  return files
}
