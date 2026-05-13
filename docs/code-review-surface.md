---
domain: developer-tools
maturity: evergreen
date: 2026-04-29
last-iterated: 2026-05-13
tags: [skill-idea, code-review, tool]
---

# Code Review Surface

**Name:** Annai (案内 — guidance, showing the way). Chosen because the core action is guiding the reviewer through the code in the right order to comprehend it. Reserved for when the idea graduates into a real implementation; this idea note keeps the descriptive `code-review-surface` slug.

## The Itch

Getting a lot of code reviews where I lack context on the feature being changed. Whether it's agent PRs from Zenki (where context lives in Katachi specs/designs), or PRs from coworkers (where context lives in Notion, Jira, Slack threads, or just in someone's head), the pattern is the same: I spend most of the review time manually piecing together the "why" before I can even start judging the "what". That assembly work is the bottleneck, and it's the same bottleneck regardless of where the context originally lives.

## What I Want

A tool that takes a code review (GitHub PR, local diff, etc.) and produces a surface that makes the review easier to do effectively — **agnostic to where the context comes from**. The context could be Katachi spec files, Notion pages, GitHub issues, design docs, a transcript, or nothing at all — the surface should be useful in any of those cases, and better when more context is available.

### Key Properties

- **Composable context sources** — pluggable inputs so it works whether context lives in Katachi, Notion, GitHub, a local doc, or anywhere else; other skills/tools can be chained in to fetch context
- **Ordered for comprehension** — not alphabetical file list, but ordered so you follow the flow. An *entry point* is where the user or system starts interacting: API endpoints, webhook handlers, background task triggers, CLI commands. Not "where something is wired up".
- **Base context first when needed** — for PRs that introduce new abstractions (data models, new concepts), surface that base before the entry-point flow so the rest reads naturally
- **Two tiers of annotation** — *group notes* (on top of a related set of diffs, full-width) for "what these changes are about", and *per-diff notes* (right column, narrower) for diff-specific context, questions, or observations
- **Draft PR comments** — reviewer can leave queued comments on the surface that get sent to the PR when ready (`@pierre/diffs` provides the diff rendering and comment-overlay primitives)
- **Full-file expansion** — every diff offers expansion to the surrounding file content, reconstructed from the local repo clone
- **Same diff shown multiple times** is fine when it aids understanding (e.g. data model shown once in base context, again as a reminder when a downstream endpoint depends on its shape)
- **Graceful degradation** — works with zero external context (just the diff), and gets richer as more context is wired in
- **Full PR coverage** — every file is addressable in the surface; prototype can show samples but the final product handles all of them

### Shape (as of v02)

Single browser-hosted HTML page, full width.

- **Top**: minimal PR header (title, branch, stats, TL;DR). No big context panel — the reviewer already knows where context lives.
- **Body**: ordered "groups", each a comprehension unit. Each group has:
  - A full-width group note above the diffs
  - One or more two-column review rows: GitHub-style diff on the left (wider), notes on the right (narrower)
  - Per-line hover-reveal affordance to add a comment
  - "View full file" affordance per diff
- **Notes column**: subtle styling (colored left border, no card background). Note types: *Pattern / Note / Question / Surface check / Discrepancy*. Draft PR comments rendered as small yellow blocks with edit/resolve/send actions.
- **Reading order** is opinionated and entry-point-driven. Base context first when needed; then entry points; then internal supporting code.

## Decisions made

- **Delivery format**: browser-hosted HTML page. (Resolves the original "browser vs PDF" question.)
- **Don't surface context sources as UI** — context informs annotations but isn't a panel/card. The reviewer doesn't need to be shown where context came from.
- **Diff fidelity**: diffs render exactly as GitHub does. No inline commentary mixed into the diff body. Annotations live in the side column.
- **Local repo access is required**. The surface reads source files locally (paths like `~/workspace/asermax/tachikoma`, `~/workspace/filadd/scheduler-api`) to enable full-file expansion and richer annotation.
- **Annotation library**: `@pierre/diffs` (Apache-2.0) provides the diff rendering plus comment-overlay primitives.
- **Organizational**: idea + prototypes live in `02_Areas/Ideas/code-review-surface/` subfolder. Markdown note still appears in the Ideas Base (recursive `inFolder`), HTML prototypes don't clutter (filtered by `file.ext == "md"`).

