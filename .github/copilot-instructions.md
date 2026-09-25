# Copilot instructions for grill-with-ui

This repo is an [Agent Skill](https://agentskills.io): a grilling design interview rendered
on a local browser page instead of the terminal. It is deliberately tiny — one dependency-free
Node script (`server.mjs`), one HTML file (`page.html`), and `SKILL.md` (the prompt the host
agent follows). There is no package.json, no build step, and no linter; Node 20+ is the only
requirement.

## Commands

```sh
# Unit tests (the only fast check; covers all of server.mjs: new/serve/wait/url/sessions/pending/patch)
node --test test/server.test.mjs

# A single test, by name pattern
node --test --test-name-pattern "<substring of the test name>" test/server.test.mjs

# End-to-end page check (Playwright + Chromium against a real serve on a throwaway session)
PLAYWRIGHT_PKG=/path/to/node_modules/@playwright/test/index.mjs node test/page.e2e.mjs
# ...with @playwright/test installed next to the repo, simply:
node test/page.e2e.mjs

# Regression check for Visualize staleness/manual flows
PLAYWRIGHT_PKG=/path/to/node_modules/@playwright/test/index.mjs node test/manual-visual.e2e.mjs
```

Commands are POSIX shell; in PowerShell set `PLAYWRIGHT_PKG` with
`$env:PLAYWRIGHT_PKG = 'C:\path\to\node_modules\@playwright\test\index.mjs'` first.

Windows note (verified on this machine): the unit suite has two pre-existing failures —
`new: outside git the key comes from the cwd` asserts a POSIX-only path expectation, and
`serve: ready line` hangs indefinitely under the default `--test-timeout=0` (pass e.g.
`--test-timeout=30000` to surface it as a failure instead). The server CLI itself works on
Windows — `new`/`serve`/`url` plus a full send→restart cycle were exercised manually — so
when diagnosing, run targeted tests with `--test-name-pattern` rather than trusting a full
suite run.

Server CLI (used by tests and by the skill at runtime): see the comment block at the top of
`server.mjs` or the "Server commands" section of the README — `new`, `serve`, `sessions`,
`pending`, `wait`, `url`, `patch`. `GRILL_HOME` overrides `~/.grill-with-ui` (tests set it
to a temp dir; never touch the real one when experimenting).

Re-record the demo GIF with `node design/record-demo.mjs` (needs Playwright and `ffmpeg`).

A project-level Playwright MCP server is configured in `.vscode/mcp.json` (stdio via
`npx @playwright/mcp@latest`) for driving the grill page in a browser during development.
The `cmd /c npx …` wrapper there is Windows-shaped — VS Code's mcp.json has no
per-platform override keys, so on POSIX systems use `command: "npx"` directly with
`args: ["-y", "@playwright/mcp@latest"]`.

## Architecture

**Two files, split ownership — this is the core invariant** (locked decision Q2 in
`docs/design.md`):

- `state.json` is written **only by the agent**, and only through `node server.mjs patch`,
  never by a file-write/edit tool. The patch merges only what changed; a whole-file rewrite
  would put ~60 KB of grown state into the agent's context on every Send. `patch` validates,
  stamps omitted timestamps, and swaps the file atomically.
- `events.jsonl` is appended **only by the server** (one line per Send), and the same line
  is printed to stdout — that stdout line is what wakes the host agent. The page appends
  nothing else; the agent never writes it.

Nobody writes the other's file, so there are no locks. Session state lives outside the repo
under `GRILL_HOME` (default `~/.grill-with-ui/sessions/<project-key>/<timestamp>/`), keyed
by the git common root so worktrees share sessions — nothing to gitignore.

`server.mjs` is both the HTTP server and the CLI. `serve` handles the page (poll of
`state.json`, `POST /send`, `/visual`, `/context`), appends the event, and acts as the
Monitor command.
Because most harnesses have no persistent Monitor, SKILL.md defines **wait mode**: the agent
keeps `node server.mjs wait --session DIR --after <handled>` in the foreground and loops on
exit 0 (a Send) / exit 3 (timeout → wait again). A running server does not wake a finished
agent turn; never treat "page is up" as "agent is listening".

`page.html` is a single self-contained file (inline CSS/JS, no framework, no network) that
polls `state.json`; staged answers live in the browser until Send and must survive reload.

`visual.html` (per session) is drawn by a **subagent** following `visual-brief.md` —
hundreds of lines of markup stay out of the interview's context. It renders in a sandboxed
iframe with no same-origin access: one file, inline everything, no CDN/fetch/external images
(only allowed URL is a Mermaid script tag). Questions are the source of truth; open
questions are drawn from their recommendation and marked "assumed".

Per-topic outputs group under `.grill-with-ui/<slug>/` (`design.md` + exported
`visual.html`); standing artifacts stay at the conventional locations (root `CONTEXT.md`,
`docs/adr/`).

The opt-in **domain-modeling mode** opens round 1 with a `q-domain` question ("Also keep
a glossary and ADRs?"); a yes stores a top-level `domainModeling: true` in state (absent
= off, reopen clears it). At Finish, when on, the agent also writes repo-root
`CONTEXT.md` (merged, never clobbered) and one ADR per answered durable question under
`docs/adr/`, per the sibling brief `domain-brief.md`. The design doc is written either
way, unchanged.

The header **Terms** panel merges live `state.terms` with the repo's `CONTEXT.md` —
fetched via read-only `GET /context` (no-store markdown; 404 `no context`/
`no project`/`no state`), parsed for the `## Language` section in page.html, session
wins collisions, provenance pills shown once ≥1 glossary entry parses; viewing is
independent of the session's domain-modeling mode.

## Key conventions

- **Patch semantics** (SKILL.md → "Patching state.json"): `null` deletes; `agent`/`visual`
  merge one level; `questions` merge one level by lowercase id (`q7`, never `Q7`); `thread`
  and `visual.queued` append; everything else replaces whole. Never include the current time
  — the server stamps what you leave out; an explicit time only wins when copied from a send
  line. `patch` prints one short summary JSON line, never the state.
- **Locked decisions don't get re-litigated**: the six in `docs/design.md` (browser surface,
  file split, server-as-monitor, single agent session, doc structure, sessions outside the
  repo) and the ones in `docs/visualize-design.md` (single self-contained HTML mechanism,
  questions as source of truth). Read these docs before proposing structural changes.
