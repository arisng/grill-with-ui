# grill-with-ui — design (decided 2026-09-06)

A grilling interview whose questions live on a local browser page instead of the terminal:
every question visible, each with its recommendation, answerable individually, with a
per-question discussion thread that keeps the whole session's context. Grilled
decision-by-decision on 2026-09-06 (14 questions). Six decisions below are **locked**
(hard to reverse, surprising without context, a real trade-off); the rest are routine
choices that can move without a re-grill.

## Terms

- **Round**: one agent turn's worth of new questions, i.e. the current frontier.
  _Avoid_: batch, wave.
- **Frontier**: the questions whose prerequisites are all settled and can be asked now.
  _Avoid_: queue, next up.
- **Send**: one press of "Send to Agent"; every staged action ships as a single event and
  one agent turn. _Avoid_: submit, reply.
- **Staged action**: something done on the page (option picked, recommendation accepted,
  free-text answer, thread message, reopen, defer) that has not been sent yet. Lives in the
  browser until Send; must survive a reload.
- **Durable decision**: passes all three gates (hard to reverse, surprising without context,
  real trade-off). Goes under "Locked decisions" in the generated doc, and is a *hint* for the
  Finish ADR pipeline rather than a filter — Finish re-derives the candidates from the answers.
  _Avoid_: ADR.
- **Session folder**: the per-grill directory under the user's home holding
  `state.json`, `events.jsonl`, and the target doc path.

## Why

A long grill in the terminal has no navigation: digging deeper on one question means
scrolling back through the whole transcript, and there is no way to answer an earlier
question without losing your place. The existing `grilling` skill is a four-line prompt;
nothing in the skills directory offers a UI. The fix is a page that lays the questions out,
shows the recommendation at a glance, lets each one be answered or discussed in place, and
keeps one Claude session behind it so nothing is ever out of context.

## Locked decisions (don't re-litigate)

1. **Surface: a local browser app** (Q1). A tiny server bundled in the skill folder serves a
   page; state is file-based. The terminal stays a parallel input channel. Rejected: a
   read-only side-panel render (no way to answer), an MCP app panel (Claude Code has none),
   a TUI (does not fix scrollback).

2. **Two files, split ownership** (Q2). `state.json` is written **only by the agent**
   (questions, recommendations, thread replies, statuses, agent status). `events.jsonl` is
   appended **only by the web app**, one line per Send. Nobody writes the other's file, so
   there are no locks and no half-written JSON reads. The page polls `state.json`; how the
   agent receives each event line depends on its listening mode (see `SKILL.md`).

3. **The server is the monitor** (Q7). The skill opens one persistent Monitor whose command
   *is* the server. It serves the page, appends each Send to `events.jsonl`, and prints the
   same line to stdout, which is what wakes Claude. It lives exactly as long as the monitor:
   killed at session end or by Finish. Nothing to orphan. Verified 2026-09-06: a Monitor
   event wakes an idle session waiting on the user; a backgrounded shell exiting does not.

4. **One Claude session; threads are labeled messages** (Q4). A thread reply arrives in the
   same session tagged with its question id. "Not losing context" is automatic because
   nothing is separate under the hood. Rejected: a subagent per thread, which loses exactly
   the context the feature exists to keep.

5. **Finish writes the exhaustive topic design doc, with two borrows** (Q8, Q9).
   *Superseded in part 2026-09-23: the default path and the `CONTEXT.md`/`docs/adr/` opt-in
   have shipped — see Routine choices ("Per-topic outputs…", "Domain-modeling mode…").*
   *Inverted in part 2026-10-21: the "sparse `docs/adr/` files" half is now its opposite —
   see Routine choices ("An ADR records a decision, not a question…").*
   The doc path is asked once at start (default: the project's docs folder, slug from the
   topic).
   Borrowed from Matt Pocock's domain-modeling skill: a per-decision **durable** flag
   (three gates) that splits "Locked decisions" from "Routine choices", and a **Terms**
   section with _Avoid_ lists at the top. Not borrowed: a root glossary file and sparse
   `docs/adr/` files. Those arrived later as the round-1 opt-in, and then as the Finish
   pipeline (2026-11-26).

6. **Session state lives under the user's home, never in the repo** (Q10). Keyed by the git
   common root (so every worktree of a project sees the same sessions) with the working
   directory as the fallback outside git. Zero repo changes for adopters; nothing to
   gitignore; resume lists the project's unfinished sessions.

