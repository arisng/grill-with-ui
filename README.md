# grill-with-ui

A skill for coding agents that moves a "grilling" design interview out of the terminal and
onto a local browser page. The agent asks its questions as cards, each with lettered options
and a highlighted recommendation. You answer them in any order, defer or reopen them, discuss
any single one in its own thread without losing the rest of the session, and press one
button, **Send to Agent**, to ship everything you staged as a single turn. At the end the
agent writes an exhaustive design doc for the topic.

![A grill in progress: the recommended option accepted on one question, a question asked in
another one's discussion thread, both shipped with one Send, the agent's reply and next round
of questions arriving, a pros and cons table from Explore deeper, a prototype of the design
from Visualize, and that prototype redrawn after one note of feedback](docs/demo.gif)

Above: a recommendation accepted on Q3 and a question asked on Q4 go to the agent as one Send,
and its reply opens the next round. Then one click on **Explore deeper** lays out the pros and
cons of Q6's options, **Visualize** draws the design so far as a prototype, and one note in its
feedback thread redraws it as v2 with the change asked for. Recorded against a real session by
[`design/record-demo.mjs`](design/record-demo.mjs).

Under the hood it is small on purpose: one Node script and one HTML file, no dependencies,
no build step. The agent owns `state.json` and changes it only through
`node server.mjs patch`, sending just what changed as a small JSON patch that the script
merges, validates, and writes atomically; a whole-file rewrite would put the entire state
(60 KB by the end of a long grill) into the agent's context on every turn. The page appends
one line per Send to `events.jsonl`; the server that serves the page is also the process
whose output a persistent Monitor delivers to the agent. In wait mode the agent must keep
its foreground listener active; a page server alone cannot wake an ended agent turn.
Submissions made while the agent is not listening remain queued for resume.

## Install

The skill is a plain [Agent Skills](https://agentskills.io) folder (`SKILL.md` plus one
script and one page), so it installs the same way everywhere: put this folder where your
agent looks for skills, under the name `grill-with-ui`. A symlink keeps `git pull` as the
update path; copying the folder works too. Node 20 or newer is the only requirement.

```sh
git clone https://github.com/arisng/grill-with-ui ~/Projects/grill-with-ui
ln -s ~/Projects/grill-with-ui ~/.claude/skills/grill-with-ui   # Claude Code (Cursor reads it too)
ln -s ~/Projects/grill-with-ui ~/.agents/skills/grill-with-ui   # Codex, Gemini CLI, Cursor, Copilot
```

**Copilot only — Extension monitor (optional):** install the companion extension so Copilot
stops polling and is woken once per Send instead (it needs no build step either):

```sh
task ext-install    # or: mkdir -p ~/.copilot/extensions &&
                    #     cp -R .github/extensions/grill-monitor ~/.copilot/extensions/
```

Restart Copilot (or reload its extensions) and `grill_attach` appears among the tools;
without the extension the skill falls back to wait mode as described below.

