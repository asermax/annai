import { loadAndMutate } from '../../shared/surface-io.ts'
import { annotationUpdate } from '../../shared/surface-mutators.ts'
import { emitResult, wantsHelp } from '../output.ts'
import {
  extractOutputMode,
  optionalStr,
  parseFlags,
  parseLineRange,
  readFileArg,
  requireAnnotationKind,
  requireStr,
  surfacePathOrDefault,
  withOutputFlags,
} from './args.ts'

const USAGE = `usage: annai.sh surface annotation-update --diff <id> --id <ann-id> [--kind <k>] [--title <t>] [--body-file <f>] [--line-range <s>,<e>] [--surface <p>] [--json | --quiet]

Updates fields on an existing annotation. Provide at least one of --kind, --title, --body-file, --line-range.
`

export const runAnnotationUpdate = async (argv: string[]): Promise<void> => {
  if (wantsHelp(argv)) { process.stdout.write(USAGE); return }

  const cmd = 'surface annotation-update'
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
  const kindRaw = optionalStr(parsed, 'kind')
  const kind = kindRaw != null ? requireAnnotationKind(cmd, kindRaw) : undefined
  const title = optionalStr(parsed, 'title')
  const body = readFileArg(cmd, parsed, 'body-file', false)
  const lineRangeRaw = optionalStr(parsed, 'line-range')
  const lineRange = lineRangeRaw != null ? parseLineRange(cmd, lineRangeRaw) : undefined

  const surfacePath = surfacePathOrDefault(parsed)
  loadAndMutate(surfacePath, surface =>
    annotationUpdate(surface, { diffId, id, kind, title, body, lineRange }),
  )

  const changed = [
    kind != null ? 'kind' : null,
    title != null ? 'title' : null,
    body != null ? 'body' : null,
    lineRange != null ? `lineRange [${lineRange[0]},${lineRange[1]}]` : null,
  ].filter(Boolean).join(', ')

  emitResult({
    op: 'annotation-update',
    surface: surfacePath,
    text: `annotation "${id}" on "${diffId}" updated (${changed})`,
    data: { diffId, id, fields: { kind, title, bodyUpdated: body != null, lineRange } },
  }, extractOutputMode(parsed))
}
