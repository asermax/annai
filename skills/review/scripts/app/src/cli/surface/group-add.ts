import { loadAndMutate } from '../../shared/surface-io.ts'
import { groupAdd } from '../../shared/surface-mutators.ts'
import {
  parseFlags,
  readFileArg,
  requireGroupKind,
  requireStr,
  optionalStr,
  surfacePathOrDefault,
} from './args.ts'

export const runGroupAdd = async (argv: string[]): Promise<void> => {
  const cmd = 'surface group-add'
  const parsed = parseFlags(cmd, argv, {
    surface: 'value',
    id: 'value',
    kind: 'value',
    title: 'value',
    'intro-file': 'value',
    before: 'value',
    after: 'value',
  })

  if (parsed.before != null && parsed.after != null) {
    throw new Error(`${cmd}: pick one of --before or --after, not both`)
  }

  const id = requireStr(cmd, parsed, 'id')
  const kind = requireGroupKind(cmd, requireStr(cmd, parsed, 'kind'))
  const title = requireStr(cmd, parsed, 'title')
  const intro = readFileArg(cmd, parsed, 'intro-file', false)
  const before = optionalStr(parsed, 'before')
  const after = optionalStr(parsed, 'after')

  loadAndMutate(surfacePathOrDefault(parsed), surface =>
    groupAdd(surface, { id, kind, title, intro, before, after }),
  )
}
