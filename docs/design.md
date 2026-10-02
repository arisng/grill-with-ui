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
  real trade-off). Goes under "Locked decisions" in the generated doc. _Avoid_: ADR.
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
   The doc path is asked once at start (default: the project's docs folder, slug from the
   topic).
   Borrowed from Matt Pocock's domain-modeling skill: a per-decision **durable** flag
   (three gates) that splits "Locked decisions" from "Routine choices", and a **Terms**
   section with _Avoid_ lists at the top. Not borrowed: repo-wide `CONTEXT.md` and sparse
   `docs/adr/` files. Those can become an opt-in flag later without a schema change.

6. **Session state lives under the user's home, never in the repo** (Q10). Keyed by the git
   common root (so every worktree of a project sees the same sessions) with the working
   directory as the fallback outside git. Zero repo changes for adopters; nothing to
   gitignore; resume lists the project's unfinished sessions.

## Routine choices

- **Turn model: batch Send** (Q3 lead-in). The page is a staging area; one press ships every
  staged action as one event line and one agent turn. The page shows "agent working /
  agent waiting" from `state.json`.
- **Up to a few new questions per turn when independent** (Q3, chosen against the
  recommendation of one). Mitigations: each question records its prerequisites; when an
  answer changes the recommendation on a still-open question, the agent rewrites it in
  place and the page marks it "updated".
- **Structured question cards** (Q5): title, body, lettered options, recommendation pointing
  at one option (free text when there are none), one-paragraph rationale. Answer by option
  click, one-click Accept, or free text. Thread box separate. Statuses: open, answered,
  deferred, reopened.
- **Terminal prints one status line per turn** (Q6), plus the URL on the first turn.
  Terminal typing still works and is recorded into `state.json` as the answer to the
  current question when unambiguous, otherwise the agent asks which question.
- **Plain Node, no dependencies, no build step** (Q11). One server script on `node:http`
  and `node:fs`, one self-contained HTML page (vanilla JS/CSS). Claude Code already
  requires Node, so every adopter has it.
- **Self-contained skill** (Q12): its own interview prompt (the frontier-per-round form of
  grilling, matching Q3) plus the page protocol. `grilling` and `grill-me` stay untouched as
  the terminal fallback. Developed in its own repo (`~/Projects/grill-with-ui`), symlinked
  into `~/.claude/skills/`, publishable later via skills.sh and as a Claude Code plugin.
- **Wait mode in v1** (Q13): the server also accepts a blocking `wait` command that runs
  in the foreground until the next Send (or a timeout), prints it, and exits. This is the
  path for agents without Monitor (Codex; Claude Code on Bedrock/Vertex or with telemetry
  off). The Codex skill prompt itself is not in v1.
- **Fonts: system stack only** (spike grill Q1, 2026-09-06). A serif stack for headings
  (Iowan Old Style, Charter, Georgia) and the platform sans for body. No network, no binary
  font files in the skill. Bundling woff2 is the answer only if the exact typeface becomes
  part of the product's identity.
- **Send is disabled while the agent is working** (spike grill Q2). Staged actions keep
  accumulating on the page and ship as one event when the agent is back, so there is one
  event per turn and no round gets rewritten under the user's hands.
- **Stuck-agent recovery on the page** (spike grill Q3). The page shows "working since
  HH:MM" with a live counter; after 5 minutes of working it re-enables Send with a note that
  the agent may not be listening. The agent reconciles when it returns.
- **Resume replays missed sends** (spike grill Q4). Before opening the monitor, resume reads
  every `events.jsonl` line with `seq` greater than `agent.handled`, applies them in one
  turn, then continues. `agent.handled` is written on every turn for exactly this.
- **Resume reuses the last port when it can** (spike grill Q5). `serve` remembers its port in
  `server.json` and tries it first, falling back to ephemeral; an already-open tab just
  resumes polling. If the port moved, the tab says so and points at the terminal.
- **Spike first** (Q14): minimal server + one-textarea page + a stub prompt holding only
  the event rule, one real round, before cards/threads/Finish are built.
- **The agent writes `state.json` through `patch`, never whole** (2026-09-18). Rewriting
  the whole file on every Send put the entire state into the agent's transcript as output
  each turn; real grills reach 55–66 KB (~15k tokens) after 11–20 sends, so each send cost
  more than the last. `node server.mjs patch --session DIR` reads a JSON patch shaped like
  the state (on stdin, or `--file`), merges it (null deletes; `agent`/`visual` one level;
  questions by `id`, an unknown id needs a `title`; threads and `visual.queued` append;
  terms by `term`; anything else replaced), validates the result, and renames a temp file
  over the old one, so the page still sees one consistent update per patch and the
  send's answers, next round, and `agent.handled` still land together. It prints one short
  line, never the state. Measured on the largest real grill (62 KB, 20 sends): one typical
  send (an answer, a thread reply, a new question, the handled bump) is a 3.0 KB patch
  against a 64.7 KB whole file. Incoming Sends were already diffs; this makes the outgoing
  side one too. Locked decision 2 still holds: the agent is the only writer.
