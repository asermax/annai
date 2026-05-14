import { loadAndMutate } from '../../shared/surface-io.ts'
import { annotationAdd } from '../../shared/surface-mutators.ts'
import { emitResult, wantsHelp } from '../output.ts'
import {
  extractOutputMode,
  parseFlags,
  parseLineRange,
  readFileArg,
  requireAnnotationKind,
  requireStr,
  surfacePathOrDefault,
  withOutputFlags,
} from './args.ts'

const USAGE = `usage: annai.sh surface annotation-add --diff <id> --id <ann-id> --kind <k> --title <t> --body-file <f> --line-range <s>,<e> [--surface <p>] [--json | --quiet]

Appends an annotation. --line-range uses new-file line numbers (the scaffold's hunk newLine values).
--kind ∈ pattern | note | question | surface-check | discrepancy.
`

export const runAnnotationAdd = async (argv: string[]): Promise<void> => {
  if (wantsHelp(argv)) { process.stdout.write(USAGE); return }

  const cmd = 'surface annotation-add'
  const parsed = parseFlags(cmd, argv, withOutputFlags({
    surface: 'value',
    diff: 'value',
    id: 'value',
    kind: 'value',
    title: 'value',
    'body-file': 'value',
    'line-range': 'value',
  }))

  const diffId = requireStr(cmd, parsed, 'diff')
  const id = requireStr(cmd, parsed, 'id')
  const kind = requireAnnotationKind(cmd, requireStr(cmd, parsed, 'kind'))
  const title = requireStr(cmd, parsed, 'title')
  const body = readFileArg(cmd, parsed, 'body-file', true)!
  const lineRange = parseLineRange(cmd, requireStr(cmd, parsed, 'line-range'))

  const surfacePath = surfacePathOrDefault(parsed)
  loadAndMutate(surfacePath, surface =>
    annotationAdd(surface, { diffId, id, kind, title, body, lineRange }),
  )

  emitResult({
    op: 'annotation-add',
    surface: surfacePath,
    text: `annotation "${id}" added to "${diffId}" at L${lineRange[0]}–${lineRange[1]} (${kind})`,
    data: { diffId, id, kind, lineRange },
  }, extractOutputMode(parsed))
}
