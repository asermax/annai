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

## Current scope (v0.3.3)

v0.3.x builds on v0.2's drafts + submit flow. v0.3.1 fixed a blank-page
bug and shipped surface-authoring CLI; v0.3.2–v0.3.3 are UX polish on
the rendered surface.

**Bug fix (v0.3.1):** the `@pierre/diffs` v1.1.22 `InteractionManager`
forbids combining `onGutterUtilityClick` with `renderGutterUtility`.
v0.3.0 shipped both, which left the page blank as soon as a surface
had any annotations. v0.3.1 keeps only the imperative click handler
(which is what carries the `SelectedLineRange` we need for line/range
drafts).

**Surface authoring CLI (v0.3.1 additions):**

- `*-update` verbs for every authored object: `group-update`,
  `annotation-update`, `suggestion-update`, `diagram-update`. Every
  field is optional; only what you pass is changed.
- `set-tldr` / `set-review-prompts` setters (the architecture doc
  previously said to plain-`Edit` these; the skill now uses the CLI).
- `surface validate [--strict]` re-runs zod against the file.
- `surface show [--diff <id> | --group <id>] [--text]` is the
  introspection the agent uses to find usable `--line-range` values
  before annotating.
- `surface scaffold --repo` accepts a local clone path **or**
  `OWNER/REPO` slug. A directory resolves via `gh repo view --json
  nameWithOwner` inside it.
- Every surface op prints a one-line success summary by default,
  supports `--json` for parseable output, `--quiet` for none, and
  `--help` per-op.
- `diagram-add` / `diagram-update` parse the mermaid source with the
  bundled renderer; pass `--skip-validate` to bypass.

**Rendered-surface UX (v0.3.2–v0.3.3):**

- The "Comment on file" trigger lives inside the file header
  (`.diff-head`), and the composer expands inline directly under it —
  flush inside the diff frame — instead of floating above the diff.
  `FileCommentComposer.tsx` owns the composer; `FileLevelComments.tsx`
  only renders saved drafts.
- Mermaid diagrams follow the page theme dynamically. A small
  `useTheme()` hook in `MermaidDiagram.tsx` listens for `data-theme`
  changes on `<html>` (via `MutationObserver`) and re-renders with
  `theme: 'dark'` or `'neutral'`. The previous hardcoded `'neutral'`
  clashed in dark mode.
- The overall PR-level review comment is authored inside the Confirm
  Review modal, not at the bottom of the page. The old
  `PRLevelComment.tsx` is deleted; `ConfirmReviewModal.tsx` owns the
  textarea bound to the same `prBody` / `setPrBody` (and
  `PUT /api/pr-body`) used everywhere.
- `Surface.tldr` and `Surface.reviewPrompts` items render through
  `marked` (block / inline respectively), matching every other prose
  field. Identifiers / titles stay plain text.
- `Ctrl/Cmd+Enter` submits the active composer. A single
  `src/frontend/lib/keyboard.ts → onSubmitKey(save)` helper is wired
  into every composer textarea (line/range, file-level, draft-edit,
  modal PR body — where it triggers `onConfirm` and submits the
  review).
- Composer-open state is now in the drafts context
  (`activeFileComposerPath`), so the trigger button in `.diff-head`
  and the composer body in the diff frame coordinate from separate
  subtrees with single-active-composer semantics.

**Other (v0.3.1):**

- First-run bootstrap pipes npm/Vite output to
  `$XDG_STATE_HOME/annai/bootstrap-<ts>.log` so the agent sees one
  line on success, plus the tail on failure.
- Client-side errors (window.onerror, unhandled rejection, React
  error boundary) are captured by the frontend and POSTed to
  `POST /api/client-errors`. They land in `session.clientErrors[]`
  (capped at 50), surface in `annai.sh status`, and emit a
  `daemon-error` event with `source: "client"` on the watch stream.

**Carried over from v0.2:**

- The skill builds `surface.json` via the `annai.sh surface ...`
  CLI — `scaffold` produces a hunks-parsed skeleton; the `*-add`,
  `*-update`, `*-drop` mutators and `set-*` setters mutate it
  atomically with zod validation on every write. The agent does not
  edit hunks / structure by hand.
- The daemon serves the React frontend, exposes `GET /api/surface`, and
  hosts the draft API: `GET /api/state`, `POST/PATCH/DELETE /api/drafts`,
  `PUT /api/pr-body`, `POST /api/submit`, `POST /api/dismiss`,
  `POST /api/client-errors`.
- The reviewer can draft inline comments on a line, a range, on a whole
  file, or as a top-level PR body. Agent `Suggestion` items render as
  accept-as-draft / dismiss candidates inline.
- Top-nav has three actions — **Approve**, **Comment**, **Dismiss
  session** — each opening a confirmation modal that previews what's
  about to happen.
- On submit, the daemon writes `result.json` and emits `review-submitted`.
  `annai.sh submit` makes a single atomic GraphQL submission to GitHub.