- **Domain-modeling mode is an opt-in round-1 question** (2026-09-23). `q-domain` asks
  whether settled terms and durable decisions also land as standing files — repo-root
  `CONTEXT.md` and `docs/adr/`; the answer stores top-level `domainModeling: true`
  (absent = off, reopen clears it), Finish writes them per `domain-brief.md` alongside the
  unchanged design doc, `finished` carries `context`/`adrs`, and the page banner shows
  them. Formats inherited (MIT) from mattpocock/skills domain-modeling — the earlier "not
  borrowed" note in Q8/Q9 becomes the borrowed half.
- **Per-topic outputs grouped under `.grill-with-ui/<slug>/`** (2026-09-23). The default
  doc path is `.grill-with-ui/<slug>/design.md` and Finish exports `visual.html` beside
  the design doc (grouping follows the doc under `--doc` overrides); standing artifacts
  stay conventional — root `CONTEXT.md`, ADRs in `docs/adr/`. Supersedes the Q8/Q9
  "project docs folder" default; that dated text stays as recorded.
- **The slug folder carries a `yymmdd` prefix** (2026-10-02). The default doc path is now
  `.grill-with-ui/<yymmdd>-<slug>/design.md`, the stamp being the grill's start date in
  local time (two-digit year, month, day), so topic folders auto-sort chronologically —
  the stamp leads the name, which is what makes a plain name sort date-ordered.
  `server.mjs new` computes the path — an explicit `--doc` still wins — and SKILL.md uses
  the printed value instead of deriving it; `visual.html` follows the doc as before.
  Folders created before this entry keep their unstamped names; no rename pass. Refines
  the 2026-09-23 grouping choice, which stays as recorded.
- **Glossary in the Terms panel** (2026-09-23). The Terms dropdown merges this session's
  `terms` with the repo's standing `CONTEXT.md` behind a read-only `GET /context`;
  rows are badged `session`, `glossary`, or `✓ glossary`, the session definition
  wins collisions, and the file is read at load/open/Finish — never mid-grill polling.
  Viewing is not gated on domain-modeling mode (viewing ≠ writing); no readable file
  renders the session panel exactly as before. Chosen over a second Glossary button and
  over split sections: one glossary concept, provenance as metadata.
- **Responsive tiers: two panes below 1400px, sheets below 740px** (2026-10-01). One
  `max-width: 760px` breakpoint left 768–1399px on the desktop three-column grid — exactly
  where a tablet lands — so at 768 the question column was 255px and the headline 136px.
  Three tiers now: ≥1400 three columns (unchanged); 740–1399 two columns, 260px rail + card,
  with the discussion in a right drawer and Terms a header panel; ≤739 the card alone, the
  rail a left sheet, the discussion a bottom sheet, and a thumb band under the card carrying
  ‹ / › plus a **Questions** opener that doubles as the position indicator. Two panes start at
  740 because the rail is 260px and cannot shrink — 260px is the floor at which a long id
  plus the `updated` badge still fits (at 236px it clipped) — and the card needs ~420px of
  measure besides; at 561px, which the throwaway prototypes used, the card got 214px and the
  breadcrumb overflowed. Desktop starts at 1400 because the aside takes a third of the window
  whatever the window is, so three columns only give the card its 680px cap past ~1534px.
  Media bounds end on `.98` because the layout viewport is fractional under a scaled device
  pixel ratio. Visualize is view-only on a phone: the button appears only when a visual
  already exists, and feedback needs a wider window. Chosen over a horizontal round strip
  (permanently costs a band and shows ~4 of 12) and over a docked thread on tablet
  (permanently costs ~46% of the column height for a thread you often are not reading).
- **Dark theme with a three-state header toggle** (2026-10-01). One `:root[data-theme="dark"]`
  block restates every color token — the same paper-and-ink vocabulary, cool and deep, with
  the accents *lightening* because they were tuned to sit on white — and everything the light
  world hardcoded (`#fff` on filled buttons, the Finish-ready greens, the scrim and the three
  shadows) became a variable each theme supplies. The button beside Terms cycles
  **System → Light → Dark**, defaults to System, and writes `grill-theme` to localStorage:
  it is the reader's preference, so it never enters the agent-owned `state.json`, and a head
  script resolves it to a concrete `data-theme` before first paint so a dark reader sees no
  white flash. `system` re-resolves live through a `matchMedia` listener. One block, not two:
  the toggle always writes a concrete theme, so a `prefers-color-scheme` duplicate could only
  drift. The theme stops at the Visualize frame — `visual.html` is drawn light by the
  subagent and keeps its own palette (it is a locked mechanism); only the chrome around it,
  including the wait surface, themes. Measured, not eyeballed: every dark pair ≥4.5:1 for body
  and small labels (the light numbers are byte-for-byte what they were). Chosen over
  a two-state toggle whose first visit guesses (a guess you cannot undo without a second
  guess), and over per-session state (theme is not a decision about the topic).

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
  (inherited from mattpocock's grill-with-docs → domain-modeling, MIT).
- The Codex-side skill prompt (wait mode is built; the prompt is not).

## State sketch (for the spike)

```jsonc
// state.json — agent-owned
{
  "topic": "…", "doc": "docs/x-design.md", "created": "2026-09-06T22:00:00Z",
  "agent": { "status": "waiting|working", "since": "…" },
  "terms": [{ "term": "…", "def": "…", "avoid": ["…"] }],
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
