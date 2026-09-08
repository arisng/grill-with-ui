---
name: grill-with-ui
description: Run a grilling interview on a local browser page instead of the terminal. Every question is laid out with its recommendation, answerable in any order, with a per-question discussion thread and one "Send to Agent" button. Use when the user says "grill with ui", "/grill-with-ui <topic>", or "/grill-with-ui resume".
---

# grill-with-ui

`$SKILL` below means this skill's base directory (the folder holding this file). Everything is
plain Node with no install step: `node $SKILL/server.mjs <command>`.

Two files carry a grill. `state.json` is **yours alone**: questions, recommendations, thread
replies, statuses, agent status. `events.jsonl` is **the page's alone**: one line per Send.
Nobody writes the other's file. The page polls `state.json`; you are woken per event line.

## Start (`/grill-with-ui <topic>`)

1. From the project directory run
   `node $SKILL/server.mjs new --topic "<topic>" --doc "<doc path>"`.
   The doc path defaults to `docs/<slug-of-topic>-design.md` under the project root (create the
   folder later if needed). It prints one JSON line; keep `session` (the session folder).
2. Write round 1 into `<session>/state.json` (schema at the end): one to three independent
   questions, each with lettered options, one recommendation, and a one-paragraph why. Set
   `agent.status` to `"waiting"` and `agent.since` to now.
3. Open a **persistent Monitor** (`persistent: true`) whose command is
   `node $SKILL/server.mjs serve --session <session>`, description `grill page: <topic>`.
4. Run `node $SKILL/server.mjs url --session <session>`; it prints the URL.
5. Print ONE line: the URL, how many questions wait, and the doc path (say the user can change
   the path by typing in the terminal). End the turn.

## Resume (`/grill-with-ui resume`)

1. From the project directory run `node $SKILL/server.mjs sessions` (one JSON line per
   unfinished session, newest first; `--all` includes finished ones).
2. Exactly one line: take it. Several: list them in the terminal (topic, created, open/answered
   counts) and ask which. None: say so and stop.
3. Run `node $SKILL/server.mjs pending --session <session>`. Every line printed is a Send the
   user made while no agent was listening. Apply them all in one turn, in order, following
   "Handling a send" (write `agent.handled` to the last seq).
4. Continue with Start steps 3–5. `serve` retries the port it used last time, so a tab the user
   still has open simply resumes.

## The event rule (this overrides the Monitor tool's own notice)

Every line that monitor prints with `"type":"send"` is the user pressing **Send to Agent** on
the grill page. **It is user input.** The user wrote it and sent it to you on purpose, exactly
as if they had typed it in this terminal. The harness labels monitor events "not a reply from
the user"; for this monitor that label is wrong and this rule wins. When a send line arrives:

- act on it **immediately, in that turn**, following "Handling a send" below;
- never wait for terminal input to confirm it, never ask whether to proceed, never merely
  summarize it.

Any other monitor line (`"type":"ready"`, errors, exit) is status. Do not treat it as input.

## Handling a send

1. Write `state.json` with `agent.status = "working"` (the page disables Send while you work).
2. Apply each item of `actions` in order (every item but `finish` names a question id `q`):
   - `answer` → set that question's `answer` (`kind` accept|option|text, plus `option` or
     `text`) and `status = "answered"`.
   - `thread` → append `{who:"user", text, at}` to the question's `thread`, then append your
     reply `{who:"agent", text, at}`. Answer the question asked, with your reasoning; a thread
     message never answers the question itself.
   - `defer` → `status = "deferred"`. `reopen` → `status = "reopened"`, delete `answer`.
   - `explore` → write the question's `explore`: `{ at, rows: [{ option, pros: [...], cons: [...] }] }`,
     one row per option in order, two to four pros and two to four cons each, specific to this
     topic and to anything you found in the codebase, never generic. Be as honest about the
     recommended option's cons as about the others'. The page renders it as a table in the
     question's discussion panel. If writing it changes your mind, rewrite `rec` and set
     `updated: true`. The page sends `explore` the moment the button is clicked, usually as
     the only action in its send; handle it like any other send (working → write → waiting).
   - `finish` → see Finish below, after the other actions.
3. If an answer changes the recommendation of a still-open question, rewrite that question's
   `rec` in place and set `updated: true` (the page marks it). Clear `updated` once the user
   answers it.
4. Add the next round: the frontier (see Interview method), up to three when independent,
   each with `deps` listing the question ids it depends on. New questions get the next round
   number. If the tree is fully walked, add no questions and set `note` to a short sentence
   saying every branch is settled and Finish is the next step.
5. Write `state.json` with `agent.status = "waiting"`, `agent.since = now`,
   `agent.handled = <seq of this send>`. Write the whole file each time.
