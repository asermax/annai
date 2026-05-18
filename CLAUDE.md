# Annai

Claude Code plugin that turns a code review into a guided browser surface.
Two leaf skills — `review-pr` (review a GitHub PR) and `review-local`
(review code an agent just produced locally) — share a base `review`
skill that owns the surface-authoring rules, launch/watch/react loop,
and the `annai.sh` CLI. Each leaf is a thin entry point that points at a
mode-specific reference under `skills/review/references/`. A local
daemon serves the surface in the browser via `@pierre/diffs` + mermaid.

The conceptual case lives in [docs/code-review-surface.md](docs/code-review-surface.md);
the full runtime design lives in [docs/annai-architecture.md](docs/annai-architecture.md).
HTML prototypes (`docs/prototype-v0?.html`) show the target visual shape —
v04 is the latest.

## Current scope (v0.4)

v0.4 splits the single PR-centric `review` skill into three: a base
skill that owns the shared procedure and the `annai.sh` CLI, plus two
leaf skills — `review-pr` and `review-local` — that contribute only
the mode-specific deltas.

**Schema (breaking):** `surface.pr` is gone. `surface.subject` is now a
discriminated union — `{ kind: 'pr', url, title, number, branch,
baseBranch, stats }` or `{ kind: 'local', title, branch, baseRef, stats
}`. Old surface.json files with the `pr` field will fail validation.

**Local-agent mode:**

- `annai.sh surface scaffold-local --repo <path> --diff <file> --title
  "<phrase>" [--branch <name>] [--base-ref <spec>] [--out <file>]` —
  parses the unified diff the agent produced (via `git diff` it ran
  itself), packs every changed file into the `unsorted` group, fills
  `subject: { kind: 'local', ... }` with stats derived from the parsed
  hunks. Does not shell out to `gh`.
- The reviewer's terminus is `annai.sh result --session <id>` — dumps
  `result.json` for the agent to read back. `annai.sh submit` refuses
  with a "use `result` instead" message if the subject isn't a PR.
- Frontend: the SubmitBar drops the **Approve** button (no remote to
  approve against) and relabels **Comment** → **Finish review**. The
  ConfirmReviewModal title becomes "Save your feedback?" and the
  overall-body hint says "The agent will read this when it picks up
  your feedback." A `LocalHeader.tsx` sibling to `PRHeader.tsx`
  renders subject + branch + base ref + stats with no external link.

**Diff-source detection** (agent-side, in `skills/review-local/SKILL.md`): explicit
user request > unstaged changes (`git diff HEAD`) > current branch vs
default base (`git diff <base>...HEAD`, base from
`git symbolic-ref refs/remotes/origin/HEAD`, fallback `main`) >
ambiguous → `AskUserQuestion`.

**Carried over from v0.3.x:**

- Drafts + single-shot review finalization on top of the read-only
  surface. The reviewer can draft inline comments on a line, a range,
  on a whole file, or as a top-level body. Agent `Suggestion` items
  render inline with Accept-as-draft / dismiss.
- Top-nav has the three actions — **Approve** (PR mode only), **Comment /
  Finish review**, **Dismiss session** — each opening a confirmation
  modal that previews what's about to happen.
- `@pierre/diffs` v1.1.22 `InteractionManager` only allows the
  imperative `onGutterUtilityClick` path (combining it with
  `renderGutterUtility` was the v0.3.0 blank-page bug). We rely on the
  imperative path because line/range drafts need its precise
  `SelectedLineRange`.
- Surface-authoring CLI: `*-add` / `*-update` / `*-drop` per object,
  `set-tldr` / `set-review-prompts` setters, `surface validate
  [--strict]`, `surface show [--diff <id> | --group <id>] [--text]`.
  Every op accepts `--json` / `--quiet` / `--help`. `surface scaffold
  --repo` accepts a local clone path or `OWNER/REPO` slug.
- First-run bootstrap pipes npm/Vite output to
  `$XDG_STATE_HOME/annai/bootstrap-<ts>.log`; the agent sees one line
  on success, or the tail on failure.
- Client-side errors (window.onerror, unhandled rejection, React error
  boundary) are captured and POSTed to `POST /api/client-errors`,
  surfaced via `annai.sh status` and `daemon-error` watch events with
  `source: "client"`.
- The daemon serves the React frontend, exposes `GET /api/surface`,
  and hosts the draft API: `GET /api/state`, `POST/PATCH/DELETE
  /api/drafts`, `PUT /api/pr-body`, `POST /api/submit`, `POST
  /api/dismiss`, `POST /api/client-errors`. Submit writes `result.json`
  atomically regardless of mode; PR mode then pushes via `annai.sh
  submit` (three GraphQL mutations).

The interactive subcommands `watch`, `result`, and `submit` are real.
`reply` (ask-agent threads) is still stubbed and deferred.
**If you're about to touch the ask-agent flow, re-read
`docs/annai-architecture.md` first.**

## Layout

- `.claude-plugin/plugin.json` — plugin manifest.
- `skills/review/SKILL.md` — base skill (shared procedure: author surface,
  launch, watch, react, cleanup). Marked **NEVER INVOKE DIRECTLY** — the
  two leaf skills load it.
