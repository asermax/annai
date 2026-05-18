---
name: review
description: NEVER INVOKE THIS SKILL DIRECTLY; USE `/annai:review-pr` to review a GitHub pull request, or `/annai:review-local` to review code an agent just produced locally. This file is the shared base that the two leaf skills load — it owns the surface-authoring rules, launch + watch + react loop, schema-validation contract, and cleanup. It is not a standalone entry point.
---

# Annai review (shared base)

This base skill is loaded by `review-pr` and `review-local`. It owns every step that is identical regardless of whether the change being reviewed is a GitHub PR or a local agent draft. The mode-specific steps (determine subject, scaffold, finish-line message, terminus) live in the leaf skill that invoked you — read it alongside this base and interleave: the leaf covers Step 1 (subject), Step 3a (scaffold), the finish-line message inside Step 5, and the terminus inside Step 7. Everything else below is shared.

## Scope

This iteration adds **draft comments + single-shot review finalization** on top of v0.1's read-only surface:

- The reviewer can draft inline comments on a line, a range, a whole file, or as a top-level body. They can accept or dismiss the agent's `Suggestion` items.
- In PR mode they pick **Approve** or **Comment** (no Request Changes) and confirm in a modal. A third action — **Dismiss session** — closes the daemon without sending anything.
- In local-agent mode there is no Approve. The reviewer hits **Finish review** to save their feedback as `result.json`, or **Dismiss session** to throw it away.
- You watch for `review-submitted` (or `session-aborted` on dismiss / browser close), then run the terminus the mode-specific leaf describes.

**Still stubbed:** ask-agent threads (`agent-asked` event, `annai.sh reply`, inline agent replies in the browser). Don't promise the user they can ask the agent questions inline yet.

## Task tracking

Before you start Step 1, call `TaskCreate` once per step in the procedure below (Step 1 through Step 8) using the step's title as the task subject — including the mode-specific ones the leaf owns (Step 1, 3a, 7). Mark each task `in_progress` when you start it and `completed` when it's done; don't batch. This is how the user sees your progress on the review — the spinner reflects which step you're on, and stale "pending" entries surface incomplete work after a crash or interruption.

It's fine to add tasks as you go for sub-work that emerges (e.g. "ask the user about ambiguous diff source", "re-validate after group reshuffle"), but the eight procedure steps should always exist as their own tasks from the start.

## Procedure

### 1. Determine subject

This step is mode-specific — see the leaf skill that invoked you (`review-pr` or `review-local`).

### 2. Determine context

If the user supplied context (paths, URLs, free text) in their invocation, use it. Otherwise ask **once**, short:

> What context should I use for this review? Paste links, paths, or describe where the relevant info lives. Reply 'none' to proceed with just the diff.

`'none'` is valid — Annai works with no context, just better with it. Common context sources: Katachi specs, Notion pages, design docs, transcripts, GitHub issue threads, the PR body itself (PR mode), or the agent's own working notes (local mode).

### 3. Build `surface.json`

You don't compose the surface by hand. `annai.sh surface ...` is a family of subcommands that build and edit it atomically — each one reads, validates, mutates, re-validates, and atomic-writes the file. That keeps hunks faithful to the change (parser-generated, not LLM-written) and lets you edit a 100-file scaffold without touching the JSON directly.

Reference: `references/surface-example.json` (PR shape) and `references/surface-example-local.json` (local-agent shape) show the final shape. You read one once to understand structure; you don't mimic it line by line.

#### 3a. Scaffold

This step is mode-specific — `review-pr` uses `surface scaffold --pr ...`; `review-local` uses `surface scaffold-local --diff ...`. See the leaf skill that invoked you.

Pick a short session id (e.g. `review-<n>` or a 6-char nonce). The surface lives at `${XDG_RUNTIME_DIR:-${TMPDIR:-/tmp}/annai-$UID}/annai/sessions/<id>/surface.json`.

##### Line ranges (read this before annotating)

`--line-range` on `annotation-add` / `suggestion-add` always refers to **new-file** line numbers — the `newLine` values from the scaffold's parsed hunks. To find a usable range, run `annai.sh surface show --surface <p> --diff <id> --text` and read the new-file column. Don't guess line numbers from the diff body; the parsed structure is the source of truth.

#### 3b. Author with scoped subcommands

Don't edit hunks by hand — the scaffold has them right. Use the `surface` subcommand family for everything else. Free-form text (intro, annotation body, suggestion body, mermaid source) is passed via `--*-file <path>` so you can write multi-line markdown to a temp file with `Write` and reference it.

Every surface op:
- Prints a one-line success summary (e.g. `annai: annotation "ann-1" added to "diff-foo" at L13–22 (note)`).
- Accepts `--json` for a single-line JSON output, `--quiet` for none.
- Accepts `--help` for per-op usage.

