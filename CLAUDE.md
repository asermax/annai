# Annai

Claude Code plugin that turns a code review into a guided browser surface.
A `review` skill walks the agent through generating a structured JSON view
of a pull request — base context first, then entry points, then supporting
code, with typed side notes and inline suggestions — and a local daemon
serves it in the browser via `diff2html` + mermaid.

The conceptual case lives in [docs/code-review-surface.md](docs/code-review-surface.md);
the full runtime design lives in [docs/annai-architecture.md](docs/annai-architecture.md).
HTML prototypes (`docs/prototype-v0?.html`) show the target visual shape —
v04 is the latest.

## Current scope (v0.1)

v0.1 is **read-only**:

- The skill generates `surface.json`.
- The daemon serves the React frontend and `GET /api/surface`.
- The reviewer reads. They cannot draft comments, ask the agent questions,
  or submit a review back to GitHub from inside Annai.

The full daemon scaffolding (unix-socket IPC, event bus with watch filter,
typed events) is already in place — the interactive subcommands
(`watch`, `reply`, `result`) exist as stubs that exit with `"not yet
implemented in v0.1"`. v0.2 fills those in. **If you're about to touch any
of the interactive flows, re-read `docs/annai-architecture.md` first.**

## Layout

- `.claude-plugin/plugin.json` — plugin manifest.
- `skills/review/SKILL.md` — agent-facing contract for `/annai:review`.
- `skills/review/references/` — `surface-example.json` (canonical shape the
  agent mimics) and `surface.schema.json` (generated from zod via
  `npm run gen:schema`).
- `skills/review/scripts/annai.sh` — bash entry point. First run does
  `npm install --omit=dev` inside `app/`; subsequent runs `exec node` the
  built CLI.
- `skills/review/scripts/app/` — node + react project.
  - `src/cli.ts` + `src/cli/*` — subcommand router and handlers.
  - `src/daemon/*` — daemon process: `daemon.ts` (entry), `session.ts`
    (state + atomic checkpoint), `ipc.ts` (length-prefixed JSON over unix
    socket), `events.ts` (typed event bus + watch filter), `http.ts` (zero-
    dep static server + `/api/surface`).
  - `src/shared/*` — types and zod schemas shared between cli, daemon, and
    frontend.
  - `src/frontend/*` — React 19 + Vite app, served at `/` by the daemon.
  - `dist/` — committed build output, shipped with the plugin.
  - `tests/{unit,frontend}/` — vitest.

## Dev workflow

From `skills/review/scripts/app/`:

```sh
npm install
npm run gen:schema        # regenerates references/surface.schema.json from zod
npm run build             # tsc → dist/, vite → dist/frontend/
npm test                  # vitest
```

Manual smoke from the repo root:

```sh
./skills/review/scripts/annai.sh start \
  --surface ./skills/review/references/surface-example.json \
  --session smoke1
# → prints {"sessionId":"smoke1","url":"http://127.0.0.1:<port>/"}, opens browser

./skills/review/scripts/annai.sh status   --session smoke1
./skills/review/scripts/annai.sh sessions
./skills/review/scripts/annai.sh stop     --session smoke1
```

The agent never speaks HTTP — only via `annai.sh` subcommands.

## Key invariants

- **Hunks in `surface.json` must reproduce the actual PR exactly.** No
  fictional diff lines. The frontend reconstructs a unified diff from the
  typed `Hunk[]` and hands it to `diff2html`.
- **All annotations must be grounded** in the diff or supplied context — no
  speculation. Doc-vs-code mismatches are an explicit `discrepancy` kind.
- **No TypeScript `enum`.** Annotation/group/event kinds are `as const` maps
  with a derived union type — see `src/shared/surface.ts` and
  `src/shared/events.ts`.
- **Session directory**: `$XDG_RUNTIME_DIR/annai/sessions/<id>/`, falling
  back to `${TMPDIR:-/tmp}/annai-$UID/annai/sessions/<id>/`. Resolved in
  `src/shared/paths.ts`.
- **Daemon binds 127.0.0.1 and auto-picks a port.** The chosen port is
  written to `state.json` and printed in the `start` stdout JSON.
- **Watch filter** (`src/daemon/events.ts` + `EMITTED_ON_WATCH` in
  `src/shared/events.ts`) is the source of truth for "events the agent
  should react to" — keep it aligned with the architecture doc when adding
  new event kinds.

## Dogfood targets

- Tachikoma — `~/workspace/asermax/tachikoma`. All context lives in the PR
  body (Katachi phase artifacts that get deleted on land).
- Filadd scheduler-api — `~/workspace/filadd/scheduler-api`. Context lives
  outside the PR (Notion + transcripts + agent state). The known-good
  first dogfood target is PR #323 (referenced in the idea doc).

## Intentionally deferred

- Interactive CLI subcommands (`watch`, `reply`, `result`) and the
  ask-agent / draft-comment / submit-review flows they drive.
- `gh pr review` submission step (mapping `result.json` to
  `POST /repos/.../pulls/{n}/reviews`).
- `diffs.com` as a diff renderer — `diff2html` is the v0.1 choice; revisit
  once licensing terms are confirmed.
- Multi-session UX polish, watch reconnect/replay from `events.log` offsets,
  Claude Code marketplace publication.

Style conventions (TypeScript, React, Python) live in the user's global
`~/.claude/CLAUDE.md` — not duplicated here.
