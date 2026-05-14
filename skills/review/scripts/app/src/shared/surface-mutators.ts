import type {
  Annotation,
  AnnotationKind,
  Diff,
  Group,
  GroupKind,
  MermaidDiagram,
  Suggestion,
  Surface,
} from './surface.ts'

// Pure functions returning a new Surface for each authoring op. Validation
// against the zod schema is the caller's responsibility — these mutators
// throw descriptive errors only for structural problems the schema can't
// catch (unknown ids, duplicate ids, dropping a non-empty group).

export interface GroupAddOp {
  id: string
  kind: GroupKind
  title: string
  intro?: string
  before?: string
  after?: string
}

export const groupAdd = (surface: Surface, op: GroupAddOp): Surface => {
  if (surface.groups.some(g => g.id === op.id)) {
    throw new Error(`group "${op.id}" already exists`)
  }

  const fresh: Group = {
    id: op.id,
    kind: op.kind,
    title: op.title,
    intro: op.intro ?? '',
    diffs: [],
  }

  const groups = [...surface.groups]

  if (op.before != null) {
    const idx = groups.findIndex(g => g.id === op.before)
    if (idx < 0) throw new Error(`group "${op.before}" (for --before) not found`)
    groups.splice(idx, 0, fresh)
  } else if (op.after != null) {
    const idx = groups.findIndex(g => g.id === op.after)
    if (idx < 0) throw new Error(`group "${op.after}" (for --after) not found`)
    groups.splice(idx + 1, 0, fresh)
  } else {
    groups.push(fresh)
  }

  return { ...surface, groups }
}

export const groupDrop = (surface: Surface, id: string): Surface => {
  const idx = surface.groups.findIndex(g => g.id === id)
  if (idx < 0) throw new Error(`group "${id}" not found`)

  const group = surface.groups[idx]!
  if (group.diffs.length > 0) {
    throw new Error(`group "${id}" still has ${group.diffs.length} diff(s); move or drop them first`)
  }

  return { ...surface, groups: surface.groups.filter((_, i) => i !== idx) }
}

const findDiffLocation = (
  surface: Surface,
  diffId: string,
): { groupIdx: number, diffIdx: number, diff: Diff } => {
  for (let g = 0; g < surface.groups.length; g++) {
    const group = surface.groups[g]!
    const d = group.diffs.findIndex(x => x.id === diffId)
    if (d >= 0) return { groupIdx: g, diffIdx: d, diff: group.diffs[d]! }
  }
  throw new Error(`diff "${diffId}" not found`)
}

export interface DiffMoveOp {
  diffId: string
  toGroup: string
  position?: number
}

export const diffMove = (surface: Surface, op: DiffMoveOp): Surface => {
  const targetIdx = surface.groups.findIndex(g => g.id === op.toGroup)
  if (targetIdx < 0) throw new Error(`group "${op.toGroup}" not found`)

  const { groupIdx, diffIdx, diff } = findDiffLocation(surface, op.diffId)

  // Build the new diff arrays for the source group and the target group.
  // If source === target, work on one array.
  if (groupIdx === targetIdx) {
    const diffs = surface.groups[groupIdx]!.diffs.filter((_, i) => i !== diffIdx)
    const pos = op.position == null ? diffs.length : Math.max(0, Math.min(op.position, diffs.length))
    diffs.splice(pos, 0, diff)

    const groups = surface.groups.map((g, i) => (i === groupIdx ? { ...g, diffs } : g))
    return { ...surface, groups }
  }

  const sourceDiffs = surface.groups[groupIdx]!.diffs.filter((_, i) => i !== diffIdx)
  const targetDiffs = [...surface.groups[targetIdx]!.diffs]
  const pos = op.position == null
    ? targetDiffs.length
    : Math.max(0, Math.min(op.position, targetDiffs.length))
  targetDiffs.splice(pos, 0, diff)

  const groups = surface.groups.map((g, i) => {
    if (i === groupIdx) return { ...g, diffs: sourceDiffs }
    if (i === targetIdx) return { ...g, diffs: targetDiffs }
    return g
  })

  return { ...surface, groups }
}

export const diffDrop = (surface: Surface, diffId: string): Surface => {
  const { groupIdx, diffIdx } = findDiffLocation(surface, diffId)
  const groups = surface.groups.map((g, i) => {
    if (i !== groupIdx) return g
    return { ...g, diffs: g.diffs.filter((_, j) => j !== diffIdx) }
  })
  return { ...surface, groups }
}

const mapDiff = (surface: Surface, diffId: string, fn: (d: Diff) => Diff): Surface => {
  const { groupIdx, diffIdx } = findDiffLocation(surface, diffId)
  const groups = surface.groups.map((g, i) => {
    if (i !== groupIdx) return g
    return {
      ...g,
      diffs: g.diffs.map((d, j) => (j === diffIdx ? fn(d) : d)),
    }
  })
  return { ...surface, groups }
}

