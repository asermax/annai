import { loadAndMutate } from '../../shared/surface-io.ts'
import { diagramDrop } from '../../shared/surface-mutators.ts'
import { optionalStr, parseFlags, requireStr, surfacePathOrDefault } from './args.ts'

export const runDiagramDrop = async (argv: string[]): Promise<void> => {
  const cmd = 'surface diagram-drop'
  const parsed = parseFlags(cmd, argv, {
    surface: 'value',
    id: 'value',
    group: 'value',
  })

  const id = requireStr(cmd, parsed, 'id')
  const groupId = optionalStr(parsed, 'group')

  loadAndMutate(surfacePathOrDefault(parsed), surface => diagramDrop(surface, id, groupId))
}
