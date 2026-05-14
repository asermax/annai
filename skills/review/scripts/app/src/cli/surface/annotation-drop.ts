import { loadAndMutate } from '../../shared/surface-io.ts'
import { annotationDrop } from '../../shared/surface-mutators.ts'
import { parseFlags, requireStr, surfacePathOrDefault } from './args.ts'

export const runAnnotationDrop = async (argv: string[]): Promise<void> => {
  const cmd = 'surface annotation-drop'
  const parsed = parseFlags(cmd, argv, {
    surface: 'value',
    diff: 'value',
    id: 'value',
  })

  const diffId = requireStr(cmd, parsed, 'diff')
  const id = requireStr(cmd, parsed, 'id')

  loadAndMutate(surfacePathOrDefault(parsed), surface => annotationDrop(surface, diffId, id))
}