export interface AnnotationAddOp {
  diffId: string
  id: string
  kind: AnnotationKind
  title: string
  body: string
  lineRange: [number, number]
}

export const annotationAdd = (surface: Surface, op: AnnotationAddOp): Surface => {
  return mapDiff(surface, op.diffId, diff => {
    if (diff.annotations.some(a => a.id === op.id)) {
      throw new Error(`annotation "${op.id}" already exists on diff "${op.diffId}"`)
    }
    const fresh: Annotation = {
      id: op.id,
      kind: op.kind,
      title: op.title,
      body: op.body,
      lineRange: op.lineRange,
    }
    return { ...diff, annotations: [...diff.annotations, fresh] }
  })
}

export const annotationDrop = (surface: Surface, diffId: string, annotationId: string): Surface => {
  return mapDiff(surface, diffId, diff => {
    const idx = diff.annotations.findIndex(a => a.id === annotationId)
    if (idx < 0) throw new Error(`annotation "${annotationId}" not found on diff "${diffId}"`)
    return { ...diff, annotations: diff.annotations.filter((_, i) => i !== idx) }
  })
}

export interface SuggestionAddOp {
  diffId: string
  id: string
  body: string
  lineRange: [number, number]
  suggestionCode?: string
}

export const suggestionAdd = (surface: Surface, op: SuggestionAddOp): Surface => {
  return mapDiff(surface, op.diffId, diff => {
    if (diff.suggestions.some(s => s.id === op.id)) {
      throw new Error(`suggestion "${op.id}" already exists on diff "${op.diffId}"`)
    }
    const fresh: Suggestion = {
      id: op.id,
      body: op.body,
      lineRange: op.lineRange,
      ...(op.suggestionCode != null ? { suggestionCode: op.suggestionCode } : {}),
    }
    return { ...diff, suggestions: [...diff.suggestions, fresh] }
  })
}

export const suggestionDrop = (surface: Surface, diffId: string, suggestionId: string): Surface => {
  return mapDiff(surface, diffId, diff => {
    const idx = diff.suggestions.findIndex(s => s.id === suggestionId)
    if (idx < 0) throw new Error(`suggestion "${suggestionId}" not found on diff "${diffId}"`)
    return { ...diff, suggestions: diff.suggestions.filter((_, i) => i !== idx) }
  })
}

export interface DiagramAddOp {
  id: string
  title?: string
  source: string
  groupId?: string  // undefined → surface-level diagram
}

const isDuplicateDiagramId = (existing: MermaidDiagram[] | undefined, id: string): boolean => {
  return (existing ?? []).some(d => d.id === id)
}

export const diagramAdd = (surface: Surface, op: DiagramAddOp): Surface => {
  const fresh: MermaidDiagram = {
    id: op.id,
    source: op.source,
    ...(op.title != null ? { title: op.title } : {}),
  }

  if (op.groupId == null) {
    if (isDuplicateDiagramId(surface.diagrams, op.id)) {
      throw new Error(`diagram "${op.id}" already exists at surface level`)
    }
    return { ...surface, diagrams: [...(surface.diagrams ?? []), fresh] }
  }

  const idx = surface.groups.findIndex(g => g.id === op.groupId)
  if (idx < 0) throw new Error(`group "${op.groupId}" not found`)

  const group = surface.groups[idx]!
  if (isDuplicateDiagramId(group.diagrams, op.id)) {
    throw new Error(`diagram "${op.id}" already exists on group "${op.groupId}"`)
  }

  const groups = surface.groups.map((g, i) => {
    if (i !== idx) return g
    return { ...g, diagrams: [...(g.diagrams ?? []), fresh] }
  })

  return { ...surface, groups }
}

export const diagramDrop = (surface: Surface, diagramId: string, groupId?: string): Surface => {
  if (groupId == null) {
    const existing = surface.diagrams ?? []
    const idx = existing.findIndex(d => d.id === diagramId)
    if (idx < 0) throw new Error(`diagram "${diagramId}" not found at surface level`)
    return { ...surface, diagrams: existing.filter((_, i) => i !== idx) }
  }

  const gIdx = surface.groups.findIndex(g => g.id === groupId)
  if (gIdx < 0) throw new Error(`group "${groupId}" not found`)

  const group = surface.groups[gIdx]!
  const existing = group.diagrams ?? []
  const idx = existing.findIndex(d => d.id === diagramId)
  if (idx < 0) throw new Error(`diagram "${diagramId}" not found on group "${groupId}"`)

  const groups = surface.groups.map((g, i) => {
    if (i !== gIdx) return g
    return { ...g, diagrams: existing.filter((_, j) => j !== idx) }
  })

  return { ...surface, groups }
}
