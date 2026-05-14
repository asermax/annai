import { readFileSync } from 'node:fs'

import {
  ANNOTATION_KINDS,
  GROUP_KINDS,
  type AnnotationKind,
  type GroupKind,
} from '../../shared/surface.ts'
import type { OutputMode } from '../output.ts'

export type ArgSpec = Record<string, 'value' | 'flag'>

export type ParsedArgs = Record<string, string | boolean | undefined>

// Generic flag/value argv parser. Each key in `spec` is the flag name
// without the leading `--`; value-kind flags consume the next argv slot.
// Throws on unknown flags so the agent finds typos quickly.
export const parseFlags = (cmd: string, argv: string[], spec: ArgSpec): ParsedArgs => {
  const out: ParsedArgs = {}

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg == null || !arg.startsWith('--')) {
      throw new Error(`${cmd}: unexpected positional "${arg}"`)
    }

    const name = arg.slice(2)
    const kind = spec[name]
    if (kind == null) {
      throw new Error(`${cmd}: unknown argument "${arg}"`)
    }

    if (kind === 'flag') {
      out[name] = true
      continue
    }

    if (i + 1 >= argv.length) {
      throw new Error(`${cmd}: ${arg} requires a value`)
    }
    out[name] = argv[i + 1]
    i++
  }

  return out
}

export const requireStr = (cmd: string, parsed: ParsedArgs, name: string): string => {
  const value = parsed[name]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${cmd}: --${name} <value> is required`)
  }
  return value
}

export const optionalStr = (parsed: ParsedArgs, name: string): string | undefined => {
  const value = parsed[name]
  return typeof value === 'string' ? value : undefined
}

export const readFileArg = (cmd: string, parsed: ParsedArgs, name: string, required: boolean): string | undefined => {
  const path = parsed[name]
  if (path == null) {
    if (required) throw new Error(`${cmd}: --${name} <path> is required`)
    return undefined
  }
  if (typeof path !== 'string') throw new Error(`${cmd}: --${name} expects a path`)
  return readFileSync(path, 'utf8')
}

export const parseLineRange = (cmd: string, raw: string): [number, number] => {
  const m = /^(\d+),(\d+)$/.exec(raw)
  if (m == null) throw new Error(`${cmd}: --line-range expects "<start>,<end>", got "${raw}"`)
  const start = parseInt(m[1]!, 10)
  const end = parseInt(m[2]!, 10)
  if (start < 0 || end < 0) throw new Error(`${cmd}: --line-range values must be non-negative`)
  return [start, end]
}

export const requireGroupKind = (cmd: string, raw: string): GroupKind => {
  if (!(raw in GROUP_KINDS)) {
    throw new Error(`${cmd}: --kind must be one of ${Object.keys(GROUP_KINDS).join(' | ')}, got "${raw}"`)
  }
  return raw as GroupKind
}

export const requireAnnotationKind = (cmd: string, raw: string): AnnotationKind => {
  if (!(raw in ANNOTATION_KINDS)) {
    throw new Error(`${cmd}: --kind must be one of ${Object.keys(ANNOTATION_KINDS).join(' | ')}, got "${raw}"`)
  }
  return raw as AnnotationKind
}

export const surfacePathOrDefault = (parsed: ParsedArgs): string => {
  return optionalStr(parsed, 'surface') ?? 'surface.json'
}

export const optionalBool = (parsed: ParsedArgs, name: string): boolean => {
  return parsed[name] === true
}

// Add the standard --json / --quiet flag pair to a spec. Callers spread the
// return value into their spec literal so output-mode handling stays uniform.
export const withOutputFlags = (spec: ArgSpec): ArgSpec => ({
  ...spec,
  json: 'flag',
  quiet: 'flag',
})

export const extractOutputMode = (parsed: ParsedArgs): OutputMode => ({
  json: optionalBool(parsed, 'json'),
  quiet: optionalBool(parsed, 'quiet'),
})
