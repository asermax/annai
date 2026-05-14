import { loadAndMutate } from '../../shared/surface-io.ts'
import { suggestionDrop } from '../../shared/surface-mutators.ts'
import { parseFlags, requireStr, surfacePathOrDefault } from './args.ts'

export const runSuggestionDrop = async (argv: string[]): Promise<void> => {
  const cmd = 'surface suggestion-drop'
  const parsed = parseFlags(cmd, argv, {
    surface: 'value',
    diff: 'value',
    id: 'value',
  })

  const diffId = requireStr(cmd, parsed, 'diff')
  const id = requireStr(cmd, parsed, 'id')

  loadAndMutate(surfacePathOrDefault(parsed), surface => suggestionDrop(surface, diffId, id))
}
