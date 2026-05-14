import { loadAndMutate } from '../../shared/surface-io.ts'
import { diagramAdd } from '../../shared/surface-mutators.ts'
import {
  optionalStr,
  parseFlags,
  readFileArg,
  requireStr,
  surfacePathOrDefault,
} from './args.ts'

export const runDiagramAdd = async (argv: string[]): Promise<void> => {
  const cmd = 'surface diagram-add'
  const parsed = parseFlags(cmd, argv, {
    surface: 'value',
    id: 'value',
    title: 'value',
    'source-file': 'value',
    group: 'value',
  })

  const id = requireStr(cmd, parsed, 'id')
  const title = optionalStr(parsed, 'title')
  const source = readFileArg(cmd, parsed, 'source-file', true)!
  const groupId = optionalStr(parsed, 'group')

  loadAndMutate(surfacePathOrDefault(parsed), surface =>
    diagramAdd(surface, { id, title, source, groupId }),
  )
}
