import { loadAndMutate } from '../../shared/surface-io.ts'
import { annotationAdd } from '../../shared/surface-mutators.ts'
import {
  parseFlags,
  parseLineRange,
  readFileArg,
  requireAnnotationKind,
  requireStr,
  surfacePathOrDefault,
} from './args.ts'

export const runAnnotationAdd = async (argv: string[]): Promise<void> => {
  const cmd = 'surface annotation-add'
  const parsed = parseFlags(cmd, argv, {
    surface: 'value',
    diff: 'value',
    id: 'value',
    kind: 'value',
    title: 'value',
    'body-file': 'value',
    'line-range': 'value',
  })

  const diffId = requireStr(cmd, parsed, 'diff')
  const id = requireStr(cmd, parsed, 'id')
  const kind = requireAnnotationKind(cmd, requireStr(cmd, parsed, 'kind'))
  const title = requireStr(cmd, parsed, 'title')
  const body = readFileArg(cmd, parsed, 'body-file', true)!
  const lineRange = parseLineRange(cmd, requireStr(cmd, parsed, 'line-range'))

  loadAndMutate(surfacePathOrDefault(parsed), surface =>
    annotationAdd(surface, { diffId, id, kind, title, body, lineRange }),
  )
}
