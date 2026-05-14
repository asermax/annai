import { readFileSync, renameSync, writeFileSync } from 'node:fs'

import { surfaceSchema, type Surface } from './surface.ts'

export const readSurface = (path: string): Surface => {
  const raw = readFileSync(path, 'utf8')
  return surfaceSchema.parse(JSON.parse(raw))
}

export const writeSurface = (path: string, surface: Surface): void => {
  // Re-validate before writing so we never persist a malformed surface.
  surfaceSchema.parse(surface)

  // Atomic write: serialize, write to a temp sibling, then rename onto
  // the target so a partially-written file can never replace a good one.
  const json = JSON.stringify(surface, null, 2) + '\n'
  const tmp = `${path}.tmp`
  writeFileSync(tmp, json, 'utf8')
  renameSync(tmp, path)
}

export const loadAndMutate = (path: string, fn: (surface: Surface) => Surface): void => {
  const surface = readSurface(path)
  const next = fn(surface)
  writeSurface(path, next)
}
