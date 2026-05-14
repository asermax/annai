import { loadAndMutate } from '../../shared/surface-io.ts'
import { diffMove } from '../../shared/surface-mutators.ts'
import { parseFlags, optionalStr, requireStr, surfacePathOrDefault } from './args.ts'

export const runDiffMove = async (argv: string[]): Promise<void> => {
  const cmd = 'surface diff-move'
  const parsed = parseFlags(cmd, argv, {
    surface: 'value',
    diff: 'value',
    'to-group': 'value',
    position: 'value',
  })

  const diffId = requireStr(cmd, parsed, 'diff')
  const toGroup = requireStr(cmd, parsed, 'to-group')

  const positionStr = optionalStr(parsed, 'position')
  let position: number | undefined
  if (positionStr != null) {
    position = parseInt(positionStr, 10)
    if (!Number.isFinite(position) || position < 0) {
      throw new Error(`${cmd}: --position must be a non-negative integer, got "${positionStr}"`)
    }
  }

  loadAndMutate(surfacePathOrDefault(parsed), surface =>
    diffMove(surface, { diffId, toGroup, position }),
  )
}