```bash
# Create the groups you've decided on. --before / --after control order.
annai.sh surface group-add --surface <p> --id models --kind base-context \
  --title "Data model" --intro-file /tmp/intro-models.md --before unsorted

# Move diffs from `unsorted` into your groups.
annai.sh surface diff-move --surface <p> --diff diff-src-models-user-ts \
  --to-group models

# Drop noise (lockfile churn, etc).
annai.sh surface diff-drop --surface <p> --diff diff-package-lock-json

# Annotate (highest volume). --kind ∈ pattern | note | question | surface-check | discrepancy.
annai.sh surface annotation-add --surface <p> \
  --diff diff-src-handlers-create-ts \
  --id ann-deferred-black-hole --kind question \
  --title "Deferred branch is a black hole" \
  --body-file /tmp/ann.md --line-range 142,158

# Inline suggestions (Accept-as-draft in the browser).
annai.sh surface suggestion-add --surface <p> --diff <id> --id sug-1 \
  --body-file /tmp/sug.md --line-range 12,18 --code-file /tmp/sug-code.txt

# Mermaid diagrams. --group <id> for group-scoped; omit for surface-level.
# The mermaid source is parsed with the bundled renderer; pass --skip-validate
# to bypass when needed (rare).
annai.sh surface diagram-add --surface <p> --id flow \
  --title "Submit flow" --source-file /tmp/flow.mmd --group entry
```

Drop-variants exist for every add: `group-drop`, `diff-drop`, `annotation-drop`, `suggestion-drop`, `diagram-drop`.

**Update-variants** exist too — use them to revise an item without dropping and re-adding (which loses position / ids): `group-update`, `annotation-update`, `suggestion-update`, `diagram-update`. Every field is optional; only what you pass is changed. Examples:

```bash
annai.sh surface group-update --surface <p> --id entry --title "Entry: webhook handlers"

annai.sh surface annotation-update --surface <p> \
  --diff diff-src-handlers-create-ts --id ann-deferred-black-hole \
  --body-file /tmp/ann-v2.md

annai.sh surface diagram-update --surface <p> --id flow \
  --source-file /tmp/flow-v2.mmd
```

Run `annai.sh surface` with no args to print the full list.

#### 3c. Fill in `tldr` and `reviewPrompts`

```bash
# tldr: short prose, file-backed for multi-line content.
annai.sh surface set-tldr --surface <p> --body-file /tmp/tldr.md

# reviewPrompts: one per line, blank lines ignored.
annai.sh surface set-review-prompts --surface <p> --file /tmp/prompts.txt
```

Leave both for last so you've already seen the whole diff. If you need to revise them later, just re-run the same setters.

#### 3d. Introspection: `surface show` and `surface validate`

`surface show` is read-only and answers "what's in this surface right now?" Three modes:

```bash
# Overview: subject + tldr + per-group counts + surface-level diagrams + prompts.
annai.sh surface show --surface <p>

# Group details + per-diff counts.
annai.sh surface show --surface <p> --group <id>

# A diff's hunks rendered with new-file line numbers + its annotations
# + suggestions. This is how you find usable --line-range values.
annai.sh surface show --surface <p> --diff <id>

# Add --text for human-readable formatting; default output is JSON.
```

`surface validate` re-runs the zod schema against the file and prints a one-line summary on success:

```bash
annai.sh surface validate --surface <p>           # base check
annai.sh surface validate --surface <p> --strict  # also fail on non-empty unsorted,
                                                   # empty group intros, empty tldr
```

#### 3e. Validation contract

Every `surface` subcommand validates with zod before writing. So does `annai.sh start`. On failure, stderr is:

```
annai: surface validation failed
  <json-path>: <message>
  <json-path>: <message>
```

— one issue per line, paths like `groups[0].diffs[1].annotations[0].kind`. Read each line, fix the cited field with the appropriate mutator (e.g. an unknown enum value on `groups[0].kind` → drop and re-add the group, or use `group-update --kind …`), and re-run.

#### 3f. Annotation/group/suggestion conventions

Hard constraints:

