import { runScaffold } from './surface/scaffold.ts'
import { runGroupAdd } from './surface/group-add.ts'
import { runGroupDrop } from './surface/group-drop.ts'
import { runDiffMove } from './surface/diff-move.ts'
import { runDiffDrop } from './surface/diff-drop.ts'
import { runAnnotationAdd } from './surface/annotation-add.ts'
import { runAnnotationDrop } from './surface/annotation-drop.ts'
import { runSuggestionAdd } from './surface/suggestion-add.ts'
import { runSuggestionDrop } from './surface/suggestion-drop.ts'
import { runDiagramAdd } from './surface/diagram-add.ts'
import { runDiagramDrop } from './surface/diagram-drop.ts'

const SURFACE_USAGE = `usage: annai.sh surface <op> [args]

ops:
  scaffold         --pr <n> --repo <path> [--out <file>] [--diff <file>] [--meta <file>]
  group-add        --id <id> --kind <kind> --title <t> [--surface <p>] [--intro-file <f>] [--before <id> | --after <id>]
  group-drop       --id <id> [--surface <p>]
  diff-move        --diff <id> --to-group <id> [--position <n>] [--surface <p>]
  diff-drop        --diff <id> [--surface <p>]
  annotation-add   --diff <id> --id <ann-id> --kind <k> --title <t> --body-file <f> --line-range <s>,<e> [--surface <p>]
  annotation-drop  --diff <id> --id <ann-id> [--surface <p>]
  suggestion-add   --diff <id> --id <s-id> --body-file <f> --line-range <s>,<e> [--code-file <f>] [--surface <p>]
  suggestion-drop  --diff <id> --id <s-id> [--surface <p>]
  diagram-add      --id <id> --source-file <f> [--title <t>] [--group <group-id>] [--surface <p>]
  diagram-drop     --id <id> [--group <group-id>] [--surface <p>]

--surface defaults to ./surface.json when omitted.
`

type SurfaceHandler = (argv: string[]) => Promise<void>

const HANDLERS: Record<string, SurfaceHandler> = {
  scaffold: runScaffold,
  'group-add': runGroupAdd,
  'group-drop': runGroupDrop,
  'diff-move': runDiffMove,
  'diff-drop': runDiffDrop,
  'annotation-add': runAnnotationAdd,
  'annotation-drop': runAnnotationDrop,
  'suggestion-add': runSuggestionAdd,
  'suggestion-drop': runSuggestionDrop,
  'diagram-add': runDiagramAdd,
  'diagram-drop': runDiagramDrop,
}

export const runSurface = async (argv: string[]): Promise<void> => {
  const [op, ...rest] = argv

  if (op == null || op === '-h' || op === '--help') {
    process.stdout.write(SURFACE_USAGE)
    return
  }

  const handler = HANDLERS[op]
  if (handler == null) {
    process.stderr.write(`surface: unknown op "${op}"\n\n${SURFACE_USAGE}`)
    process.exit(1)
  }

  await handler(rest)
}
