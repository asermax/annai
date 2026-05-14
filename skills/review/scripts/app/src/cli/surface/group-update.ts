import { loadAndMutate } from '../../shared/surface-io.ts'
import { groupUpdate } from '../../shared/surface-mutators.ts'
import { emitResult, wantsHelp } from '../output.ts'
import {
  extractOutputMode,
  optionalStr,
  parseFlags,
  readFileArg,
  requireGroupKind,
  requireStr,
  surfacePathOrDefault,
  withOutputFlags,
} from './args.ts'

const USAGE = `usage: annai.sh surface group-update --id <id> [--kind <k>] [--title <t>] [--intro-file <f>] [--surface <p>] [--json | --quiet]

Updates fields on an existing group. Provide at least one of --kind, --title, --intro-file.
`

export const runGroupUpdate = async (argv: string[]): Promise<void> => {
  if (wantsHelp(argv)) { process.stdout.write(USAGE); return }

  const cmd = 'surface group-update'
  const parsed = parseFlags(cmd, argv, withOutputFlags({
    surface: 'value',
    id: 'value',
    kind: 'value',
    title: 'value',
    'intro-file': 'value',
  }))

  const id = requireStr(cmd, parsed, 'id')
  const kindRaw = optionalStr(parsed, 'kind')
  const kind = kindRaw != null ? requireGroupKind(cmd, kindRaw) : undefined
  const title = optionalStr(parsed, 'title')
  const intro = readFileArg(cmd, parsed, 'intro-file', false)

  const surfacePath = surfacePathOrDefault(parsed)
  loadAndMutate(surfacePath, surface =>
    groupUpdate(surface, { id, kind, title, intro }),
  )

  const changed = [
    kind != null ? 'kind' : null,
    title != null ? 'title' : null,
    intro != null ? 'intro' : null,
  ].filter(Boolean).join(', ')

  emitResult({
    op: 'group-update',
    surface: surfacePath,
    text: `group "${id}" updated (${changed})`,
    data: { id, fields: { kind, title, introUpdated: intro != null } },
  }, extractOutputMode(parsed))
}
