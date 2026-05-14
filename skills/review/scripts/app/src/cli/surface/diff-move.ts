import { loadAndMutate } from '../../shared/surface-io.ts'
import { diffMove } from '../../shared/surface-mutators.ts'
import { emitResult, wantsHelp } from '../output.ts'
import {
  extractOutputMode,
  optionalStr,
  parseFlags,
  requireStr,
  surfacePathOrDefault,
  withOutputFlags,
} from './args.ts'

const USAGE = `usage: annai.sh surface diff-move --diff <id> --to-group <id> [--position <n>] [--surface <p>] [--json | --quiet]

Moves a file diff between groups. Omit --position to append at the destination.
`

export const runDiffMove = async (argv: string[]): Promise<void> => {
  if (wantsHelp(argv)) { process.stdout.write(USAGE); return }

  const cmd = 'surface diff-move'
  const parsed = parseFlags(cmd, argv, withOutputFlags({
    surface: 'value',
    diff: 'value',
    'to-group': 'value',
    position: 'value',
  }))

  const diffId = requireStr(cmd, parsed, 'diff')
  const toGroup = requireStr(cmd, parsed, 'to-group')

  const positionStr = optionalStr(parsed, 'position')
  let position: number | undefined
  if (positionStr != null) {
    position = parseInt(positionStr, 10)
    if (!Number.isFinite(position) || position < 0) {
      throw new Error(`${cmd}: --position must be a non-negative integer, got "${positionStr}"`)
    }
  }

  const surfacePath = surfacePathOrDefault(parsed)
  loadAndMutate(surfacePath, surface => diffMove(surface, { diffId, toGroup, position }))

  emitResult({
    op: 'diff-move',
    surface: surfacePath,
    text: `diff "${diffId}" moved to group "${toGroup}"${position != null ? ` (position ${position})` : ''}`,
    data: { diffId, toGroup, position },
  }, extractOutputMode(parsed))
}