## Two kinds of in-surface annotation

Refined distinction (from v03 onwards):

- **Side notes** (narrow column, *left* of the diff, aligned to specific line ranges): explanatory content for the reviewer's own understanding — what a piece of code is, how it fits, what to watch for. Never goes to the PR. Types: *Pattern / Note / Question / Surface check / Discrepancy*. Multiple side notes whose line ranges overlap bunch up as collapsed title chips; clicking expands the full note and highlights the corresponding line range in the diff.
- **Inline PR suggestions** (yellow blocks inserted into the diff body, GitHub-style): proposed changes or questions the reviewer might want to raise *on the PR*. Reviewer can accept (queued for batch-send), edit, or dismiss. Accepted ones are sent to the PR as suggestions/comments.

This separates "stuff I'm thinking about while reading" from "stuff I want the author to see".

## Architecture — live server + skill

> Full runtime design (component, state, sequence + class diagrams; plugin layout; CLI surface; event protocol; skill responsibilities; testing strategy) lives in [[annai-architecture]].

The surface should not be a static HTML generator. It should be a **live server** paired with an agent skill, modeled after [plannotator](https://github.com/backnotprop/plannotator).

- **Server** hosts the generated surface for a given PR. Long-lived enough for the reviewer to interact with.
- **Skill (agent side)** connects to the server and receives interaction events (clicks, agent-asks, comment submissions).
- **Reviewer interactions from the page**:
  - Add a draft PR comment (queued for batch send to the PR)
  - Apply / edit / dismiss inline suggestion blocks (accepted ones queue for batch send)
  - **Ask the agent** about a specific line, hunk, side note, or suggestion — get an interactive expansion in-page
- **Why live and not static**: a static surface answers only pre-anticipated questions. A live agent answers the questions that come up *while reading the code*. This is the killer feature.

## Agent prompt (early sketch — to be iterated)

The surface is generated by an agent run on demand. The prompt should specify:

- **Inputs**:
  - PR identifier (URL, or branch + repo path)
  - Local clone path (e.g. `~/workspace/asermax/tachikoma`, `~/workspace/filadd/scheduler-api`) for diff reconstruction, file expansion, and code reading
  - Context sources — composable, can come from upstream skills (Notion fetch, transcript summarizer, Katachi phase-artifact reader, etc.)
- **What to generate**:
  - PR header (title, branch, stats, **TL;DR derived from spec + diff** — not just the PR body)
  - Group structure: base context first when load-bearing, then entry points (HTTP / webhook / CLI / background task), then internal supporting code
  - Group notes (full-width prose above each group) — *what this section is about, why it exists*
  - Reading order within each group
  - Per-diff side notes typed (Pattern / Note / Question / Surface check / Discrepancy)
  - Inline PR suggestion blocks for items worth raising on the PR
  - Mermaid diagrams where they aid understanding — ERD for new tables, sequence for API flows, state diagram for lifecycle, flowchart for branching logic
  - Optional PR-level review prompts
- **Constraints**:
  - Diffs are reproduced exactly from the actual PR — no fictional code in the diff body
  - All annotations grounded in either the diff or the context sources — no speculation
  - **Doc-vs-code discrepancies flagged explicitly** (high-value signal; see Filadd's missing `scheduling_mode`)
  - Distinguish side notes (reviewer's understanding) from inline suggestions (PR-bound)
- **Output format**: structured JSON (or similar) the renderer consumes — separates diff content from annotation content. Concrete shape TBD.

## Prototype iterations

- [Prototype v01](prototype-v01.html) — initial shape exploration. Both Tachikoma and Filadd PRs. Featured a context rail with typed cards and inline diff annotations.
- [Prototype v02](prototype-v02.html) — applied feedback: full-width layout, two-column rows, clean GitHub-style diffs, group + per-diff notes, draft comments, full-file expansion affordance, entry-point-driven reading order. Grounded in real Filadd PR #323 diffs.
- [Prototype v03](prototype-v03.html) — notes column moved to the left, aligned to specific line ranges with overlap-bunching. Removed top TOC and per-diff action buttons (view-full-file, copy-path) — context expansion happens via in-diff expand indicators. Mermaid diagrams introduced (ERD, sequence). Distinction between side notes (left column) and inline PR suggestions (yellow blocks inside the diff). "Ask agent" affordance on every note as a stub for the live-server interaction.
- [Prototype v04](prototype-v04.html) — chrome and interaction refinements:
  - **Top nav** now carries PR-level actions: `Approve` and `Comment (N)`. The N badge tracks drafts queued in the session.
  - **Floating outline nav** on the right edge — Notion-style minimap: compact dashes by default, expands to a labeled outline (with icons) on hover.
  - **Line-hover "+" affordance restored**: hover any diff line, click "+", get an inline editor with two tabs — *Ask agent* or *Comment for PR*.
  - **"Ask agent" buttons on notes are now hover-only** to reduce visual noise.
  - **Suggestion blocks reframed as "Draft comments"**: accepting adds them to the comment queue (counter increments). The optional `suggestion` block inside renders as a labeled snippet that would become a GitHub `\`\`\`suggestion` block in the actual comment.
  - **Expand-context UI standardized**: every expandable gap uses the same ↑ / ↕ / ↓ arrow trio (with disabled states at file boundaries).
  - **Agent interactions are inline** (not modals or popups): asking the agent — from a note, a draft, or the line editor — inserts a purple-bordered thread row directly into the diff at the relevant line. Threads support follow-up replies and can be closed.

## Observations from the prototype exercises

- **Group notes earn the surface its keep** more than per-diff annotations. A short prose paragraph framing "this section is about X, here's the bigger context" lets the reviewer enter each diff with the right model. Per-diff notes are useful but secondary.
- **Doc-vs-code discrepancies surface naturally** when annotations reference the scope/design. In Filadd PR #323, the scope doc promises a `scheduling_mode` column that isn't actually in the diff — exactly the kind of thing the surface should make obvious without effort.
- **The "entry point" definition matters a lot.** v01 initially shaped Tachikoma's reading path around the MCP registry (wiring); the actual entry points are the MCP tool invocations and the background watchers. The reading path is much clearer when entries are user/system trigger points, not setup points.
- **Per-PR composition of context sources varies wildly.** Tachikoma carries all its context in the PR body (Katachi phase artifacts that get deleted on land). Filadd has zero in the PR body and pulls from Notion (scope + design docs) + 21 local recording transcripts + a 60k-token agent state file. The composition model needs to handle both.
- **Same diff shown twice worked well** in the v02 advance-endpoint group, reminding the reviewer of the transition model's `unique=True` constraint that makes the empty payload sensible. Worth doing where it pays off, sparingly.

## Open questions

- How does the notes column track for very long diffs (hundreds of lines)? v03 uses absolute positioning aligned to the line range, which works for moderate-sized diffs — needs validation on huge ones.
- Bunched-note UX: when many notes touch overlapping ranges, the collapsed-chip cluster needs a sensible expansion behavior (cascade open? push siblings down? scroll into view?).
- Where do PR-level review prompts ("what should I look for across this whole PR?") live — top of page, end, distributed? They felt valuable in v01 but didn't fit the per-group structure.
- Draft PR comment / inline suggestion UX: threading, bulk-send-to-PR, resolved state, edit-after-send, and the relationship between dismissed suggestions and persisted reviewer state across regenerations.
- "Ask the agent" interaction model — modal? sidebar? inline thread? Should it be scoped to the line / hunk / note it was triggered from?
- Source summarization is its own subproblem (60k state files, 21 transcripts can't go in raw). **This is where composability with other skills gets real teeth** — a "summarize transcripts" skill feeds the surface generator.
- Output format the agent produces — structured JSON consumed by the renderer? Mermaid diagrams embedded as source strings or pre-rendered? Concrete schema TBD.
- Server architecture — websocket for live agent interaction? Process-per-PR or shared? Hosted where (local-only first, then…?).
- Relationship to the older "review server" skill idea — likely subsumed by this one.

## Related

- [[annai-architecture]] — full runtime architecture design for the implementation
- plannotator — annotation tool, may be replaced or complemented
- share-markdown — earlier rendering pipeline; this surface likely doesn't build on it
- `@pierre/diffs` — diff-rendering library used in the implementation
- Review server idea (older, in skill-ideas.md) — likely subsumed by this