This repository is a fork of [jasonku09/grill-with-ui](https://github.com/jasonku09/grill-with-ui),
which remains the upstream code source. The fork adds domain-modeling mode (a `CONTEXT.md`
glossary and ADRs), a responsive layout for phone and tablet, a writing-clarity profile, a
Taskfile, and an evaluation suite. Install from the fork to get those; the upstream
repository stays the place to watch for new upstream work. See
[Keeping the fork in sync](#keeping-the-fork-in-sync) below.

Where each agent looks, and how to start a grill once it is there:

| Agent | User-level folder | Project-level folder | Start a grill |
|---|---|---|---|
| Claude Code | `~/.claude/skills/` | `.claude/skills/` | `/grill-with-ui <topic>` |
| Codex (CLI, IDE) | `~/.agents/skills/` | `.agents/skills/` | `$grill-with-ui <topic>` |
| Gemini CLI | `~/.gemini/skills/` or `~/.agents/skills/` | `.gemini/skills/` or `.agents/skills/` | say "grill with ui: <topic>"; accept the activation prompt |
| Cursor | `~/.cursor/skills/` or `~/.agents/skills/` (also `~/.claude/skills/`) | `.cursor/skills/` or `.agents/skills/` | `/grill-with-ui <topic>` in Agent chat |
| GitHub Copilot (CLI, VS Code, JetBrains) | `~/.copilot/skills/` or `~/.agents/skills/` | `.github/skills/`, `.claude/skills/`, or `.agents/skills/` | say "grill with ui: <topic>" |
| Any other agent that reads `SKILL.md` | its skills folder | | say "grill with ui: <topic>" |

Paths are from each product's documentation as of September 2026; `/skills` (Codex,
Gemini CLI) or the agent's skill picker will show whether the install landed. The skill's
description names the phrase "grill with ui", so plain language works on every agent.

What the agent needs at run time:

- **A shell tool and Node 20+.** Claude Code is woken per Send by its persistent Monitor
  tool; GitHub Copilot with the grill-monitor extension uses **Extension monitor** (the
  extension polls for you and wakes the agent once per Send). Every other agent uses
  **wait mode**, spelled out in `SKILL.md`: it starts the
  server detached (or in a harness-managed shell session) and keeps `node server.mjs wait`
  active in the foreground. It returns on the next Send or after a bounded timeout, then
  loops. The agent keeps listening after replies and completed visuals, until the user
  finishes or explicitly pauses; a running server is not a substitute for that listener.
- **Optionally a subagent tool**, for Visualize. With one, the visual is drawn in the
  background while you keep answering. Without one, the agent draws it inline and that
  turn takes longer.

## Use

In any project:

```
/grill-with-ui <topic you want grilled>
```

The agent prints a URL. Open it. Answer by clicking an option (the recommended one is
outlined) or writing free text; start a discussion in the discussion panel (the right-hand
column on a wide window, a drawer or a bottom sheet on a narrow one); use **Defer** and **Reopen** on a card when
you want to. Everything you do is staged (and survives a reload) until you press **Send N to
Agent** (⌘↩). The one exception is **Explore deeper** next to a question's title: it goes to
the agent the moment you click it, and the pros and cons table for that question's options
appears in the discussion panel when the agent is done. The question list shows each
question's discussion message count once it has any, so you can see where a discussion is
waiting without opening it. The agent answers
threads, writes the tables, records your answers, and adds the next round of questions to
the page.

### Writing clarity

Every grill uses a plain-language clarity baseline. Question cards ask one decision and
use distinct options. The recommendation reason explains the benefit and trade-off.
Discussion replies answer the user's point directly and keep a natural tone. These rules
also guide terms, visual labels, and Finish documents while preserving technical meaning
and uncertainty.

When the agent detects procedural or other text where stricter rules may help, it asks
before enabling the strictest available ASD-STE100-inspired profile. The choice lasts for
that grill only. The separate `asd-ste100` skill is optional. If it is not available, the
grill uses its built-in guidance. The official word list is not included, so the grill does
not claim full ASD-STE100 compliance.

The page also fits a phone and a tablet. A wide window keeps three columns. Below 1400px the
discussion moves into a drawer you open with **Discussion**, leaving the question list and the
card side by side. Below 740px the card takes the whole screen, with a band under it: ‹ and ›
step one question at a time in document order (so you can walk back into earlier rounds), and
the **Questions** button between them opens the list and shows where you are (`11 of 12`).
Everything staged survives opening and closing those panels. The visual is view-only on a
phone — send feedback on it from a wider window.

The first question of every grill asks whether settled terms and durable decisions should
also be kept as standing files — a `CONTEXT.md` glossary and one ADR per architecturally
significant decision, the big hard-to-reverse choices, grouped where several questions
settle the same one — alongside the design doc, which is written
either way; no (the default) changes nothing else. The glossary goes to the project root,
except in a repo that keeps a `CONTEXT-MAP.md` at its root: there the root belongs to the
context map, so Finish reads it, lands the glossary in the bounded context this topic
belongs to — asking you to confirm when the match is unclear — and writes the ADRs into
that context's own `docs/adr/` or `.docs/adr/`.

The header **Terms** panel also shows the project's standing glossary once it exists —
from the root `CONTEXT.md`, or from wherever Finish recorded a scoped one —
session terms and standing terms in one list, each marked where it came
from. Declining the mode changes nothing: you still see a glossary a previous grill left
behind.

Beside it, a **theme** button cycles **System → Light → Dark**: the page follows your OS by
default, your choice is remembered in this browser (never in the session's state), and dark
is the same design in warm ink on cool paper. It applies before first paint, so reloading in
dark never flashes white.

Next to it, a **sound** button toggles the completion cues: while you are away from the tab,
a short tone announces that the agent finished processing your Send, replied in a
discussion, landed a redrawn visual, or finished the grill — each with its own distinct
cue, at most one per update. The choice is remembered in this browser like the theme, and
the first click anywhere unlocks audio for the tab (browser autoplay policy); if a cue
cannot play yet it is skipped quietly, never blocked.

To taste the cues without a running grill, `task taste` opens `sound-sampler.html` —
every tone on buttons — after checking the sampler's cue table still matches
`page.html`. `task taste:check` runs only that drift check (exit 1 when the tables
disagree), so retuning a tone stays: edit `SOUND_CUES` in `page.html`, copy the
table into the sampler, taste again.

**Visualize** in the header asks the agent for one picture of the design so far: an
interactive HTML prototype when the topic is a UI, an architecture or flow diagram
otherwise. When the topic is a change to an existing app, the prototype is drawn inside the
real page it changes, with the app's own look. It appears in place of the question list and
card, with its own feedback thread in the discussion panel. Undecided parts are drawn from the
recommendations and marked "assumed"; feedback you add there ships with your next Send and
redraws it; a note that contradicts an answered question reopens that question rather than
silently changing your answer. Ordinary answers and question discussions do not regenerate
the visual or delay the next round. When decisions change what it shows, it is marked
**Out of date**; click **Regenerate** to include the latest decisions. Each requested redraw
has a version number and a one-line change note. The agent never writes the file in the
grill conversation itself: it briefs a subagent (rules in `visual-brief.md`) so hundreds of
lines of markup stay out of the interview's context. The draw runs in the background, so
Send keeps working and the interview goes on while it is drawn; the header says
Visualizing… (or the strip says regenerating…) until the new version lands. Finish
reconciles and copies the final visual next to the design doc as
`.grill-with-ui/<yymmdd>-<topic-slug>/visual.html` — design and visual grouped per topic.

**Finish grill** sends at once (after an inline confirm), together with anything you had
staged; the agent writes the design doc to the path shown in the header (default
`.grill-with-ui/<yymmdd>-<topic-slug>/design.md` in your project), plus the glossary and ADRs in
domain-modeling mode, and stops.

To pick up an unfinished grill, in the same project:

```
/grill-with-ui resume
```

If the agent crashed or was closed, sends you made in the meantime are replayed on resume,
and the page tab you still have open reconnects on its own.

## Files

Session state lives outside your repo, so there is nothing to gitignore:

```
~/.grill-with-ui/sessions/<project-key>/<YYYYMMDD-HHMMSS>/
  state.json     written only by the agent, through `patch` (questions, recommendations, threads, status)
  events.jsonl   appended only by the page, one line per Send
  server.json    url, port and pid of the running server
  monitor.json   written only by the grill-monitor extension — its single-waiter lock (Extension monitor mode)
  visual.html    the prototype or diagram, drawn by the agent's subagent, served at /visual
```

`<project-key>` is the git common root of the project with slashes turned into dashes, so
every worktree of a repo sees the same sessions; outside git it is the working directory.

Repo-side outputs are few and grouped per topic under `.grill-with-ui/<yymmdd>-<topic-slug>/` —
`design.md` plus the optional `visual.html` — while standing files stay at `CONTEXT.md`
and `docs/adr/`. `<yymmdd>` is the grill's start date (e.g. `261002-auth`), so the folders
sort chronologically without opening them. These are committed deliverables: commit
`.grill-with-ui/` (it is the
product), or gitignore it deliberately if you don't want them in the repo.

Only in domain-modeling mode does Finish also write these standing files: `CONTEXT.md`
(merged into, never overwritten; the project root, or the matched bounded context's file
when a `CONTEXT-MAP.md` scopes it) and `NNNN-slug.md` in `docs/adr/` or that context's
ADR folder, recorded in
`finished.context`/`finished.adrs`. Each ADR follows one template — status, date,
authors, context, drivers, the options that were weighed, the outcome, and the
consequences — and records **one decision**, not one question: durable questions that
settle the same choice share a file, and a durable choice too small to be worth a record
keeps its place in the design doc alone.

In this repo: `server.mjs` (the server and CLI), `page.html` (the page), `SKILL.md` (the
prompt the agent follows), `writing-clarity.md` (its writing rules), `visual-brief.md` (the
visual subagent's contract), `domain-brief.md` and `adr-template.md` (the standing docs it
writes and their shape), `test/`, `.github/extensions/grill-monitor/` (the optional Copilot
extension and its tests), and `design/` + `docs/design.md` (how it was designed).
`design/record-demo.mjs` re-records the GIF above by driving the real page; it needs
Playwright and `ffmpeg`.

## Server commands

```
node server.mjs new      --topic T [--intent I] [--doc P]     create a session, print its folder
node server.mjs serve    --session DIR [--port N]             serve the page; print one line per Send
node server.mjs sessions [--all]                               list this project's sessions
node server.mjs pending  --session DIR                         print sends past agent.handled
node server.mjs wait     --session DIR [--after N] [--timeout S]  block until the next send (exit 3 on timeout)
node server.mjs url      --session DIR [--timeout S]           print the running server's url
node server.mjs context  --session DIR                          print the glossary and ADR locations for this repo
node server.mjs adr      --session DIR --folder F --title T     scaffold one ADR file from adr-template.md
node server.mjs patch    --session DIR [--file P]              apply a JSON patch (stdin or P) to state.json
```

`adr` claims the next free `NNNN` in the folder (never overwriting an existing file),
writes the title, status, date and author, and leaves the sections for the agent to fill;
it prints one line with the path and the number.

`patch` merges by the rules in `SKILL.md` ("Patching state.json"). A bad patch exits
non-zero and leaves the file untouched; a good one prints one short summary line, never the
state.

`GRILL_HOME` overrides `~/.grill-with-ui`.

## Tests

```sh
node --test test/server.test.mjs
PLAYWRIGHT_PKG=/path/to/node_modules/@playwright/test/index.mjs node test/page.e2e.mjs

# or, with Task (taskfile.dev) installed — thin aliases over the same commands:
task test        # unit tests, skipping the three documented as broken on Windows
task test:ext    # grill-monitor extension tests (SDK stubbed, real wait CLI)
task test:e2e    # the page check (normalises a raw Windows PLAYWRIGHT_PKG path)
task check       # all three suites, plus the design detector
task             # list every task
```

The page check needs Playwright with Chromium; point `PLAYWRIGHT_PKG` at an existing install
or run it with `@playwright/test` installed next to the repo. It starts a real server on a
throwaway session and drives the page end to end (staging, reload, send, working state,
server restart, finished state). `test/page-sound.e2e.mjs` runs the same harness against
the completion-sound contract: every trigger plays exactly its cue, history stays silent on
load, precedence holds for combined updates, and mute survives a reload.

`Taskfile.yml` also wraps the server CLI for local use — `task new TOPIC=… DOC=…`,
`task sessions`, `task serve` (newest session, or `SESSION=<dir>`), `task pending` — and
offers `task demo`, which serves a throwaway session seeded with every card state (its own
temp `GRILL_HOME`, cleaned by `task clean`) so you can click through the page without a real
grill running.

## Skill evaluation

The skill's own behaviour is measured with [waza](https://github.com/microsoft/waza), a
CLI that runs a skill against a real agent and grades the outcome. The suite lives in
`evals/grill-with-ui/` and comes in two parts: `eval.yaml` runs the skill's contracts,
`eval-routing.yaml` runs only the routing decision. `trigger_tests.yaml` holds the
routing prompts the main spec also picks up.

| Task | What it pins down |
|------|-------------------|
| `start-grill` | `server.mjs new` → patch round 1 (`q-domain` first, then topic questions with options, a recommendation and a why) → open the page → print the URL |
| `answer-glossary-yes` | a terminal answer on `q-domain` sets `domainModeling: true` |
| `finish-design-doc` | Finish writes the self-contained design doc with its prescribed sections and records it in `finished` |
| `finish-domain-docs` | domain-modeling mode also writes `CONTEXT.md` and one ADR per significant decision |
| `patch-only-no-direct-write` | the skill overrides a request to hand-edit `state.json` — the change goes through `patch` |
| `negative-trigger` | a design-adjacent request does not start a grill |
| `resume-no-session` | `/grill-with-ui resume` with nothing to resume reports that and stops |

```sh
waza check .                                   # readiness: compliance, tokens, schema
waza run evals/grill-with-ui/eval.yaml         # behavioural benchmark (needs an LLM)
waza run evals/grill-with-ui/eval-routing.yaml # routing only: does the description send the right prompts here?
waza quality .                                 # LLM-judge score of SKILL.md itself
waza gate --baseline <before.json> --current <after.json>   # CI gate: fail on a regression
```

`waza run` needs a model. With BYOK the provider vars are inherited by the Copilot CLI,
so a profile is enough:

```powershell
. skills/copilot-byok/scripts/byok-profile.ps1 set-env <profile>
waza run evals/grill-with-ui/eval.yaml --model <the provider's model id>
```

Two harness notes, both visible in the task prompts: the suite has no browser, so every
task says so and stops at a point that ends inside one agent turn (the real skill waits
for browser sends, which an automated run cannot produce); and `config.model` must equal
the model id the provider serves, because the CLI sends the id from the eval spec rather
than from the environment.

Both specs set `inject_skill_body: false` and `trigger_skill_routing: true`. The skill
body is not pasted into the agent's system prompt, so the agent has to *route* to the
skill the way a real one does — and waza's "did it trigger?" detector then measures that
routing instead of counting an invocation that an injected body made unnecessary.

## Keeping the fork in sync

This repository is a fork. It has three upstreams, and each needs a different kind of
attention:

| Source | Kind | Attention |
|--------|------|-----------|
| [`jasonku09/grill-with-ui`](https://github.com/jasonku09/grill-with-ui) | The code this was forked from | Adopt its changes, adapted to the fork's contract |
| [`mattpocock/skills`](https://github.com/mattpocock/skills) | The method this grew out of (the interview method, the `durable` flag, the glossary and ADR rules) | Watch for method drift; there is no git ancestry to merge |
| The installed copy in `~/.agents/skills/grill-with-ui` | What the agent actually runs | Refresh after a sync, or the change nobody has |

The `fork-sync` skill in [`.github/skills/fork-sync/SKILL.md`](.github/skills/fork-sync/SKILL.md)
runs the whole routine. Start with its read-only report:

```sh
node .github/skills/fork-sync/scripts/sync-report.mjs
```

It fetches upstream, finds the merge base, and prints every incoming commit tiered by
how much of the fork's contract it touches:

| Tier | What it means | What to do |
|------|---------------|------------|
| **REWORK** | A contract file the fork also changed | Port the intent onto the fork's structure |
| **ADAPT** | A contract file the fork did not change | Port the intent; run the contract ripple checklist |
| **ADOPT** | No contract file | Cherry-pick; resolve any overlap by hand |
| **MERGE** | A merge commit | Take the commits it merged, not the merge |
| **DEFER** | Not upstream yet, or a design question | Leave it, and say why |

Commits that change the server's request handling — a host check, an origin check, a
body cap, a CSP sandbox — are flagged `[security]`, because the fork is behind upstream
on those today.

**Never merge upstream wholesale.** The fork's own shape — domain-modeling mode, the
responsive tiers, the writing-clarity profile, the Taskfile, the eval suite, and the
client-side three-state dark theme — is not upstream's, and upstream's equivalents
(server-backed theme, a different `state.json`) are not drop-in replacements. A commit's
diff is evidence of intent, not a patch to apply.

Two things make a sync land safely. First, `SKILL.md` is the product: its schema is
implemented by `server.mjs`, `page.html`, the briefs, and the tests, so a schema change
must move through all of them — see the skill's `references/contract-ripple.md`. Second,
bump `metadata.version` in `SKILL.md` and reinstall:

```sh
npx skills update -g -y
```
