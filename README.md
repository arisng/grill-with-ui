# grill-with-ui

A skill for coding agents that moves a "grilling" design interview out of the terminal and
onto a local browser page. The agent asks its questions as cards, each with lettered options
and a highlighted recommendation. You answer them in any order, defer or reopen them, discuss
any single one in its own thread without losing the rest of the session, and press one
button, **Send to Agent**, to ship everything you staged as a single turn. At the end the
agent writes an exhaustive design doc for the topic.

Under the hood it is small on purpose: one Node script and one HTML file, no dependencies,
no build step. The agent owns `state.json`; the page appends one line per Send to
`events.jsonl`; the server that serves the page is also the process whose output wakes the
agent. Nothing runs after the agent session ends.

## Install

Claude Code (or any agent that reads `~/.claude/skills`):

```sh
git clone https://github.com/jasonku09/grill-with-ui ~/Projects/grill-with-ui
ln -s ~/Projects/grill-with-ui ~/.claude/skills/grill-with-ui
```

Copying the folder works too. Node 20 or newer is the only requirement; Claude Code already
needs it.

## Use

In any project:

```
/grill-with-ui <topic you want grilled>
```

The agent prints a URL. Open it. Answer by clicking an option, pressing **Accept** on the
recommendation, or writing free text; start a discussion in the right-hand panel; use
**Defer** and **Reopen** on a card when you want to. Everything you do is staged (and survives
a reload) until you press **Send N to Agent** (⌘↩). The agent answers threads, records your
answers, and adds the next round of questions to the page.

**Finish grill** stages a finish action; on the next Send the agent writes the design doc to
the path shown in the header (default `docs/<topic>-design.md` in your project) and stops.

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
  state.json     written only by the agent (questions, recommendations, threads, status)
  events.jsonl   appended only by the page, one line per Send
  server.json    url, port and pid of the running server
```

`<project-key>` is the git common root of the project with slashes turned into dashes, so
every worktree of a repo sees the same sessions; outside git it is the working directory.

In this repo: `server.mjs` (the server and CLI), `page.html` (the page), `SKILL.md` (the
prompt the agent follows), `test/`, and `design/` + `docs/design.md` (how it was designed).

## Server commands

```
node server.mjs new      --topic T [--doc P]                  create a session, print its folder
node server.mjs serve    --session DIR [--port N]             serve the page; print one line per Send
node server.mjs sessions [--all]                               list this project's sessions
node server.mjs pending  --session DIR                         print sends past agent.handled
node server.mjs wait     --session DIR [--after N] [--timeout S]  block until the next send (exit 3 on timeout)
node server.mjs url      --session DIR [--timeout S]           print the running server's url
```

`GRILL_HOME` overrides `~/.grill-with-ui`.

## Other agents (wait mode)

Agents without a "run this and wake me on each output line" tool can run `serve` detached and
loop `wait` in the foreground; the `SKILL.md` section "Wait mode" has the exact commands. The
page and the files are agent-neutral.

## Tests

```sh
node --test test/server.test.mjs
PLAYWRIGHT_PKG=/path/to/node_modules/@playwright/test/index.mjs node test/page.e2e.mjs
```

The page check needs Playwright with Chromium; point `PLAYWRIGHT_PKG` at an existing install
or run it with `@playwright/test` installed next to the repo. It starts a real server on a
throwaway session and drives the page end to end (staging, reload, send, working state,
server restart, finished state).