- `skills/review-pr/SKILL.md` — entry point for PR review. Triggers on
  PR phrasings; carries Step 1 (`gh pr view`), Step 3a (`surface
  scaffold --pr`), the PR finish-line message, and Step 7 (`annai.sh
  submit` + GraphQL). Loads the base for everything else.
- `skills/review-local/SKILL.md` — entry point for local-agent review.
  Triggers on "review what I just changed" / branch phrasings; carries
  Step 1 (diff-source precedence with AskUserQuestion fallback), Step
  3a (`surface scaffold-local`), the local finish-line message, and
  Step 7 (`annai.sh result`). Loads the base for everything else.
- `skills/review/references/` — `surface-example.json` (PR shape the
  agent mimics), `surface-example-local.json` (same shape for a
  local-agent subject), and `surface.schema.json` (generated from zod
  via `npm run gen:schema`).
- `skills/review/scripts/annai.sh` — bash entry point. First run does
  `npm install` and `npm run build` inside `app/`; subsequent runs
  `exec node` the built CLI.
- `skills/review/scripts/app/` — node + react project.
  - `src/cli.ts` + `src/cli/*` — subcommand router and handlers.
    `cli/submit.ts` builds the GraphQL bodies and shells out to
    `gh api graphql`; it refuses if `surface.subject.kind !== 'pr'`.
    `cli/surface.ts` + `cli/surface/*` is the surface-authoring family
    (`scaffold`, `scaffold-local`, `group-add`, `diff-move`,
    `annotation-add`, …) the skill drives instead of editing
    `surface.json` directly. `surface/scaffold-build.ts` holds the
    pure post-parse helpers (diff-id slugging, stats counting, surface
    assembly + schema validation) both scaffolders call.
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
    by both scaffolders); `surface.ts` defines `subject` as a
    `discriminatedUnion('kind', [prSubject, localSubject])`;
    `surface-mutators.ts` holds the pure per-op functions every surface
    mutator handler calls; `surface-io.ts` wraps them in read →
    validate → mutate → re-validate → atomic-write.
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
    are the interaction surface. `PRHeader.tsx` / `LocalHeader.tsx` are
    siblings; `SurfacePage.tsx` picks one based on `surface.subject.kind`
    and threads `subjectKind` down into `SubmitBar` / `ConfirmReviewModal`.
    The overall review body is composed inside `ConfirmReviewModal` (no
    standalone bottom-of-page section).
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

Smoke PR-mode scaffold against a real PR (uses `gh pr view` + `gh pr
diff` under the hood; `--diff` / `--meta` escape hatches let tests
bypass `gh`). `--repo` accepts a local clone path or an `OWNER/REPO`
slug; every op accepts `--json` / `--quiet` / `--help`:

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

Smoke local-agent mode (no `gh`, just a `git diff` file):

```sh
git -C <repo> diff HEAD > /tmp/local.diff
./skills/review/scripts/annai.sh surface scaffold-local \
  --repo <repo> --diff /tmp/local.diff --title "Agent draft" \
  --base-ref HEAD --out /tmp/local-surface.json
./skills/review/scripts/annai.sh start \
  --surface /tmp/local-surface.json --session local-smoke
# … reviewer hits Finish review in the browser …
./skills/review/scripts/annai.sh result --session local-smoke   # what the agent reads
./skills/review/scripts/annai.sh stop   --session local-smoke
```

The agent never speaks HTTP — only via `annai.sh` subcommands.

## Key invariants

- **Hunks in `surface.json` must reproduce the actual change exactly.**
  No fictional diff lines, in either mode. The frontend reconstructs a
  unified diff from the typed `Hunk[]` and hands it to `@pierre/diffs`'s
  `<PatchDiff>`.
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
- **Version pill is auto-derived.** The `v<x.y.z>` pill in the top
  nav reads from a `__ANNAI_VERSION__` global injected at build time
  by `vite.config.ts` / `vitest.config.ts` (both read
  `.claude-plugin/plugin.json`). Bumping `plugin.json` is the only
  thing needed — never hardcode the version in JSX.

## Dogfood targets

- Tachikoma — `~/workspace/asermax/tachikoma`. PR mode; all context
  lives in the PR body (Katachi phase artifacts that get deleted on
  land).
- Filadd scheduler-api — `~/workspace/filadd/scheduler-api`. PR mode;
  context lives outside the PR (Notion + transcripts + agent state).
  The known-good first dogfood target is PR #323 (referenced in the
  idea doc).
- Local-agent mode: any working tree with uncommitted changes or a
  branch diverged from its base. The agent runs the appropriate `git
  diff` itself per the precedence in `skills/review-local/SKILL.md`.

## Intentionally deferred

- **Ask-agent threads** (`agent-asked` event, `annai.sh reply`, inline
  thread UI). Still deferred.
- Multi-session UX polish, watch reconnect/replay from `events.log` offsets,
  Claude Code marketplace publication.

Style conventions (TypeScript, React, Python) live in the user's global
`~/.claude/CLAUDE.md` — not duplicated here.
