import { loadAndMutate } from '../../shared/surface-io.ts'
import { suggestionAdd } from '../../shared/surface-mutators.ts'
import { emitResult, wantsHelp } from '../output.ts'
import {
  extractOutputMode,
  parseFlags,
  parseLineRange,
  readFileArg,
  requireStr,
  surfacePathOrDefault,
  withOutputFlags,
} from './args.ts'

const USAGE = `usage: annai.sh surface suggestion-add --diff <id> --id <s-id> --body-file <f> --line-range <s>,<e> [--code-file <f>] [--surface <p>] [--json | --quiet]

Appends an inline PR-suggestion draft (renders Accept-as-draft in the browser).
`

export const runSuggestionAdd = async (argv: string[]): Promise<void> => {
  if (wantsHelp(argv)) { process.stdout.write(USAGE); return }

  const cmd = 'surface suggestion-add'
  const parsed = parseFlags(cmd, argv, withOutputFlags({
    surface: 'value',
    diff: 'value',
    id: 'value',
    'body-file': 'value',
    'line-range': 'value',
    'code-file': 'value',
  }))

  const diffId = requireStr(cmd, parsed, 'diff')
  const id = requireStr(cmd, parsed, 'id')
  const body = readFileArg(cmd, parsed, 'body-file', true)!
  const lineRange = parseLineRange(cmd, requireStr(cmd, parsed, 'line-range'))
  const suggestionCode = readFileArg(cmd, parsed, 'code-file', false)

  const surfacePath = surfacePathOrDefault(parsed)
  loadAndMutate(surfacePath, surface =>
    suggestionAdd(surface, { diffId, id, body, lineRange, suggestionCode }),
  )

  emitResult({
    op: 'suggestion-add',
    surface: surfacePath,
    text: `suggestion "${id}" added to "${diffId}" at L${lineRange[0]}–${lineRange[1]}${suggestionCode != null ? ' (with code)' : ''}`,
    data: { diffId, id, lineRange, hasCode: suggestionCode != null },
  }, extractOutputMode(parsed))
}
