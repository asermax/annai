import { loadAndMutate } from '../../shared/surface-io.ts'
import { diagramDrop } from '../../shared/surface-mutators.ts'
import { emitResult, wantsHelp } from '../output.ts'
import {
  extractOutputMode,
  optionalStr,
  parseFlags,
  requireStr,
  surfacePathOrDefault,
  withOutputFlags,
} from './args.ts'

const USAGE = `usage: annai.sh surface diagram-drop --id <id> [--group <group-id>] [--surface <p>] [--json | --quiet]
`

export const runDiagramDrop = async (argv: string[]): Promise<void> => {
  if (wantsHelp(argv)) { process.stdout.write(USAGE); return }

  const cmd = 'surface diagram-drop'
  const parsed = parseFlags(cmd, argv, withOutputFlags({
    surface: 'value',
    id: 'value',
    group: 'value',
  }))

  const id = requireStr(cmd, parsed, 'id')
  const groupId = optionalStr(parsed, 'group')

  const surfacePath = surfacePathOrDefault(parsed)
  loadAndMutate(surfacePath, surface => diagramDrop(surface, id, groupId))

  emitResult({
    op: 'diagram-drop',
    surface: surfacePath,
    text: `diagram "${id}" dropped${groupId != null ? ` from group "${groupId}"` : ''}`,
    data: { id, groupId },
  }, extractOutputMode(parsed))
}
