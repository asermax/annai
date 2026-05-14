---
name: review
description: Generate a guided code-review surface for a pull request and open it in the browser. Produces an ordered, annotated JSON view of the diff (base context first, then entry points, then supporting code) with typed side notes, inline PR suggestions, and mermaid diagrams; then launches a local server that renders it.
---

# Annai review

Turn a pull request into a guided browser surface that lets the reviewer read
the diff in the right order, with the context already woven in.

## When to use this skill

The user asks you to review a PR, get them ready to review a PR, or otherwise
prepare a surface for a code review. Typical phrasings: "review this PR",
"prep PR #N for review", "help me review <url>", or an explicit `/annai:review`
invocation.

## v0.2 scope (read this before you start)

This iteration adds **draft comments + single-shot review submission** on
top of v0.1's read-only surface:

- The reviewer can draft inline comments on a line, a range, a whole
  file, or as a top-level PR body. They can accept or dismiss the
  agent's `Suggestion` items.
- They pick **Approve** or **Comment** (no Request Changes) and confirm
  in a modal. A third action — **Dismiss session** — closes the daemon
  without sending anything.
- You watch for `review-submitted` (or `session-aborted` on dismiss /
  browser close), then run `annai.sh submit` to atomically push the
  whole review to GitHub via three GraphQL mutations.

**Still stubbed (v0.3):** ask-agent threads (`agent-asked` event,
`annai.sh reply`, inline agent replies in the browser). Don't promise the
user they can ask the agent questions inline yet.

## Procedure

### 1. Determine PR + repo path

- The user's invocation gives you either a PR URL, a PR number, or "the
  current branch".
- Resolve the local repo path. If the user gave a URL or unclear identifier,
  ask: "Which local clone should I use?" — diff reconstruction and full-file
  expansion need it.
- Use `gh pr view <id> --json number,title,url,headRefName,baseRefName,additions,deletions,changedFiles`
  to get PR metadata. Use `gh pr diff <id>` to get the unified diff.

### 2. Determine context

If the user supplied context (paths, URLs, free text) in their invocation,
use it. Otherwise ask **once**, short:

> What context should I use for this review? Paste links, paths, or describe
> where the relevant info lives. Reply 'none' to proceed with just the diff.

`'none'` is valid — Annai works with no context, just better with it. Common
context sources: Katachi specs, Notion pages, design docs, transcripts,
GitHub issue threads, the PR body itself.

### 3. Generate `surface.json`

Follow the shape in `references/surface.schema.json`. The example at
`references/surface-example.json` shows a concrete minimal surface — mimic
its shape, not its content.

Hard constraints:

- **Hunks must reproduce the actual PR exactly.** No fictional diff lines.
  Pull them from `gh pr diff` and convert into the typed `Hunk[]` shape
  (header + lines with `kind`/`oldLine`/`newLine`/`content`).
- **All annotations must be grounded** in the diff or the supplied context.
  No speculation. If the doc says X and the code does Y, that's a
  `discrepancy` annotation — surface it explicitly.
- **Every annotation must teach.** Density is fine — narrative isn't.
  Don't restate what the diff already shows or what an attentive reader
  would catch in passing. Each annotation should answer one of: *why does
  this exist*, *what's easy to miss*, *what should the reviewer verify*,
  *what's inconsistent*. If you can't say which, cut it.
- **Order for comprehension.** Group `kind` is one of `base-context`,
  `entry-point`, `supporting`. Put base-context groups first **only when
  load-bearing** (new abstractions, data models). Then entry points (HTTP
  handlers, webhooks, background triggers, CLI commands — the points a
  user or system *triggers*, not where code is *wired up*). Then supporting
  code.
- **Annotation kinds.** Each kind names a different *job* the annotation
  does for the reviewer. Pick by intent, not by shape.
  - `pattern` — name a recurring shape so the reviewer can match it once
    and stop re-reading.
    - *Good*: "Default `'immediate'` preserves existing behaviour — every
      existing row reads this value after the migration, which is what
      every call site expects when the column is absent."
    - *Bad*: "This adds a new column."
  - `note` — the **why**: purpose, constraint, hidden invariant, or
    non-obvious consequence. Never a description of *what* the code does.
    - *Good*: "Branch maps 1:1 to the migration's CHECK constraint — a
      fourth mode would need this switch and the constraint to move in
      lockstep."
    - *Bad*: "Calls the API and parses the response."
  - `question` — something the *reviewer* should ask the author (or
    themselves) before approving. Not a rhetorical aside.
    - *Good*: "The `deferred` branch returns 202 without enqueueing — who
      picks these up later? If nothing does, it's a black hole."
    - *Bad*: "What does this function do?"
  - `surface-check` — a verification target: "look here for X."
    - *Good*: "`runTransition` and `enqueueTransition` are newly exported
      — check whether anything actually consumes the export or it can
      drop."
    - *Bad*: "Check this code."
  - `discrepancy` — a doc-vs-code mismatch you can name. The doc source
    must be specified and the mismatch concrete.
    - *Good*: "Scope doc (`docs/transition-scheduling.md`) describes the
      body as `{ advance_at: ISO8601 }`, but the handler reads
      `req.body?.scheduled_for`. One of them is wrong."
    - *Bad*: "Doesn't match the docs."
