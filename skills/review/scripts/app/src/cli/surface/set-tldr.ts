import { loadAndMutate } from '../../shared/surface-io.ts'
import { setTldr } from '../../shared/surface-mutators.ts'
import { emitResult, wantsHelp } from '../output.ts'
import {
  extractOutputMode,
  optionalStr,
  parseFlags,
  readFileArg,
  surfacePathOrDefault,
  withOutputFlags,
} from './args.ts'

const USAGE = `usage: annai.sh surface set-tldr (--body-file <f> | --value <inline>) [--surface <p>] [--json | --quiet]

Replaces the surface tldr. Pass --body-file for multi-line content (preferred) or --value for a short inline string.
`

export const runSetTldr = async (argv: string[]): Promise<void> => {
  if (wantsHelp(argv)) { process.stdout.write(USAGE); return }

  const cmd = 'surface set-tldr'
  const parsed = parseFlags(cmd, argv, withOutputFlags({
    surface: 'value',
    'body-file': 'value',
    value: 'value',
  }))

  const body = readFileArg(cmd, parsed, 'body-file', false)
  const inline = optionalStr(parsed, 'value')
  if (body != null && inline != null) {
    throw new Error(`${cmd}: pick one of --body-file or --value`)
  }
  const next = body ?? inline
  if (next == null) {
    throw new Error(`${cmd}: pass --body-file <path> or --value <inline>`)
  }

  const surfacePath = surfacePathOrDefault(parsed)
  loadAndMutate(surfacePath, surface => setTldr(surface, next))

  emitResult({
    op: 'set-tldr',
    surface: surfacePath,
    text: `tldr updated (${next.length} chars)`,
    data: { length: next.length },
  }, extractOutputMode(parsed))
}
