# Copilot instructions for grill-with-ui

This repo is an [Agent Skill](https://agentskills.io): a grilling design interview rendered
on a local browser page instead of the terminal. The installable skill lives in
`skills/grill-with-ui/` — one dependency-free Node script (`server.mjs`), one HTML file
(`page.html`), and `SKILL.md` (the prompt the host agent follows); root `plugin.json`
bundles it with the Copilot extension in `.github/extensions/grill-monitor/` (whose
`package.json` is metadata only) for `copilot plugin install arisng/grill-with-ui`, and
`.github/plugin/marketplace.json` registers the repo as its own marketplace. No
build step, no linter; Node 20+ is the only requirement.

## Commands

```sh
# The whole local gate — contract, issues, eval graders, unit, extension, browser suites
node scripts/ci.mjs            # or: task check
node scripts/ci.mjs --fast     # skip the browser suites (no Playwright needed)

# Enable the pre-push gate once (version-controlled hooks; git does not track .git/hooks)
task hooks:install             # git config core.hooksPath .githooks

# Unit tests (the fastest check; covers all of server.mjs)
node --test test/server.test.mjs

# A single test, by name pattern
node --test --test-name-pattern "<substring of the test name>" test/server.test.mjs

# grill-monitor extension tests (run from .github/extensions/grill-monitor; SDK stubbed, real wait CLI)
node --import ./test/register-sdk-stub.mjs --test test/extension.test.mjs

# End-to-end page check (Playwright + Chromium against a real serve on a throwaway session)
PLAYWRIGHT_PKG=/path/to/node_modules/@playwright/test/index.mjs node test/page.e2e.mjs
# ...with @playwright/test installed next to the repo, simply:
node test/page.e2e.mjs

# Regression check for Visualize staleness/manual flows
PLAYWRIGHT_PKG=/path/to/node_modules/@playwright/test/index.mjs node test/manual-visual.e2e.mjs

# Skill evaluation (waza) — readiness/schema check is offline, the benchmark needs an LLM
waza check skills/grill-with-ui
waza run evals/grill-with-ui/eval.yaml
waza quality skills/grill-with-ui

# Offline gate for the eval suite itself: proves each grader can pass AND fail
node scripts/check-evals.mjs

# Contract gate: the pipeline, ADR sections, verdict names and version still agree
node scripts/check-contract.mjs --verbose

# Plugin manifest validation (offline): lists the plugin with its components
copilot --plugin-dir . plugin list
```

Commands are POSIX shell; in PowerShell set `PLAYWRIGHT_PKG` with
`$env:PLAYWRIGHT_PKG = 'C:\path\to\node_modules\@playwright\test\index.mjs'` first.

`Taskfile.yml` (taskfile.dev) wraps these same commands: `task test`, `task test:ext`,
`task test:e2e`, `task check`, `task check:fast`, `task hooks:install`, `task lint:contract`,
`task lint:evals`, `task lint:issues`, `task ext-install` (copies the extension to
`~/.copilot/extensions/`), plus the server CLI (`new`/`sessions`/`serve`/`pending`) and
`task demo` for a seeded throwaway walkthrough. `task test` already skips the three

**CI is local only, by decision.** There is no `.github/workflows/` and none should be added:
`scripts/ci.mjs` is the gate, and `task hooks:install` points `core.hooksPath` at the
version-controlled `.githooks/` so `git push` runs `scripts/ci.mjs --fast` first (contract,
issue store, offline eval graders, sound cues, unit and extension tests — everything but the
browser suites, which stay a deliberate local run). A blocked push names the failing step and
offers `git push --no-verify` for a deliberate bypass. The three gates that keep this repo's
own rules true are `scripts/check-contract.mjs` (the pipeline, ADR sections, verdict names and
version agree across the contract files, and the removed `q-domain` question has not returned),
`scripts/check-evals.mjs` (every waza grader passes a good fixture **and** fails a bad one, so
no check is a no-op) and `scripts/check-issues.mjs` (the issue store and its tree are in sync,
portable — it replaces the issue-tracking skill's `pwsh` + `~/.agents` scripts). `task test` already skips the three
Windows-broken tests below, and `task test:e2e` normalises a raw Windows `PLAYWRIGHT_PKG`
path to a file URL.

Windows note (verified on this machine): the unit suite has three pre-existing failures —
`new: outside git the key comes from the cwd` asserts a POSIX-only path expectation, and the
two `serve:` tests (`ready line…` and `reuses the last port…`) never see their ready line, so
they hang under the default `--test-timeout=0` and time out under a finite one (pass e.g.
`--test-timeout=30000` to surface them as failures instead). `task test` skips exactly these
three; `task test:all` runs the full suite unfiltered. The server CLI itself works on
Windows — `new`/`serve`/`url` plus a full send→restart cycle were exercised manually — so
when diagnosing, run targeted tests with `--test-name-pattern` rather than trusting a full
suite run.

Server CLI (used by tests and by the skill at runtime): see the comment block at the top of
`skills/grill-with-ui/server.mjs` or the "Server commands" section of the README — `new`,
`serve`, `sessions`, `pending`, `wait`, `url`, `patch`. `GRILL_HOME` overrides
`~/.grill-with-ui` (tests set it to a temp dir; never touch the real one when
experimenting).

Re-record the demo GIF with `node design/record-demo.mjs` (needs Playwright and `ffmpeg`).

A project-level Playwright MCP server is configured in the root `.mcp.json`
(`mcpServers` entry, stdio via `cmd /c npx @playwright/mcp@latest`) for driving the grill
page in a browser during development. The `cmd /c npx …` wrapper there is Windows-shaped —
`.mcp.json` has no per-platform override keys, so on POSIX systems use `command: "npx"`
directly with `args: ["-y", "@playwright/mcp@latest"]`.

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
`state.json`, `POST /send`, `/visual`, `/glossary`), appends the event, and acts as the
Monitor command. Without a persistent Monitor, SKILL.md runs **Extension monitor**: the
grill-monitor extension keeps `node server.mjs wait --session DIR --after <handled>`
alive itself (exit 0 = a Send) and delivers each one to the chat with one `session.send`
— zero polling turns. A running server does not wake a finished agent turn; never treat
"page is up" as "agent is listening". If `grill_attach` is missing, SKILL.md v0.9.1 stops
at an installation gate — cleaning stale pre-plugin copies first, then running
`copilot plugin install arisng/grill-with-ui` — instead of improvising the old wait loop.

`page.html` is a single self-contained file (inline CSS/JS, no framework, no network) that
polls `state.json`; staged answers live in the browser until Send and must survive reload.

That file carries three responsive tiers: ≥1400px keeps the desktop three columns, 740–1399px
is two panes (260px rail + card) with the discussion in a right drawer, and ≤739px gives the
card the screen with the rail as a left sheet, the discussion a bottom sheet, and a thumb band
under the card (‹ / › plus a **Questions** opener that doubles as the position indicator). The
rail is 260px in every tier because that is the floor at which a long id plus the `updated`
badge fits. Two details are easy to reintroduce as bugs: off-screen sheets must be `fixed` (an
`absolute` panel parked off-screen extends the document's scrollable overflow and puts a
horizontal scrollbar on the page), and the media bounds end on `.98` because the layout
viewport is fractional under a scaled device pixel ratio, so an integer bound drops a tier one
pixel early. `#pager` is itself a `<nav>`, so rail selectors are scoped to `#nav`. Closed
sheets are `inert` + `aria-hidden`, and focus moves into a sheet on open and returns to its
trigger on close.

The header also carries a **theme** control beside Terms: one icon button cycling
System → Light → Dark. A tiny inline head script resolves the stored choice
(`localStorage` key `grill-theme`, deliberately outside the per-session key, and never in the
agent-owned `state.json`) to a concrete `data-theme` on `<html>` before first paint, and one
`:root[data-theme="dark"]` block restates every color token — so there is exactly one dark
block to keep in step. On ≤739px the button joins `#terms-toggle` and `#visualize` in the
`order: 1` control row. The theme covers the chrome only: the sandboxed `visual.html` keeps
the light palette it was drawn with, while the strip and `#visual-wait` surface around it
theme.

`visual.html` (per session) is drawn by a **subagent** following `visual-brief.md` —
hundreds of lines of markup stay out of the interview's context. It renders in a sandboxed
iframe with no same-origin access: one file, inline everything, no CDN/fetch/external images
(only allowed URL is a Mermaid script tag). Questions are the source of truth; open
questions are drawn from their recommendation and marked "assumed".

Per-topic outputs group under `.grill-with-ui/<yymmdd>-<slug>/` (`design.md` + exported
`visual.html`); standing artifacts stay at the conventional locations (`GLOSSARY.md`,
`docs/adr/`).

The **decision pipeline** runs at Finish, always — there is no opt-in question any more. A
source-compatible `domainModeling` key is still accepted (old sessions validate) and ignored.
The pipeline has five ordered stages and a decision may leave at any of them: **roster** (the
`durable` flag is a hint, never the filter — Finish re-derives from the answers, and a settled
exception or Verified fact may enter without ever being a question), **eligibility by subject**
(system shape, core stack or infrastructure, a cross-cutting standard, a deliberate exception,
a deprecation — product scope, UI/UX criteria, naming and bug fixes are out), **cluster**,
**split**, and **screen** as a tie-breaker only (the *delete this ADR* test measures how obvious
a decision is from the code, which is inversely related to its value — the biggest choices are
the most visible, so it cannot be the only gate). A group with no real alternatives gets no
record. At Finish the agent also writes
`GLOSSARY.md` (merged, never clobbered; a legacy `CONTEXT.md` is renamed on first
contact) and one ADR per surviving
decision in the ADR folder the brief picks — `docs/adr/`, or the matched bounded
context's own folder — per the sibling brief `domain-brief.md`. An ADR records a
decision, not a question: candidates that settle the same choice share one file,
and a decision the pipeline rejects gets none and stays a Locked decision in the
design doc alone. The design doc is written after the ADRs, so it can cite their
numbers; the glossary is written **before** the ADRs, because it fixes canonical vocabulary
and an ADR is immutable. The design doc is written either way, unchanged. Status is `Accepted`
unless the answer reserved approval, or unless the author fell back to `grill-with-ui` (no
`git config user.name`), which is `Proposed`; `Deprecated` is an allowed one-line Status
change. The glossary's location
resolves by rule: repo root normally; in a repo
with a `GLOSSARY-MAP.md` at its root, Finish parses the map (`server.mjs glossary
--session <session>` lists each bounded context's name, `GLOSSARY.md` path, folder and ADR
folder), matches the grill's topic to one context — asking the user when the match is
unclear — and writes the glossary and its ADRs inside that context.

Finish ends with a **spec readiness verdict** (`spec-brief.md`, invoked from SKILL.md): whether
an implementation spec is the next step. The plugin never writes a spec and its template is the
consuming repo's. The issue owns *what*, the spec *how*, an ADR *why*, the design doc *what was
decided here* — and acceptance criteria stay in the issue, referenced never restated. Three
outcomes in order: `not warranted` (small or reversible work, whatever the tracker holds),
`blocked` (the route is unsettled but no issue matches), `recommended` (unsettled route plus a
matching issue). The issue anchor is read from `.github/issue-tracker.json` — the
`issue-tracking` skill owns that schema, so read it and never write it.

The header **Terms** panel merges live `state.terms` with the glossary `GET /glossary`
resolves to —
fetched via read-only `GET /glossary` (no-store markdown; 404 `no glossary`/
`no project`/`no state`), parsed for the `## Language` section in page.html, session
wins collisions, provenance pills shown once ≥1 glossary entry parses; viewing is
independent of what the pipeline wrote.

## Key conventions

- **Patch semantics** (SKILL.md → "Patching state.json"): `null` deletes; `agent`/`visual`
  merge one level; `questions` merge one level by id, and ids are case-sensitive
  (`q7`, never `Q7`); `thread`
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
  (`docs/adr/0001-storage-layout.md`, "one ADR per significant decision") is correct
  usage. "Architecturally significant" is an adjective the ADR brief uses to screen
  durable decisions, not a second concept word — it gets no Terms entry of its own. Keep
  SKILL.md, README.md, and page UI strings consistent when wording changes.
- **`SKILL.md` is the product**: its YAML frontmatter `description` (the trigger phrase
  "grill with ui"), the listening-mode rules, and the state/send schemas at the bottom are
  the   contract the page, server, and tests all implement — now including the legacy
  `domainModeling` key (accepted, ignored) and `finished.glossary`/`adrs`/`pipeline`, with
  `domain-brief.md` (the Finish-time
  docs formats and the decision pipeline), `spec-brief.md` (the spec readiness verdict) and
  `adr-template.md` (the ADR shape `server.mjs adr` scaffolds) part of
  the same contract. Schema changes ripple through `validateState`
  in `server.mjs`, the page render code, `visual-brief.md`, and the tests — update all of
  them together.
- **Error/output contracts are tested**: CLI failures exit non-zero with exactly one stderr
  line and leave `state.json` untouched; successes print one short line (never the state);
  unknown subcommands print usage and exit 2. Keep this shape when adding commands.
- **The skill's behaviour is evaluated, not just described**: `evals/grill-with-ui/` holds a
  [waza](https://github.com/microsoft/waza) suite — one task per contract in `SKILL.md`
  (start, patch-only ownership, terminal answers, the decision pipeline, the spec readiness
  verdicts, Finish artefacts,
  the extension-attach monitor contract, routing) plus `trigger_tests.yaml`. `waza check skills/grill-with-ui` validates the spec offline; `waza run`
  drives a real agent and needs a model whose id matches `config.model`. Change a rule in
  `SKILL.md` and the matching task changes with it — the suite is the regression net for
  the prompt, next to the unit tests for the server.
- Commit messages follow a light conventional style scoped to the file
  (`docs(skill):`, `test(server):`, `no-mistakes(document):`).
- **This repo is a fork.** Upstream is `jasonku09/grill-with-ui` (git remote `upstream`);
  the method lineage is `mattpocock/skills` (not a git ancestor — the interview method and
  the `durable`/glossary/ADR rules were ported from it). Keep the fork's own shape:
  the decision pipeline, responsive tiers, the writing-clarity profile, the Taskfile, the
  waza eval suite, the client-side three-state dark theme, and the Copilot plugin bundle
  (`plugin.json` + marketplace + the Extension-monitor contract) are *not* upstream's, and
  upstream's server-backed theme and different `state.json` fields must not be taken
  wholesale. To sync, use the `fork-sync` skill in `.github/skills/fork-sync/` — it
  classifies every incoming commit as REWORK (a contract file the fork also changed),
  ADAPT (a contract file), ADOPT (no contract file), MERGE (a merge commit), or DEFER (a
  decision to leave alone). Never merge upstream wholesale. Report with
  `node .github/skills/fork-sync/scripts/sync-report.mjs` (read-only) or `task
  sync-report`.
