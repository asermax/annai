import { loadAndMutate } from '../../shared/surface-io.ts'
import { suggestionAdd } from '../../shared/surface-mutators.ts'
import {
  parseFlags,
  parseLineRange,
  readFileArg,
  requireStr,
  surfacePathOrDefault,
} from './args.ts'

export const runSuggestionAdd = async (argv: string[]): Promise<void> => {
  const cmd = 'surface suggestion-add'
  const parsed = parseFlags(cmd, argv, {
    surface: 'value',
    diff: 'value',
    id: 'value',
    'body-file': 'value',
    'line-range': 'value',
    'code-file': 'value',
  })

  const diffId = requireStr(cmd, parsed, 'diff')
  const id = requireStr(cmd, parsed, 'id')
  const body = readFileArg(cmd, parsed, 'body-file', true)!
  const lineRange = parseLineRange(cmd, requireStr(cmd, parsed, 'line-range'))
  const suggestionCode = readFileArg(cmd, parsed, 'code-file', false)

  loadAndMutate(surfacePathOrDefault(parsed), surface =>
    suggestionAdd(surface, { diffId, id, body, lineRange, suggestionCode }),
  )
}
