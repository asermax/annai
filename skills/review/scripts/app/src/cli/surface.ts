import { runScaffold } from './surface/scaffold.ts'
import { runGroupAdd } from './surface/group-add.ts'
import { runGroupDrop } from './surface/group-drop.ts'
import { runGroupUpdate } from './surface/group-update.ts'
import { runDiffMove } from './surface/diff-move.ts'
import { runDiffDrop } from './surface/diff-drop.ts'
import { runAnnotationAdd } from './surface/annotation-add.ts'
import { runAnnotationDrop } from './surface/annotation-drop.ts'
import { runAnnotationUpdate } from './surface/annotation-update.ts'
import { runSuggestionAdd } from './surface/suggestion-add.ts'
import { runSuggestionDrop } from './surface/suggestion-drop.ts'
import { runSuggestionUpdate } from './surface/suggestion-update.ts'
import { runDiagramAdd } from './surface/diagram-add.ts'
import { runDiagramDrop } from './surface/diagram-drop.ts'
import { runDiagramUpdate } from './surface/diagram-update.ts'
import { runSetTldr } from './surface/set-tldr.ts'
import { runSetReviewPrompts } from './surface/set-review-prompts.ts'
import { runValidate } from './surface/validate.ts'
import { runShow } from './surface/show.ts'

const SURFACE_USAGE = `usage: annai.sh surface <op> [args]

ops:
  scaffold              --pr <n> --repo <path | OWNER/REPO> [--out <file>] [--diff <file>] [--meta <file>]
  group-add             --id <id> --kind <kind> --title <t> [--intro-file <f>] [--before <id> | --after <id>] [--surface <p>]
  group-update          --id <id> [--kind <k>] [--title <t>] [--intro-file <f>] [--surface <p>]
  group-drop            --id <id> [--surface <p>]
  diff-move             --diff <id> --to-group <id> [--position <n>] [--surface <p>]
  diff-drop             --diff <id> [--surface <p>]
  annotation-add        --diff <id> --id <ann-id> --kind <k> --title <t> --body-file <f> --line-range <s>,<e> [--surface <p>]
  annotation-update     --diff <id> --id <ann-id> [--kind <k>] [--title <t>] [--body-file <f>] [--line-range <s>,<e>] [--surface <p>]
  annotation-drop       --diff <id> --id <ann-id> [--surface <p>]
  suggestion-add        --diff <id> --id <s-id> --body-file <f> --line-range <s>,<e> [--code-file <f>] [--surface <p>]
  suggestion-update     --diff <id> --id <s-id> [--body-file <f>] [--line-range <s>,<e>] [--code-file <f> | --clear-code] [--surface <p>]
  suggestion-drop       --diff <id> --id <s-id> [--surface <p>]
  diagram-add           --id <id> --source-file <f> [--title <t>] [--group <group-id>] [--skip-validate] [--surface <p>]
  diagram-update        --id <id> [--group <group-id>] [--title <t> | --clear-title] [--source-file <f>] [--skip-validate] [--surface <p>]
  diagram-drop          --id <id> [--group <group-id>] [--surface <p>]
  set-tldr              (--body-file <f> | --value <inline>) [--surface <p>]
  set-review-prompts    (--file <f> | --json-file <f>) [--surface <p>]
  validate              [--strict] [--surface <p>]
  show                  [--diff <id> | --group <id>] [--text] [--surface <p>]

Global flags for every op:
  --surface <p>   path to surface.json (default: ./surface.json)
  --json          single-line JSON output instead of plain text
  --quiet         suppress success output
  -h, --help      per-op help (pass after the op name, e.g. surface annotation-add --help)
`

type SurfaceHandler = (argv: string[]) => Promise<void>

const HANDLERS: Record<string, SurfaceHandler> = {
  scaffold: runScaffold,
  'group-add': runGroupAdd,
  'group-update': runGroupUpdate,
  'group-drop': runGroupDrop,
  'diff-move': runDiffMove,
  'diff-drop': runDiffDrop,
  'annotation-add': runAnnotationAdd,
  'annotation-update': runAnnotationUpdate,
  'annotation-drop': runAnnotationDrop,
  'suggestion-add': runSuggestionAdd,
  'suggestion-update': runSuggestionUpdate,
  'suggestion-drop': runSuggestionDrop,
  'diagram-add': runDiagramAdd,
  'diagram-update': runDiagramUpdate,
  'diagram-drop': runDiagramDrop,
  'set-tldr': runSetTldr,
  'set-review-prompts': runSetReviewPrompts,
  validate: runValidate,
  show: runShow,
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