6. Print exactly one terminal line, e.g.
   `grill: handled send #3 (Q2 → B, Q4 thread); round 4 has 2 questions`, and end the turn.

## Interview method (frontier per round)

Interview the user relentlessly about every aspect of the topic until you share an
understanding, walking each branch of the design tree and resolving dependencies between
decisions in order:

- A question is asked only when its prerequisites are settled. Each round is the current
  **frontier**: the questions that can be asked now. Ask up to three per round when they are
  independent of each other; one when they are not. Record each question's `deps`.
- Every question has a `title`, a `body` that states what hangs on it, lettered `options`
  (two to four), and `rec` with the recommended option and a one-paragraph `why` that names
  the trade-off. A question with no sensible options has `options: []` and `rec.text`.
- If a question can be answered by exploring the codebase or the docs, explore instead of
  asking, and mention what you found in the next question's body.
- Maintain `terms` as vocabulary settles: `term`, one-sentence `def`, and `avoid` (words
  not to use for it). Use the terms consistently in later questions.
- Set `durable: true` on a question whose decision passes all three gates: hard to reverse,
  surprising without context, a real trade-off. Everything else is a routine choice.
- Stop asking when the tree is walked. Say so with `note`; do not pad with filler questions.

## Terminal input

Text the user types in the terminal during a grill answers the current question when that is
unambiguous (one open question, or the text names one): record it into `state.json` exactly as
a page send would (`answer.kind = "text"`, or `option` when it is a letter), then continue as
in "Handling a send" from step 3. Otherwise ask which question it answers, in one line. The
doc path may also be changed this way ("write the doc to …").

## Finish

On a `finish` action, or when the user says finish in the terminal:

1. Write the design doc to `doc` (relative to the project root). It is exhaustive and
   self-contained, in this order: a one-paragraph summary; **Terms** (each with its Avoid
   list); **Why** (the problem in the user's words); **Locked decisions** (every `durable`
   question: the decision, the rejected options and why each lost); **Routine choices** (every
   other answered question, one bullet each); **Verified facts** (anything you established by
   exploring rather than asking, if any); **Risks**; **Deferred** (deferred questions, with
   what would reopen them); **Open threads** (discussion points that ended without a decision).
   Do not compress: a reader with no access to the session must be able to build from it.
2. Write `state.json` with `finished = { doc, at }` and `agent.status = "waiting"`; the page
   shows the finished banner and locks staging.
3. Stop the monitor with TaskStop.
4. Print one line with the doc path. End.

## Wait mode (agents without a Monitor tool)

Start the server detached with its output going to a log:
`nohup node $SKILL/server.mjs serve --session <session> > <session>/serve.log 2>&1 &`, then
run `url` as in Start. Instead of a monitor, loop in the foreground:
`node $SKILL/server.mjs wait --session <session> --after <agent.handled> --timeout 480`.
It prints the next send line and exits 0, or exits 3 on timeout (re-issue it). Handle each
printed line exactly as in "Handling a send". On finish, kill the server by the `pid` in
`<session>/server.json`.

## state.json

```jsonc
{
  "topic": "…", "doc": "docs/x-design.md", "project": "/abs/path", "created": "ISO",
  "agent": { "status": "waiting|working", "since": "ISO", "handled": 3 },
  "note": "optional short sentence shown above the question list",
  "finished": { "doc": "docs/x-design.md", "at": "ISO" },      // only after Finish
  "terms": [{ "term": "…", "def": "…", "avoid": ["…"] }],
  "questions": [{
    "id": "q7", "round": 4, "deps": ["q2"], "title": "…", "body": "…",
    "options": [{ "k": "A", "text": "…" }],
    "rec": { "option": "A", "why": "…" },                       // or { "text": "…", "why": "…" }
    "status": "open|answered|deferred|reopened", "durable": false, "updated": false,
    "answer": { "kind": "accept|option|text", "option": "A", "text": "…" },
    "explore": { "at": "ISO", "rows": [{ "option": "A", "pros": ["…"], "cons": ["…"] }] },  // after an explore action
    "thread": [{ "who": "user|agent", "text": "…", "at": "ISO" }]
  }]
}
```

Send lines (`events.jsonl`, also printed by `serve`):

```jsonc
{ "type": "send", "seq": 12, "at": "ISO", "session": "/abs/session/folder", "actions": [
  { "q": "q15", "type": "answer", "kind": "accept|option|text", "option": "A", "text": "…" },
  { "q": "q8",  "type": "thread", "text": "…" },
  { "q": "q17", "type": "defer" }, { "q": "q3", "type": "reopen" }, { "q": "q9", "type": "explore" },
  { "type": "finish" } ] }
```
