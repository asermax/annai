import { loadAndMutate } from '../../shared/surface-io.ts'
import { diagramUpdate } from '../../shared/surface-mutators.ts'
import { emitResult, wantsHelp } from '../output.ts'
import {
  extractOutputMode,
  optionalBool,
  optionalStr,
  parseFlags,
  readFileArg,
  requireStr,
  surfacePathOrDefault,
  withOutputFlags,
} from './args.ts'
import { validateMermaidSourceOrThrow } from './mermaid-validate.ts'

const USAGE = `usage: annai.sh surface diagram-update --id <id> [--group <group-id>] [--title <t> | --clear-title] [--source-file <f>] [--skip-validate] [--surface <p>] [--json | --quiet]

Updates fields on an existing mermaid diagram. Provide at least one of --title, --source-file, --clear-title.
Omit --group to target a surface-level diagram. --source-file is parsed with the bundled mermaid renderer unless --skip-validate is set.
`

export const runDiagramUpdate = async (argv: string[]): Promise<void> => {
  if (wantsHelp(argv)) { process.stdout.write(USAGE); return }

  const cmd = 'surface diagram-update'
  const parsed = parseFlags(cmd, argv, withOutputFlags({
    surface: 'value',
    id: 'value',
    group: 'value',
    title: 'value',
    'source-file': 'value',
    'clear-title': 'flag',
    'skip-validate': 'flag',
  }))

  const id = requireStr(cmd, parsed, 'id')
  const groupId = optionalStr(parsed, 'group')
  const title = optionalStr(parsed, 'title')
  const clearTitle = optionalBool(parsed, 'clear-title')
  const source = readFileArg(cmd, parsed, 'source-file', false)
  const skipValidate = optionalBool(parsed, 'skip-validate')

  if (source != null && !skipValidate) {
    await validateMermaidSourceOrThrow(cmd, source)
  }

  const surfacePath = surfacePathOrDefault(parsed)
  loadAndMutate(surfacePath, surface =>
    diagramUpdate(surface, { id, groupId, title, source, clearTitle }),
  )

  const changed = [
    title != null ? 'title' : null,
    clearTitle ? 'title cleared' : null,
    source != null ? 'source' : null,
  ].filter(Boolean).join(', ')

  emitResult({
    op: 'diagram-update',
    surface: surfacePath,
    text: `diagram "${id}"${groupId != null ? ` on group "${groupId}"` : ''} updated (${changed})`,
    data: { id, groupId, fields: { title, titleCleared: clearTitle, sourceUpdated: source != null } },
  }, extractOutputMode(parsed))
}
