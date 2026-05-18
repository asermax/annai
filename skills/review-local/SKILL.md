---
name: review-local
description: Generate a guided code-review surface for code an LLM agent (or the user) just produced locally — no GitHub PR. Produces an ordered, annotated JSON view of the local diff (git working tree or branch vs base) with typed side notes, inline suggestions, and mermaid diagrams; then launches a local server that renders it, and on finish saves the reviewer's feedback as result.json for the agent to read back. There is no Approve action in this mode — the only positive terminus is **Finish review**, which persists the reviewer's drafts as `result.json`. Trigger phrasings: "review what I just changed", "review this branch", "review the agent's draft", or an explicit `/annai:review-local` invocation.
---

# Annai review — local-agent mode

Entry point for reviewing local agent work. No GitHub PR. Reviewer feedback lands as `result.json` for the agent to consume — there's nothing to push to a remote. The mode-specific steps are inlined below; for everything else (surface authoring rules, launch, watch, react, cleanup) load the `annai:review` skill — it owns the shared procedure. When the shared procedure says "this step is mode-specific", come back here.

## Step 1 — Determine the diff source

In local-agent mode there is no GitHub PR. The diff comes from the working tree or a recent branch the agent (or human) has been working on. Decide which, in this precedence order:

1. **The user told you which** ("review my staged changes", "review the diff between `main` and HEAD", "review what I just changed in `src/foo`"). Follow that exactly.
2. **There are uncommitted changes** in the working tree. Use them. Run `git status --porcelain` inside the repo; if it shows any entries, capture the diff with `git diff HEAD > /tmp/local.diff` (this picks up both staged and unstaged work in one shot).
3. **The branch has diverged from its base.** Resolve the base ref: try `git symbolic-ref --short refs/remotes/origin/HEAD` to find the remote default branch; fall back to `main` (then `master`) if that fails. Capture the diff with `git diff <base>...HEAD > /tmp/local.diff`.
4. **Ambiguous** — e.g. there are uncommitted changes but they look unrelated to whatever the user asked you to review, or there's nothing diverged and no working-tree changes either. Don't guess: call `AskUserQuestion` with the candidate sources as options, and re-enter Step 1 with the answer.

Decide a short subject title (one phrase, ~60 chars) summarizing the change — e.g. "Wire up scheduler retry path" or "Agent draft: add JWT validation". You'll pass this as `--title` to the scaffold.

## Step 3a — Scaffold

```bash
"${CLAUDE_PLUGIN_ROOT}/skills/review/scripts/annai.sh" surface scaffold-local \
  --repo <local-repo-path> \
  --diff /tmp/local.diff \
  --title "<your subject title>" \
  --base-ref "<base ref you diffed against, e.g. HEAD or main>" \
  --out <session-dir>/surface.json
```

`--branch` is optional and defaults to `git rev-parse --abbrev-ref HEAD` inside `--repo`. `--base-ref` defaults to `HEAD` when omitted (matches the `git diff HEAD` case); always pass it explicitly when you used a `<base>...HEAD` diff so the rendered header tells the reviewer what they're looking at.

The scaffold writes a schema-valid skeleton with `subject: { kind: 'local', title, branch, baseRef, stats }`, one `unsorted` supporting group containing every changed file, and empty `tldr` / `reviewPrompts` / `diagrams` / per-diff `annotations` / `suggestions`. Each diff gets a stable id like `diff-src-foo-ts` you'll reference in later commands.

`scaffold-local` does not shell out to `gh`. The agent owns the git invocation that produced the diff.

## Step 5 — Finish-line message

When you tell the user the surface URL, end with:

> Draft notes inline / per-file / at the top of the review, then hit Finish review to save your feedback or Dismiss session to throw it away. I'll pick up your notes once you finish.

There's no Approve button in this mode — the only positive action is Finish review, which persists the drafts as `result.json` for the agent to read back.

## Step 7 — Read the result

On `review-submitted`:

```bash
"${CLAUDE_PLUGIN_ROOT}/skills/review/scripts/annai.sh" result \
  --session "<session-id>"
```

`result` dumps the `result.json` payload as JSON — the drafts (line, range, file-level, and the overall body) the reviewer left. Translate those into agent-actionable notes for whatever the downstream work is: apply the corrections, file follow-up tasks, ask the user clarifying questions, etc.

Do **not** call `annai.sh submit` in this mode — it's a PR-only command and will refuse with a "use `annai.sh result` instead" message if you do.