- **Use the repo's vocabulary** from the Terms sections of the design docs: *Send* (one
  press shipping every staged action as one event/turn), *round*, *frontier*, *staged
  action*, *durable decision*, *session folder* — and avoid their listed _Avoid_ words
  (batch, wave, submit, reply, ADR, …) — where ADR is banned only as a synonym for the
  decision concept (*durable decision* is the concept word); naming the artifact file
  (`docs/adr/0001-slug.md`, "one ADR per durable decision") is correct usage. Keep
  SKILL.md, README.md, and page UI strings consistent when wording changes.
- **`SKILL.md` is the product**: its YAML frontmatter `description` (the trigger phrase
  "grill with ui"), the listening-mode rules, and the state/send schemas at the bottom are
  the contract the page, server, and tests all implement — now including top-level
  `domainModeling` and `finished.context`/`adrs`, with `domain-brief.md` (the Finish-time
  docs formats) part of the same contract. Schema changes ripple through `validateState`
  in `server.mjs`, the page render code, `visual-brief.md`, and the tests — update all of
  them together.
- **Error/output contracts are tested**: CLI failures exit non-zero with exactly one stderr
  line and leave `state.json` untouched; successes print one short line (never the state);
  unknown subcommands print usage and exit 2. Keep this shape when adding commands.
- Commit messages follow a light conventional style scoped to the file
  (`docs(skill):`, `test(server):`, `no-mistakes(document):`).
