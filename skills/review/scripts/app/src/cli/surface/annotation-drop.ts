import { loadAndMutate } from '../../shared/surface-io.ts'
import { annotationDrop } from '../../shared/surface-mutators.ts'
import { emitResult, wantsHelp } from '../output.ts'
import {
  extractOutputMode,
  parseFlags,
  requireStr,
  surfacePathOrDefault,
  withOutputFlags,
} from './args.ts'

const USAGE = `usage: annai.sh surface annotation-drop --diff <id> --id <ann-id> [--surface <p>] [--json | --quiet]
`

export const runAnnotationDrop = async (argv: string[]): Promise<void> => {
  if (wantsHelp(argv)) { process.stdout.write(USAGE); return }

  const cmd = 'surface annotation-drop'
  const parsed = parseFlags(cmd, argv, withOutputFlags({
    surface: 'value',
    diff: 'value',
    id: 'value',
  }))

  const diffId = requireStr(cmd, parsed, 'diff')
  const id = requireStr(cmd, parsed, 'id')

  const surfacePath = surfacePathOrDefault(parsed)
  loadAndMutate(surfacePath, surface => annotationDrop(surface, diffId, id))

  emitResult({
    op: 'annotation-drop',
    surface: surfacePath,
    text: `annotation "${id}" dropped from "${diffId}"`,
    data: { diffId, id },
  }, extractOutputMode(parsed))
}
