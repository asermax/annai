import { loadAndMutate } from '../../shared/surface-io.ts'
import { diagramAdd } from '../../shared/surface-mutators.ts'
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

const USAGE = `usage: annai.sh surface diagram-add --id <id> --source-file <f> [--title <t>] [--group <group-id>] [--skip-validate] [--surface <p>] [--json | --quiet]

Appends a mermaid diagram. Omit --group for surface-level; pass it to attach to a group.
The source is parsed with the bundled mermaid renderer; pass --skip-validate to bypass.
`

export const runDiagramAdd = async (argv: string[]): Promise<void> => {
  if (wantsHelp(argv)) { process.stdout.write(USAGE); return }

  const cmd = 'surface diagram-add'
  const parsed = parseFlags(cmd, argv, withOutputFlags({
    surface: 'value',
    id: 'value',
    title: 'value',
    'source-file': 'value',
    group: 'value',
    'skip-validate': 'flag',
  }))

  const id = requireStr(cmd, parsed, 'id')
  const title = optionalStr(parsed, 'title')
  const source = readFileArg(cmd, parsed, 'source-file', true)!
  const groupId = optionalStr(parsed, 'group')
  const skipValidate = optionalBool(parsed, 'skip-validate')

  if (!skipValidate) {
    await validateMermaidSourceOrThrow(cmd, source)
  }

  const surfacePath = surfacePathOrDefault(parsed)
  loadAndMutate(surfacePath, surface =>
    diagramAdd(surface, { id, title, source, groupId }),
  )

  emitResult({
    op: 'diagram-add',
    surface: surfacePath,
    text: `diagram "${id}" added${groupId != null ? ` to group "${groupId}"` : ' at surface level'}`,
    data: { id, groupId, title },
  }, extractOutputMode(parsed))
}
