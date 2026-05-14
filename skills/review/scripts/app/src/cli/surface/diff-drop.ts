import { loadAndMutate } from '../../shared/surface-io.ts'
import { diffDrop } from '../../shared/surface-mutators.ts'
import { emitResult, wantsHelp } from '../output.ts'
import {
  extractOutputMode,
  parseFlags,
  requireStr,
  surfacePathOrDefault,
  withOutputFlags,
} from './args.ts'

const USAGE = `usage: annai.sh surface diff-drop --diff <id> [--surface <p>] [--json | --quiet]

Removes a file diff from the surface entirely (lockfile churn, etc.).
`

export const runDiffDrop = async (argv: string[]): Promise<void> => {
  if (wantsHelp(argv)) { process.stdout.write(USAGE); return }

  const cmd = 'surface diff-drop'
  const parsed = parseFlags(cmd, argv, withOutputFlags({ surface: 'value', diff: 'value' }))
  const diffId = requireStr(cmd, parsed, 'diff')

  const surfacePath = surfacePathOrDefault(parsed)
  loadAndMutate(surfacePath, surface => diffDrop(surface, diffId))

  emitResult({
    op: 'diff-drop',
    surface: surfacePath,
    text: `diff "${diffId}" dropped`,
    data: { diffId },
  }, extractOutputMode(parsed))
}
