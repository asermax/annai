import { readFileSync } from 'node:fs'

import { loadAndMutate } from '../../shared/surface-io.ts'
import { setReviewPrompts } from '../../shared/surface-mutators.ts'
import { emitResult, wantsHelp } from '../output.ts'
import {
  extractOutputMode,
  optionalStr,
  parseFlags,
  surfacePathOrDefault,
  withOutputFlags,
} from './args.ts'

const USAGE = `usage: annai.sh surface set-review-prompts (--file <f> | --json-file <f>) [--surface <p>] [--json | --quiet]

Replaces the surface reviewPrompts array.
  --file       one prompt per line (blank lines ignored).
  --json-file  a JSON array of strings.
`

const readPromptsFromFile = (cmd: string, path: string): string[] => {
  const raw = readFileSync(path, 'utf8')
  return raw.split('\n').map(s => s.trim()).filter(s => s.length > 0)
}

const readPromptsFromJson = (cmd: string, path: string): string[] => {
  const raw = readFileSync(path, 'utf8')
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new Error(`${cmd}: --json-file did not parse as JSON: ${(err as Error).message}`)
  }
  if (!Array.isArray(parsed) || parsed.some(x => typeof x !== 'string')) {
    throw new Error(`${cmd}: --json-file must contain a JSON array of strings`)
  }
  return parsed as string[]
}

export const runSetReviewPrompts = async (argv: string[]): Promise<void> => {
  if (wantsHelp(argv)) { process.stdout.write(USAGE); return }

  const cmd = 'surface set-review-prompts'
  const parsed = parseFlags(cmd, argv, withOutputFlags({
    surface: 'value',
    file: 'value',
    'json-file': 'value',
  }))

  const file = optionalStr(parsed, 'file')
  const jsonFile = optionalStr(parsed, 'json-file')
  if (file != null && jsonFile != null) {
    throw new Error(`${cmd}: pick one of --file or --json-file`)
  }

  const prompts = file != null
    ? readPromptsFromFile(cmd, file)
    : jsonFile != null
      ? readPromptsFromJson(cmd, jsonFile)
      : null
  if (prompts == null) {
    throw new Error(`${cmd}: pass --file <path> or --json-file <path>`)
  }

  const surfacePath = surfacePathOrDefault(parsed)
  loadAndMutate(surfacePath, surface => setReviewPrompts(surface, prompts))

  emitResult({
    op: 'set-review-prompts',
    surface: surfacePath,
    text: `reviewPrompts updated (${prompts.length} prompt${prompts.length === 1 ? '' : 's'})`,
    data: { count: prompts.length },
  }, extractOutputMode(parsed))
}
