import { loadAndMutate } from '../../shared/surface-io.ts'
import { groupDrop } from '../../shared/surface-mutators.ts'
import { emitResult, wantsHelp } from '../output.ts'
import {
  extractOutputMode,
  parseFlags,
  requireStr,
  surfacePathOrDefault,
  withOutputFlags,
} from './args.ts'

const USAGE = `usage: annai.sh surface group-drop --id <id> [--surface <p>] [--json | --quiet]

Removes an empty group. Refuses if the group still owns diffs.
`

export const runGroupDrop = async (argv: string[]): Promise<void> => {
  if (wantsHelp(argv)) { process.stdout.write(USAGE); return }

  const cmd = 'surface group-drop'
  const parsed = parseFlags(cmd, argv, withOutputFlags({ surface: 'value', id: 'value' }))
  const id = requireStr(cmd, parsed, 'id')

  const surfacePath = surfacePathOrDefault(parsed)
  loadAndMutate(surfacePath, surface => groupDrop(surface, id))

  emitResult({
    op: 'group-drop',
    surface: surfacePath,
    text: `group "${id}" dropped`,
    data: { id },
  }, extractOutputMode(parsed))
}
