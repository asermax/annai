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

## v0.1 scope (read this before you start)

This iteration is **read-only**: you generate a `surface.json`, the daemon
serves it in a browser, and that's it. The interactive flow — ask-agent
threads, draft comments, submitting the review via `gh` — is **not yet
implemented**. Do not promise the user that their drafts or "ask agent"
clicks will reach the PR; tell them v0.1 is for reading. Adding those flows
is tracked in `docs/annai-architecture.md`.

CLI subcommands `watch`, `reply`, and `result` exist but exit with
`"not yet implemented in v0.1"` — don't call them.

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
- **Order for comprehension.** Group `kind` is one of `base-context`,
  `entry-point`, `supporting`. Put base-context groups first **only when
  load-bearing** (new abstractions, data models). Then entry points (HTTP
  handlers, webhooks, background triggers, CLI commands — the points a
  user or system *triggers*, not where code is *wired up*). Then supporting
  code.
- **Annotation kinds**: `pattern` (a recurring shape worth naming), `note`
  (explanation of what the code is/does), `question` (something to ask the
  author or yourself), `surface-check` (look here for X), `discrepancy`
  (doc-vs-code mismatch).
- **Suggestions vs annotations.** Annotations are for the reviewer's
  understanding (never sent to the PR). Suggestions are for things the
  reviewer might want to raise *on the PR* — phrased as proposed changes
  or questions for the author. Use `suggestionCode` when proposing a code
  change.
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

### 5. Report to the user

Tell them the URL and that v0.1 is read-only:

> Surface ready: <url>
>
> v0.1 is read-only — the page is for reading, not for queuing comments or
> submitting back to the PR. When you're done, say so and I'll stop the
> daemon.

### 6. Cleanup

When the user signals they're done:

```bash
"${CLAUDE_PLUGIN_ROOT}/skills/review/scripts/annai.sh" stop --session "<session-id>"
```

## References

- `references/surface.schema.json` — the JSON schema for `surface.json`.
- `references/surface-example.json` — a minimal, concrete example you can
  mimic the shape of.
- Project docs: `docs/code-review-surface.md` (idea + shape) and
  `docs/annai-architecture.md` (full runtime design, including the
  interactive flows deferred past v0.1).
