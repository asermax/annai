import { loadAndMutate } from '../../shared/surface-io.ts'
import { diffDrop } from '../../shared/surface-mutators.ts'
import { parseFlags, requireStr, surfacePathOrDefault } from './args.ts'

export const runDiffDrop = async (argv: string[]): Promise<void> => {
  const cmd = 'surface diff-drop'
  const parsed = parseFlags(cmd, argv, { surface: 'value', diff: 'value' })
  const diffId = requireStr(cmd, parsed, 'diff')
  loadAndMutate(surfacePathOrDefault(parsed), surface => diffDrop(surface, diffId))
}
