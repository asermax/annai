import { loadAndMutate } from '../../shared/surface-io.ts'
import { groupDrop } from '../../shared/surface-mutators.ts'
import { parseFlags, requireStr, surfacePathOrDefault } from './args.ts'

export const runGroupDrop = async (argv: string[]): Promise<void> => {
  const cmd = 'surface group-drop'
  const parsed = parseFlags(cmd, argv, { surface: 'value', id: 'value' })
  const id = requireStr(cmd, parsed, 'id')
  loadAndMutate(surfacePathOrDefault(parsed), surface => groupDrop(surface, id))
}
