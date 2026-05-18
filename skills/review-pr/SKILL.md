---
name: review-pr
description: Generate a guided code-review surface for a GitHub pull request and open it in the browser. Produces an ordered, annotated JSON view of the diff (base context first, then entry points, then supporting code) with typed side notes, inline PR suggestions, and mermaid diagrams; then launches a local server that renders it, and on submit pushes the review to GitHub via three GraphQL mutations. Trigger phrasings: "review this PR", "prep PR #N for review", "help me review <github-url>", or an explicit `/annai:review-pr` invocation.
---

# Annai review — PR mode

Entry point for reviewing a GitHub pull request. The mode-specific steps are inlined below; for everything else (surface authoring rules, launch, watch, react, cleanup) load the `annai:review` skill — it owns the shared procedure. When the shared procedure says "this step is mode-specific", come back here.

## Step 1 — Determine PR + repo path

- The user's invocation gives you either a PR URL, a PR number, or "the current branch".
- Resolve the local repo path. If the user gave a URL or unclear identifier, ask: "Which local clone should I use?" — diff reconstruction and full-file expansion need it.
- Use `gh pr view <id> --json number,title,url,headRefName,baseRefName,additions,deletions,changedFiles` to confirm PR metadata exists and you can read it. The scaffold step re-runs this for you; you don't need to plumb the JSON through by hand.
- Use `gh pr diff <id>` if you want to skim before scaffolding; otherwise let `surface scaffold` fetch it.

## Step 3a — Scaffold

```bash
"${CLAUDE_PLUGIN_ROOT}/skills/review/scripts/annai.sh" surface scaffold \
  --pr <n> --repo <path-or-slug> --out <session-dir>/surface.json
```

`--repo` accepts either a GitHub `OWNER/REPO` slug **or** a local clone path (the slug is resolved via `gh repo view` inside that directory). The local path goes into `surface.repo.path` so the daemon can find the working tree.

Fetches PR metadata via `gh pr view`, parses every file's hunks from `gh pr diff`, and writes a schema-valid skeleton with `subject: { kind: 'pr', ... }`, one `unsorted` supporting group containing every changed file, and empty `tldr` / `reviewPrompts` / `diagrams` / per-diff `annotations` / `suggestions`. Each diff gets a stable id like `diff-src-foo-ts` you'll reference in later commands.

## Step 5 — Finish-line message

When you tell the user the surface URL, end with:

> Draft comments inline / per-file / at the PR level, then hit Approve or Comment when you're ready, or Dismiss session if you want to bail. I'll push the review to GitHub once you submit.

## Step 7 — Submit the review

On `review-submitted`:

```bash
"${CLAUDE_PLUGIN_ROOT}/skills/review/scripts/annai.sh" submit \
  --session "<session-id>"
```

`submit` fetches the result via IPC, queries the PR's node id + head commit OID via `gh api graphql`, runs `addPullRequestReview` (line + range threads + PR body), runs `addPullRequestReviewThread` once per file-level draft (`subjectType: FILE`), then `submitPullRequestReview` with the matching event. Output is a single JSON line:

```json
{"sessionId":"…","reviewUrl":"https://github.com/…/pull/…#pullrequestreview-…","state":"APPROVED","decision":"approve","commentCount":4}
```

Report the URL to the user.
