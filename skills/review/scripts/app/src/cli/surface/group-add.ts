import { loadAndMutate } from '../../shared/surface-io.ts'
import { groupAdd } from '../../shared/surface-mutators.ts'
import { emitResult, wantsHelp } from '../output.ts'
import {
  extractOutputMode,
  parseFlags,
  readFileArg,
  requireGroupKind,
  requireStr,
  optionalStr,
  surfacePathOrDefault,
  withOutputFlags,
} from './args.ts'

const USAGE = `usage: annai.sh surface group-add --id <id> --kind <k> --title <t> [--intro-file <f>] [--before <id> | --after <id>] [--surface <p>] [--json | --quiet]

Appends a new group. --before / --after control ordering; omit both to append at the end.
`

export const runGroupAdd = async (argv: string[]): Promise<void> => {
  if (wantsHelp(argv)) { process.stdout.write(USAGE); return }

  const cmd = 'surface group-add'
  const parsed = parseFlags(cmd, argv, withOutputFlags({
    surface: 'value',
    id: 'value',
    kind: 'value',
    title: 'value',
    'intro-file': 'value',
    before: 'value',
    after: 'value',
  }))

  if (parsed.before != null && parsed.after != null) {
    throw new Error(`${cmd}: pick one of --before or --after, not both`)
  }

  const id = requireStr(cmd, parsed, 'id')
  const kind = requireGroupKind(cmd, requireStr(cmd, parsed, 'kind'))
  const title = requireStr(cmd, parsed, 'title')
  const intro = readFileArg(cmd, parsed, 'intro-file', false)
  const before = optionalStr(parsed, 'before')
  const after = optionalStr(parsed, 'after')

  const surfacePath = surfacePathOrDefault(parsed)
  loadAndMutate(surfacePath, surface =>
    groupAdd(surface, { id, kind, title, intro, before, after }),
  )

  emitResult({
    op: 'group-add',
    surface: surfacePath,
    text: `group "${id}" added (${kind})`,
    data: { id, kind, title, before, after },
  }, extractOutputMode(parsed))
}
