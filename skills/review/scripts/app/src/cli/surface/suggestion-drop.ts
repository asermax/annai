import { loadAndMutate } from '../../shared/surface-io.ts'
import { suggestionDrop } from '../../shared/surface-mutators.ts'
import { emitResult, wantsHelp } from '../output.ts'
import {
  extractOutputMode,
  parseFlags,
  requireStr,
  surfacePathOrDefault,
  withOutputFlags,
} from './args.ts'

const USAGE = `usage: annai.sh surface suggestion-drop --diff <id> --id <s-id> [--surface <p>] [--json | --quiet]
`

export const runSuggestionDrop = async (argv: string[]): Promise<void> => {
  if (wantsHelp(argv)) { process.stdout.write(USAGE); return }

  const cmd = 'surface suggestion-drop'
  const parsed = parseFlags(cmd, argv, withOutputFlags({
    surface: 'value',
    diff: 'value',
    id: 'value',
  }))

  const diffId = requireStr(cmd, parsed, 'diff')
  const id = requireStr(cmd, parsed, 'id')

  const surfacePath = surfacePathOrDefault(parsed)
  loadAndMutate(surfacePath, surface => suggestionDrop(surface, diffId, id))

  emitResult({
    op: 'suggestion-drop',
    surface: surfacePath,
    text: `suggestion "${id}" dropped from "${diffId}"`,
    data: { diffId, id },
  }, extractOutputMode(parsed))
}
