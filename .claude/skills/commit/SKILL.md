---
name: commit
description: Bump the plugin version, decide whether the change warrants README/CLAUDE.md updates, commit the change as a conventional-commits feature commit and the version bump as a separate chore commit, then push. Use when the user asks to "commit", "ship", "bump and push", or "land" the current working-tree changes.
disable-model-invocation: true
---

# commit

Wrap up the current working-tree changes as a release on `master`: feature
commit + version bump commit + push. Annai ships as a Claude Code plugin,
so every user-visible change to the plugin gets a patch bump in
`.claude-plugin/plugin.json`.

## When to use

The user says "commit", "ship it", "bump and push", "land this", or
otherwise asks to wrap up the in-progress change. Do not run this skill
mid-task — only after the user has confirmed the change is done.

## Procedure

### 1. Survey the change

Run these in parallel:

- `git status` — what's modified, what's untracked
- `git diff` — staged + unstaged changes
- `git log --oneline -10` — recent commit style and last version bump

Skim the diff. Two questions to answer before committing:

1. **What conventional-commits type fits?** `feat` for new behavior the
   reviewer notices, `fix` for bug fixes, `chore` for tooling/version
   bumps, `docs`, `refactor`, `build`, `test`, `style`. If the change
   touches the frontend, the scope is usually `(frontend)`.
2. **Does this warrant a README / CLAUDE.md update?** Compare the change
   against the level of detail those files already document. The bar is
   high — small visual tweaks and internal refactors do not belong in
   either doc. Update README only if the change adds/removes a documented
   capability or changes documented usage. Update CLAUDE.md only if it
   changes a key invariant, the layout, or the dev workflow it already
   describes. If unsure, check what previous commits of similar size did
   (look at the diff of the last `feat(frontend)` commit — did it touch
   the docs?). When in doubt, skip the doc update.

If a doc update *is* warranted, make it now and include it in the feature
commit (not the version bump commit).

### 2. Bump the version

Read `.claude-plugin/plugin.json`, increment the patch number
(`0.1.N` → `0.1.N+1`). Default to patch — bump minor only if the user
explicitly asks or the change is large enough that they call it out.

The app's `skills/review/scripts/app/package.json` version is intentionally
**not** kept in lockstep — leave it alone unless the user says otherwise.

### 3. Commit the feature

Stage only the feature files (and any doc updates from step 1) — **not**
`plugin.json`. Use the conventional-commits subject and a short body
explaining the *why* (one paragraph max). Always include the co-author
trailer from the user's global instructions:

```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

Pass the message via HEREDOC so newlines are preserved.

### 4. Commit the version bump

Stage `.claude-plugin/plugin.json` and commit separately:

```
chore: bump plugin version to <new-version>
```

The two-commit split is the established style in this repo (see
`f724bd2`, `e23a5b2`). Keep it.

### 5. Push

`git push` — to the tracked branch, no force, no `--no-verify`. If the
push fails, surface the error to the user rather than retrying with
flags.

### 6. Report

Brief summary back to the user: the two commit SHAs and what was pushed.

## Notes

- Never run `git add -A` or `git add .` — stage by explicit path so that
  unrelated dirty files (test artifacts, scratch notes) don't sneak in.
- Never amend a published commit. Once pushed, it's done; further fixes
  are new commits.
- If `git status` is clean, stop and tell the user there's nothing to
  commit.
- If the change is large enough that splitting it into multiple feature
  commits would help reviewers, ask the user how they want to slice it
  before proceeding.