- **Suggestions vs annotations.** Annotations are for the reviewer's
  understanding (never sent to the PR). Suggestions are for things the
  reviewer might want to raise *on the PR* — phrased as proposed changes
  or questions for the author. Use `suggestionCode` when proposing a code
  change. **v0.2 UX:** suggestions render inline with "Accept as draft" and
  "Dismiss" buttons; accepting promotes a suggestion into a real draft
  comment that goes out with the review.
- **Mermaid diagrams** where they aid understanding: ERD for new tables,
  sequence for API flows, state diagram for lifecycles, flowchart for
  branching logic. PR-level diagrams go on `surface.diagrams`; group-scoped
  diagrams go on the relevant group.

Write the surface to the session dir before starting the daemon:

```
${XDG_RUNTIME_DIR:-${TMPDIR:-/tmp}/annai-$UID}/annai/sessions/<id>/surface.json
```

Pick a short session id (e.g. `review-<pr-number>` or a 6-char nonce).

### 4. Launch the session

```bash
"${CLAUDE_PLUGIN_ROOT}/skills/review/scripts/annai.sh" start \
  --surface "<path-to-surface.json>" \
  --session "<session-id>" \
  --repo "<local-repo-path>"
```

Bootstrap (`npm install`) runs on first invocation inside the script —
don't pre-install. Capture `{sessionId, url}` from stdout.

### 5. Report to the user and start watching

Tell them the URL and how the flow ends:

> Surface ready: <url>
>
> Draft comments inline / per-file / at the PR level, then hit Approve or
> Comment when you're ready, or Dismiss session if you want to bail. I'll
> push the review to GitHub once you submit.

Then run `annai.sh watch` under `Monitor` so the agent reacts to events
without polling:

```bash
"${CLAUDE_PLUGIN_ROOT}/skills/review/scripts/annai.sh" watch \
  --session "<session-id>"
```

`watch` is quiet until the reviewer acts. The line-delimited events it
emits to stdout are the ones the agent must handle (everything else —
`comment-drafted`, `comment-edited`, etc. — stays browser-side and never
wakes the agent).

### 6. React to events

- `review-submitted` (`{ decision: "approve" | "comment", commentCount }`)
  → go to step 7.
- `session-aborted` (`{ reason }`) → report a clean cancellation to the
  user. `reason: "dismissed-by-reviewer"` means the reviewer hit Dismiss
  session; other reasons are browser-close / `stop` / signals. **Don't**
  call `submit` — there's nothing to send. The daemon has already exited;
  no `stop` needed.
- `daemon-error` (`{ message }`) → report the failure to the user. If
  possible, run `annai.sh status --session <id>` for diagnostics.

### 7. Submit the review

```bash
"${CLAUDE_PLUGIN_ROOT}/skills/review/scripts/annai.sh" submit \
  --session "<session-id>"
```

`submit` fetches the result via IPC, queries the PR's node id + head
commit OID via `gh api graphql`, runs `addPullRequestReview` (line + range
threads + PR body), runs `addPullRequestReviewThread` once per file-level
draft (`subjectType: FILE`), then `submitPullRequestReview` with the
matching event. Output is a single JSON line:

```json
{"sessionId":"…","reviewUrl":"https://github.com/…/pull/…#pullrequestreview-…","state":"APPROVED","decision":"approve","commentCount":4}
```

Report the URL to the user.

### 8. Cleanup

```bash
"${CLAUDE_PLUGIN_ROOT}/skills/review/scripts/annai.sh" stop \
  --session "<session-id>"
```

Skip this if the watch event was `session-aborted` — the daemon already
shut down.

## References

- `references/surface.schema.json` — the JSON schema for `surface.json`.
- `references/surface-example.json` — a minimal, concrete example you can
  mimic the shape of.
- Project docs: `docs/code-review-surface.md` (idea + shape) and
  `docs/annai-architecture.md` (full runtime design, including the
  interactive flows deferred past v0.1).
