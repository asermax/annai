# Annai (案内) — Claude Code Code Review Surface

Turn a code review into a guided browser surface. An agent skill generates
a structured, ordered view of a pull request — base context first, then
entry points, then supporting code — with typed side notes, inline
suggestions, and mermaid diagrams. A local server renders it.

![Annai v0.1 surface rendered from the bundled example](./docs/screenshots/surface-v0.1.png)

## Why

Reviewing a PR you don't already have the context for is mostly assembly
work: jumping between Notion, Slack threads, design docs, and the diff
just to build a mental model before you can judge anything. Annai moves
that assembly into an agent step and hands the reviewer a surface that
explains the *why* alongside the *what* — in the order that makes sense.

Read the long form in [`docs/code-review-surface.md`](./docs/code-review-surface.md);
the runtime design lives in [`docs/annai-architecture.md`](./docs/annai-architecture.md).

## Status — v0.1 (read-only)

What works:

- The `review` skill walks the agent through generating `surface.json`
  from a PR + arbitrary context.
- A local daemon serves a React frontend (diff rendering via `diff2html`,
  diagrams via `mermaid`).
- All the daemon scaffolding for the live interactive flow — unix-socket
  IPC, typed event bus with watch filter, atomic state checkpoints — is
  already wired, so v0.2 fills in handlers rather than rewriting plumbing.

Not yet:

- Drafting comments, asking the agent questions inline, submitting the
  review back to GitHub. The `watch`, `reply`, and `result` CLI
  subcommands exist as stubs that exit with
  `"not yet implemented in v0.1"`.

## Install

From the `asermax-plugins` marketplace:

```
/plugin marketplace add asermax/claude-plugins
/plugin install annai@asermax-plugins
```

Or point Claude Code directly at this repo.

## Usage

From any Claude Code session in the repo you want to review:

```
/annai:review <PR url or number>
```

The skill will:

1. Resolve the PR + repo path, asking for a local clone if it's
   ambiguous.
2. Ask once for context (Notion pages, design docs, transcripts,
   anything — or `'none'` to proceed with just the diff).
3. Generate `surface.json` grounded in the diff and the supplied
   context.
4. Start the local server, open your browser, and tell you the URL.
5. Stop the daemon when you say you're done.

## How it works

```
agent → annai.sh start ──► detached daemon ──► browser at 127.0.0.1:<port>
                                │
                                ├── http: GET /api/surface
                                ├── unix socket: command frames (status, stop)
                                └── state: surface.json, state.json, events.log
```

- The agent never speaks HTTP — only `annai.sh` subcommands over a unix
  socket.
- The daemon binds 127.0.0.1 with an auto-picked port and writes its
  state to `$XDG_RUNTIME_DIR/annai/sessions/<id>/` (falling back to
  `${TMPDIR:-/tmp}/annai-$UID/...`).
- Diffs in `surface.json` reproduce the actual PR verbatim. Annotations
  must be grounded in the diff or supplied context.

## Development

```sh
cd skills/review/scripts/app
npm install
npm run build           # tsc + vite
npm test                # vitest
npm run gen:schema      # regenerate references/surface.schema.json from zod
```

Manual smoke against the bundled example surface:

```sh
./skills/review/scripts/annai.sh start \
  --surface ./skills/review/references/surface-example.json \
  --session smoke1
# → opens the browser at http://127.0.0.1:<port>/
./skills/review/scripts/annai.sh stop --session smoke1
```

More dev notes — layout, key invariants, dogfood targets — live in
[`CLAUDE.md`](./CLAUDE.md).

## Name

案内 (*annai*) — "guidance, showing the way". The core action is guiding
the reviewer through the code in the right order to comprehend it.

## License

MIT.