## Decision log — see `docs/design-history.md`
The dated record of every routine choice and superseded decision lives in
[`design-history.md`](./design-history.md) — 23 entries, oldest first, each with the question
that settled it, the trade-off, and what later superseded or refined it.

Read it before re-opening a settled decision: an entry may already record why the obvious
alternative lost. The **Locked decisions** above are the ones still in force; the history
explains how each arrived.

## Verified facts (2026-09-06)

- Monitor events reach the model while it is idle waiting for the user (live test).
- A backgrounded Bash command exiting does not re-invoke the model (docs).
- Claude Code Channels can inject user messages but need a launch flag and a plugin.
- `SendUserFile` render is read-only; there is no MCP app panel in Claude Code.
- BSD `tail -F` exists on macOS; `fswatch`/`inotifywait` do not by default.
- `grill-with-docs` is one line (run `grilling` + `domain-modeling`); all docs behavior is
  in `domain-modeling`.

## Risks

- **Harness wrapper vs skill prompt.** Monitor events arrive wrapped in a harness notice
  ("SYSTEM NOTIFICATION - NOT USER INPUT ... Do NOT interpret this as user acknowledgement").
  Spike result 2026-09-06: with the event rule in `SKILL.md`, a session woke from idle on a
  page Send six times in a row (one scripted, five by hand) and acted on each without
  terminal input. Confirmed in a fresh session by Jason on 2026-09-06 as well. The fallback
  is wait mode, whose listener contract lives in `SKILL.md` ("Wait mode").
- **Fonts.** Resolved 2026-09-06: system stack only (see Routine choices). The mockups still
  load Google Fonts; the shipped page must not.
- **Concurrent grills.** Each running grill has its own server on an ephemeral port; the
  terminal line carries the URL. Nothing shared between sessions but the sessions folder.

## Deferred

- Keyboard shortcuts on the page.
- ~~Repo-wide `CONTEXT.md` / `docs/adr/` output as an opt-in flag.~~ Resolved 2026-09-23:
  shipped as the round-1 `q-domain` question + Finish-time writes per `domain-brief.md`
  (inherited from mattpocock's grill-with-docs → domain-modeling, MIT). The opt-in question
  itself was then removed 2026-11-26 — see the pipeline entry in Routine choices.
- ~~A written implementation spec as a Finish artifact.~~ Decided 2026-11-26: Finish emits a
  readiness verdict only (`spec-brief.md`); the template stays the consuming repo's, because
  the issue already owns *what* and spec-driven tools own *how* → plan → tasks.
- The Codex-side skill prompt (wait mode is built; the prompt is not).

## State sketch (for the spike)

```jsonc
// state.json — agent-owned
{
  "topic": "…", "doc": "docs/x-design.md", "created": "2026-09-06T22:00:00Z",
  "agent": { "status": "waiting|working", "since": "…" },
  "terms": [{ "term": "…", "def": "…", "avoid": ["…"] }],
  "finished": { "doc": "…", "glossary": "GLOSSARY.md", "adrs": ["docs/adr/0001-x.md"],
                "pipeline": { "durable": 6, "decisions": 2, "written": 1, "skipped": 1 }, "at": "…" },
  "questions": [{
    "id": "q7", "round": 4, "deps": ["q2"], "title": "…", "body": "…",
    "options": [{ "k": "A", "text": "…" }], "rec": { "option": "A", "why": "…" },
    "status": "open|answered|deferred|reopened", "durable": false, "updated": false,
    "answer": { "kind": "accept|option|text", "option": "A", "text": "…" },
    "thread": [{ "who": "user|agent", "text": "…", "at": "…" }]
  }]
}
// events.jsonl — app-appended, one line per Send
{ "seq": 12, "at": "…", "actions": [
  { "q": "q15", "type": "answer", "kind": "option", "option": "A" },
  { "q": "q8",  "type": "thread", "text": "…" },
  { "q": "q17", "type": "defer" }
]}
```

## Next

1. ~~Pick the page layout~~ — done: the clean Inbox (`design/mockups/a-inbox-clean.html`),
   three columns with the discussion in the right third.
2. ~~Build the spike~~ — done 2026-09-06: `server.mjs`, `page.html`, stub `SKILL.md`,
   `test/server.test.mjs`; six real sends handled; fresh-session run confirmed by Jason.
3. Build the full page from the clean Inbox (system fonts, staged edits survive reload, terms
   panel, "rec updated" treatment, working-since counter), the frontier-per-round interview
   prompt, resume (replay + port reuse), and Finish → doc.