- **Hunks reproduce the actual change exactly.** The scaffold enforces this structurally — don't override it with `Edit`.
- **All annotations must be grounded** in the diff or the supplied context. No speculation. If the doc says X and the code does Y, that's a `discrepancy` annotation — surface it explicitly.
- **Every annotation must teach.** Density is fine — narrative isn't. Don't restate what the diff already shows or what an attentive reader would catch in passing. Each annotation should answer one of: *why does this exist*, *what's easy to miss*, *what should the reviewer verify*, *what's inconsistent*. If you can't say which, cut it.
- **Order groups for comprehension.** `kind` is one of `base-context`, `entry-point`, `supporting`. Put base-context first **only when load-bearing** (new abstractions, data models). Then entry points (HTTP handlers, webhooks, background triggers, CLI commands — the points a user or system *triggers*, not where code is *wired up*). Then supporting code.
- **Annotation kinds.** Each kind names a different *job* the annotation does for the reviewer. Pick by intent, not by shape.
  - `pattern` — name a recurring shape so the reviewer can match it once and stop re-reading.
    - *Good*: "Default `'immediate'` preserves existing behaviour — every existing row reads this value after the migration, which is what every call site expects when the column is absent."
    - *Bad*: "This adds a new column."
  - `note` — the **why**: purpose, constraint, hidden invariant, or non-obvious consequence. Never a description of *what* the code does.
    - *Good*: "Branch maps 1:1 to the migration's CHECK constraint — a fourth mode would need this switch and the constraint to move in lockstep."
    - *Bad*: "Calls the API and parses the response."
  - `question` — something the *reviewer* should ask the author (or themselves) before approving. Not a rhetorical aside.
    - *Good*: "The `deferred` branch returns 202 without enqueueing — who picks these up later? If nothing does, it's a black hole."
    - *Bad*: "What does this function do?"
  - `surface-check` — a verification target: "look here for X."
    - *Good*: "`runTransition` and `enqueueTransition` are newly exported — check whether anything actually consumes the export or it can drop."
    - *Bad*: "Check this code."
  - `discrepancy` — a doc-vs-code mismatch you can name. The doc source must be specified and the mismatch concrete.
    - *Good*: "Scope doc (`docs/transition-scheduling.md`) describes the body as `{ advance_at: ISO8601 }`, but the handler reads `req.body?.scheduled_for`. One of them is wrong."
    - *Bad*: "Doesn't match the docs."
- **Suggestions vs annotations.** Annotations are for the reviewer's understanding (never sent anywhere). Suggestions are for things the reviewer might want to raise *on the change* — phrased as proposed changes or questions for the author. Use `suggestionCode` when proposing a code change. Suggestions render inline with "Accept as draft" and "Dismiss" buttons; accepting promotes a suggestion into a real draft comment that goes out with the review.
- **Mermaid diagrams** where they aid understanding: ERD for new tables, sequence for API flows, state diagram for lifecycles, flowchart for branching logic. Surface-level diagrams go on `surface.diagrams`; group-scoped diagrams go on the relevant group.

### 4. Launch the session

```bash
"${CLAUDE_PLUGIN_ROOT}/skills/review/scripts/annai.sh" start \
  --surface "<path-to-surface.json>" \
  --session "<session-id>" \
  --repo "<local-repo-path>"
```

Bootstrap (`npm install`) runs on first invocation inside the script — don't pre-install. Capture `{sessionId, url}` from stdout.

### 5. Report to the user and start watching

Tell them the URL and how the flow ends. The finish-line message is mode-specific — see the leaf skill for the exact wording to use.

Then run `annai.sh watch` under `Monitor` so the agent reacts to events without polling:

```bash
"${CLAUDE_PLUGIN_ROOT}/skills/review/scripts/annai.sh" watch \
  --session "<session-id>"
```

`watch` is quiet until the reviewer acts. The line-delimited events it emits to stdout are the ones the agent must handle (everything else — `comment-drafted`, `comment-edited`, etc. — stays browser-side and never wakes the agent).

### 6. React to events

- `review-submitted` (`{ decision, commentCount }`) → go to the mode-specific terminus (Step 7).
- `session-aborted` (`{ reason }`) → report a clean cancellation to the user. `reason: "dismissed-by-reviewer"` means the reviewer hit Dismiss session; other reasons are browser-close / `stop` / signals. **Don't** run the terminus — there's nothing to finalize. The daemon has already exited; no `stop` needed.
- `daemon-error` (`{ message, source }`) → report the failure to the user. `source: "client"` means the browser surfaced a runtime error (window.onerror, unhandled rejection, or the React error boundary fired); the page may have rendered a fallback. `source: "daemon"` (or omitted) means a server-side fault. Run `annai.sh status --session <id>` for full context — the `clientErrors[]` array on the status JSON has the captured stack / componentStack for every client-side report.

### 7. Terminus

This step is mode-specific — see the leaf skill that invoked you. PR mode submits to GitHub via `annai.sh submit`; local-agent mode reads `result.json` via `annai.sh result` and translates the feedback into agent-actionable notes.

### 8. Cleanup

```bash
"${CLAUDE_PLUGIN_ROOT}/skills/review/scripts/annai.sh" stop \
  --session "<session-id>"
```

Skip this if the watch event was `session-aborted` — the daemon already shut down.

## References

- `references/surface.schema.json` — the JSON schema for `surface.json`.
- `references/surface-example.json` — a minimal, concrete PR example you can mimic the shape of.
- `references/surface-example-local.json` — same shape for a local-agent subject.
- Project docs: `docs/code-review-surface.md` (idea + shape) and `docs/annai-architecture.md` (full runtime design, including the interactive flows deferred past v0.1).