- On dismiss, the daemon emits `session-aborted` and shuts down — no
  GitHub call.

The interactive subcommands `watch`, `result`, and `submit` are real.
`reply` (ask-agent threads) is still stubbed and deferred.
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
    `gh api graphql`. `cli/surface.ts` + `cli/surface/*` is the
    surface-authoring family (`scaffold`, `group-add`, `diff-move`,
    `annotation-add`, …) the skill drives instead of editing
    `surface.json` directly.
  - `src/daemon/*` — daemon process: `daemon.ts` (entry), `session.ts`
    (state + atomic checkpoint + draft mutators + `buildResult` +
    `recordClientError`), `ipc.ts` (length-prefixed JSON over unix
    socket), `events.ts` (typed event bus + watch filter), `http.ts`
    (zero-dep static server + `/api/surface` + draft API +
    submit/dismiss + `POST /api/client-errors`), `submission.ts`
    (pure GraphQL request builders).
  - `src/shared/*` — types and zod schemas shared between cli, daemon, and
    frontend. `drafts.ts` defines the `Draft` discriminated union (line /
    range / file) and the wire shape for the draft API; `result.ts`
    defines `Result` written to result.json; `session-state.ts` is the
    `GET /api/state` shape (now includes `clientErrors[]`).
    `client-errors.ts` is the schema for browser-reported failures.
    `diff-parser.ts` turns unified-diff text into typed `Hunk[]` (used
    by `surface scaffold`); `surface-mutators.ts` holds the pure
    per-op functions every surface mutator handler calls (including
    the `*-update` and `set-*` mutators added in v0.3.1);
    `surface-io.ts` wraps them in read → validate → mutate →
    re-validate → atomic-write.
  - `src/cli/output.ts` — shared `emitResult` / `wantsHelp` helpers
    that every surface op uses for one-line success messages,
    `--json` mode, and `--help`.
  - `src/cli/surface/mermaid-validate.ts` — calls `mermaid.parse()`
    from `diagram-add` / `diagram-update`; importable parser, no DOM.
  - `src/frontend/*` — React 19 + Vite app, served at `/` by the daemon.
    `state/drafts.tsx` is the central React context (reducer + API
    wrappers, including `activeFileComposerPath`). `api/client-errors.ts`
    installs window.onerror / unhandledrejection listeners and POSTs to
    the daemon. `lib/keyboard.ts` exports `onSubmitKey(save)` — the
    `Ctrl/Cmd+Enter` handler every composer textarea uses.
    `components/ErrorBoundary.tsx` wraps the whole app so a render
    throw lands as a visible fallback + a client-error report.
    `components/{DraftComposer,DraftDisplay,FileLevelComments,
    FileCommentComposer,SubmitBar,ConfirmReviewModal,DismissSessionModal}.tsx`
    are the interaction surface. The PR-level review body is composed
    inside `ConfirmReviewModal` (no standalone bottom-of-page section).
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

Smoke the surface-authoring CLI against a real PR (uses `gh pr view`
+ `gh pr diff` under the hood; `--diff` / `--meta` escape hatches
let tests bypass `gh`). `--repo` accepts a local clone path or an
`OWNER/REPO` slug; every op accepts `--json` / `--quiet` / `--help`:

```sh
./skills/review/scripts/annai.sh surface scaffold \
  --pr <n> --repo . --out /tmp/surface.json
./skills/review/scripts/annai.sh surface validate --surface /tmp/surface.json
./skills/review/scripts/annai.sh surface show     --surface /tmp/surface.json --text
./skills/review/scripts/annai.sh surface show     --surface /tmp/surface.json --diff <id> --text
./skills/review/scripts/annai.sh surface group-add \
  --surface /tmp/surface.json --id entry --kind entry-point --title "Entry"
./skills/review/scripts/annai.sh surface group-update \
  --surface /tmp/surface.json --id entry --title "Entry: webhook handlers"
./skills/review/scripts/annai.sh surface diff-move \
  --surface /tmp/surface.json --diff <diff-id> --to-group entry
./skills/review/scripts/annai.sh surface set-tldr \
  --surface /tmp/surface.json --body-file /tmp/tldr.md
./skills/review/scripts/annai.sh surface          # full sub-op list
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
- **Bootstrap log**: first-run `npm install && npm run build` output
  goes to `${XDG_STATE_HOME:-$HOME/.local/state}/annai/bootstrap-<ts>.log`.
  On success the agent only sees a one-line "installing..." message; on
  failure the last 50 lines tail to stderr.
- **`@pierre/diffs` gutter API**: the InteractionManager rejects
  combining `options.onGutterUtilityClick` with the
  `renderGutterUtility` / `renderHoverUtility` props. We use only the
  imperative path because line/range drafts need the precise
  `SelectedLineRange` it provides — if you need to restyle the
  default gutter button, target the library's class in CSS rather
  than reintroducing the render prop.

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
