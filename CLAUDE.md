# Annai

Claude Code plugin that turns a code review into a guided browser surface.
A `review` skill walks the agent through generating a structured JSON view
of a pull request — base context first, then entry points, then supporting
code, with typed side notes and inline suggestions — and a local daemon
serves it in the browser via `@pierre/diffs` + mermaid.

The conceptual case lives in [docs/code-review-surface.md](docs/code-review-surface.md);
the full runtime design lives in [docs/annai-architecture.md](docs/annai-architecture.md).
HTML prototypes (`docs/prototype-v0?.html`) show the target visual shape —
v04 is the latest.

## Current scope (v0.2)

v0.2 adds **draft comments + single-shot GitHub review submission** on top
of v0.1's read-only surface:

- The skill generates `surface.json` (unchanged from v0.1).
- The daemon serves the React frontend, exposes `GET /api/surface`, and
  hosts the draft API: `GET /api/state`, `POST/PATCH/DELETE /api/drafts`,
  `PUT /api/pr-body`, `POST /api/submit`, `POST /api/dismiss`.
- The reviewer can draft inline comments on a line, a range, on a whole
  file, or as a top-level PR body. Agent `Suggestion` items render as
  accept-as-draft / dismiss candidates inline.
- Top-nav has three actions — **Approve**, **Comment**, **Dismiss
  session** — each opening a confirmation modal that previews what's
  about to happen (file-grouped draft list + PR body, with empty-state
  warnings).
- On submit, the daemon writes `result.json` and emits `review-submitted`.
  The agent's `Monitor` of `annai.sh watch` sees the event, then runs
  `annai.sh submit`, which makes a single atomic GraphQL submission to
  GitHub: one `addPullRequestReview` (line + range threads), one
  `addPullRequestReviewThread` per file-level draft (`subjectType: FILE`),
  one `submitPullRequestReview` to finalise with `APPROVE` or `COMMENT`.
- On dismiss, the daemon emits `session-aborted` and shuts down — no
  GitHub call.

The interactive subcommands `watch`, `result`, and `submit` are real.
`reply` (ask-agent threads) is still stubbed and deferred to v0.3.
**If you're about to touch the ask-agent flow, re-read
`docs/annai-architecture.md` first.**

## Layout

- `.claude-plugin/plugin.json` — plugin manifest.
- `skills/review/SKILL.md` — agent-facing contract for `/annai:review`.
- `skills/review/references/` — `surface-example.json` (canonical shape the
  agent mimics) and `surface.schema.json` (generated from zod via
  `npm run gen:schema`).
- `skills/review/scripts/annai.sh` — bash entry point. First run does
  `npm install` and `npm run build` inside `app/`; subsequent runs
  `exec node` the built CLI.
- `skills/review/scripts/app/` — node + react project.
  - `src/cli.ts` + `src/cli/*` — subcommand router and handlers.
    `cli/submit.ts` builds the GraphQL bodies and shells out to
    `gh api graphql`.
  - `src/daemon/*` — daemon process: `daemon.ts` (entry), `session.ts`
    (state + atomic checkpoint + draft mutators + `buildResult`), `ipc.ts`
    (length-prefixed JSON over unix socket), `events.ts` (typed event bus
    + watch filter), `http.ts` (zero-dep static server + `/api/surface` +
    draft API + submit/dismiss), `submission.ts` (pure GraphQL request
    builders).
  - `src/shared/*` — types and zod schemas shared between cli, daemon, and
    frontend. `drafts.ts` defines the `Draft` discriminated union (line /
    range / file) and the wire shape for the draft API; `result.ts`
    defines `Result` written to result.json; `session-state.ts` is the
    `GET /api/state` shape.
  - `src/frontend/*` — React 19 + Vite app, served at `/` by the daemon.
    `state/drafts.tsx` is the central React context (reducer + API
    wrappers). `components/{DraftComposer,DraftDisplay,FileLevelComments,
    PRLevelComment,SubmitBar,ConfirmReviewModal,DismissSessionModal}.tsx`
    are the v0.2 interaction surface.
  - `dist/` — gitignored; built by `annai.sh` on first run.
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
  typed `Hunk[]` and hands it to `@pierre/diffs`'s `<PatchDiff>`.
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

- **Ask-agent threads** (`agent-asked` event, `annai.sh reply`, inline
  thread UI). Deferred to v0.3.
- Multi-session UX polish, watch reconnect/replay from `events.log` offsets,
  Claude Code marketplace publication.

Style conventions (TypeScript, React, Python) live in the user's global
`~/.claude/CLAUDE.md` — not duplicated here.
