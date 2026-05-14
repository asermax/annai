import { loadAndMutate } from '../../shared/surface-io.ts'
import { suggestionUpdate } from '../../shared/surface-mutators.ts'
import { emitResult, wantsHelp } from '../output.ts'
import {
  extractOutputMode,
  optionalBool,
  optionalStr,
  parseFlags,
  parseLineRange,
  readFileArg,
  requireStr,
  surfacePathOrDefault,
  withOutputFlags,
} from './args.ts'

const USAGE = `usage: annai.sh surface suggestion-update --diff <id> --id <s-id> [--body-file <f>] [--line-range <s>,<e>] [--code-file <f> | --clear-code] [--surface <p>] [--json | --quiet]

Updates fields on an existing suggestion. Provide at least one of --body-file, --line-range, --code-file, --clear-code.
`

export const runSuggestionUpdate = async (argv: string[]): Promise<void> => {
  if (wantsHelp(argv)) { process.stdout.write(USAGE); return }

  const cmd = 'surface suggestion-update'
  const parsed = parseFlags(cmd, argv, withOutputFlags({
    surface: 'value',
    diff: 'value',
    id: 'value',
    'body-file': 'value',
    'line-range': 'value',
    'code-file': 'value',
    'clear-code': 'flag',
  }))

  const diffId = requireStr(cmd, parsed, 'diff')
  const id = requireStr(cmd, parsed, 'id')
  const body = readFileArg(cmd, parsed, 'body-file', false)
  const lineRangeRaw = optionalStr(parsed, 'line-range')
  const lineRange = lineRangeRaw != null ? parseLineRange(cmd, lineRangeRaw) : undefined
  const suggestionCode = readFileArg(cmd, parsed, 'code-file', false)
  const clearSuggestionCode = optionalBool(parsed, 'clear-code')

  const surfacePath = surfacePathOrDefault(parsed)
  loadAndMutate(surfacePath, surface =>
    suggestionUpdate(surface, { diffId, id, body, lineRange, suggestionCode, clearSuggestionCode }),
  )

  const changed = [
    body != null ? 'body' : null,
    lineRange != null ? `lineRange [${lineRange[0]},${lineRange[1]}]` : null,
    suggestionCode != null ? 'code' : null,
    clearSuggestionCode ? 'code cleared' : null,
  ].filter(Boolean).join(', ')

  emitResult({
    op: 'suggestion-update',
    surface: surfacePath,
    text: `suggestion "${id}" on "${diffId}" updated (${changed})`,
    data: {
      diffId, id,
      fields: { bodyUpdated: body != null, lineRange, codeUpdated: suggestionCode != null, codeCleared: clearSuggestionCode },
    },
  }, extractOutputMode(parsed))
}
