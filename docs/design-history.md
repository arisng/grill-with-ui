# Design history — dated decisions

Every dated entry from `design.md`'s decision log, kept verbatim so the current contract
stays readable. `design.md` carries the terms, the locked decisions, the risks and the state
sketch; this file carries *how the log got here* — read it when a decision needs its history,
or before proposing to re-open something that was already settled and superseded.

Entries marked **Locked decision** are still in force. Entries marked *Superseded* or
*Refines* record what changed and are kept because the reasoning still matters.

---

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
- **Domain-modeling mode is an opt-in round-1 question** (2026-09-23). *Superseded 2026-11-26:
  the opt-in question is gone — see the decision pipeline entry below.* `q-domain` asks
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
- **A context map redirects the glossary and its ADRs into a bounded context**
  (2026-10-02). A `CONTEXT-MAP.md` at the repo root (the DDD convention: the map owns the
  root, one `CONTEXT.md` per bounded context) stops Finish writing a root glossary. The
  new `server.mjs context` command parses the map into `{name, path, folder, adr}`
  candidates; Finish matches the grill's topic to one of them — a confident single match
  proceeds, several or none asks the user (offering the candidates, "beside the design
  doc", "no glossary this grill") — then merges the matched context's `CONTEXT.md`
  (creating it in the context's folder when absent) and writes the ADRs to that context's
  existing `docs/adr/` or `.docs/adr/` (`docs/adr/` when neither or both). `GET /context`
  now serves the path `finished.context` records, guarded to the project, instead of
  probing a fixed location, so the Terms panel reads exactly what was written; no new
  state field. Refines the 2026-09-23 root-`CONTEXT.md` default, which stays as recorded.
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
- **An ADR records a decision, not a question** (2026-10-21). The ADRs stopped being a
  mechanical 1:1 map off the answered `durable` questions and became one file per
  architecturally significant *decision*, written in a full template (status, date,
  authors, context, drivers, considered options, outcome, consequences). Three changes
  carry it. **Cluster, split, screen** — durable questions whose answers could not change
  independently are one decision and share one file; an answer stating two independent
  commitments is two; a group that fails the screen (*delete this ADR, would they build
  the same thing?*) gets no file at all and stays a Locked decision in the design doc.
  **The server owns the mechanical parts** — `server.mjs adr --session --folder --title`
  scaffolds the file from `adr-template.md`, claims the next *free* number (two grills
  finishing at once cannot pick the same one, and an existing file is never overwritten),
  and fills the date (the grill's start day, in local time) and the author
  (`git config user.name`, else `grill-with-ui`); the agent only adds content under the
  headings, so the shape cannot drift. **The doc cites the ADRs** — the design doc is
  written after them and each Locked-decisions bullet ends with `→ ADR-NNNN` where its
  decision has one, so the missing pointer is the visible trace of the filter, and the
  Finish line says how many durable decisions got no ADR. Chosen over the previous
  1:1 rule because a question is not a decision — one grill's six durable questions were
  two choices, and two files said the same thing twice; over a richer template alone
  because the old 1–3 sentence paragraph could not carry a trade-off; and over letting the
  agent derive the date, the number and the author by hand, because this repo keeps
  mechanical derivations in the CLI (`server.mjs context` exists so the agent does not
  hand-parse `CONTEXT-MAP.md`) and each of them is a way to write a wrong file. Refines
  the 2026-09-23 "Domain-modeling mode is an opt-in round-1 question" entry, which stays
  as recorded, and inverts the "sparse `docs/adr/` files" half of locked decision 5.

- **GLOSSARY.md naming adopted from the lineage** (2026-11-19). The lineage renamed
  `CONTEXT.md`/`CONTEXT-MAP.md` to `GLOSSARY.md`/`GLOSSARY-MAP.md` on 2026-09-17; the
  fork now follows — with a compatibility story, not a flag day: the server reads both
  names everywhere (root file, map, map links, the recorded `finished.glossary` field
  with legacy `finished.context`, `GET /glossary` with the `/context` alias, and the
  `glossary` command with the `context` alias), `fallback` always names the new file so
  anything created is `GLOSSARY.md`, and Finish renames a legacy file on first contact —
  one file, never both. The earlier keep-`CONTEXT.md` position (the fork's domain-modeling
  mode predates the rename) is superseded: vocabulary coherence with the lineage wins now
  that the rename is settled upstream. Dated entries above keep their names as recorded.
  Resolved from `issues/0012-decision-glossary-naming.md`.

- **ADRs are gated at Finish by a pipeline, not opted into at round 1** (2026-11-26). The
  round-1 `q-domain` question is gone: asking permission to document before a single decision
  exists pre-commits the user to an unknown quantity, and the top-level `domainModeling` flag
  was then the *only* gate — so a wrong answer at round 1 decided the whole question. Finish
  now always runs a five-stage pipeline and writes what survives it. **Roster** re-derives
  candidates from the answers, with `durable` as a hint rather than the roster: a
  routine-flagged answer is promoted when its `explore` rows, its answer, or a settled thread
  exception shows a real trade-off, and a settled exception or Verified fact may enter without
  ever having been a question (a decision that only ever surfaced in discussion is exactly
  what the code cannot reconstruct). **Eligibility by subject** runs before any property test
  and rejects product scope, priority, UI/UX criteria, naming and bug fixes — the categories
  that pass every property gate and have no business in a decision log.
  **Cluster** and **split** are unchanged. **Screen** (*delete this ADR — would a newcomer
  build the same thing?*) demotes from sole gate to tie-breaker, because it measures how
  obvious a decision is from the code and that is inversely related to its value: a monolith
  is visible in the folder layout, the database in a connection string, so the biggest choices
  are the most likely to be dropped. **Alternatives** rejects a group with none, since a record
  whose only option was the only option documents what was built. Consequences: a glossary is
  now written **before** the ADRs (canonical vocabulary must precede immutable records — the
  brief previously said the glossary "can land at any point"), status is `Proposed` when the
  author falls back to `grill-with-ui`, `Deprecated` becomes an allowed one-line change, and
  `finished.pipeline` records `{durable, decisions, written, skipped}` so a skip leaves a trace
  in state. The ADR template also loses `### Technical Implementation` for `### Confirmation`
  plus `## More Information`: an implementation walkthrough is the one *volatile* artifact
  frozen in an *immutable* file, it duplicates the design doc from the same material, and it is
  the section no ADR convention carries (Nygard, MADR, the AWS Prescriptive Guidance example,
  and the lineage all lack it; AWS and Azure WAF both say the record covers *why*, not *how*).
  Chosen over keeping the opt-in with a better screen, because the round-1 gate is a guess
  made at the moment of least information and never revised; over adding the subject gate alone,
  because the `durable` flag then still decides candidacy; and over writing ADRs 1:1 from
  questions, which the 2026-10-21 entry already replaced. Supersedes the 2026-09-23
  "Domain-modeling mode is an opt-in round-1 question" entry, which stays as recorded.

- **Finish ends with a spec readiness verdict, and never writes a spec** (2026-11-26). The
  grill decides; it does not plan implementation. The verdict keeps four artifacts distinct:
  the **issue** owns *what to implement* and what closes it, the **spec** (written elsewhere)
  owns *how to implement it correctly*, an **ADR** owns *why this way*, and the **design doc**
  records *what this conversation decided*. A spec derives from an issue — one way, issue →
  spec → code — so an issue is a **prerequisite, not a signal**: with no matching issue the
  verdict is `blocked`, never a speculative recommendation. Signals therefore describe an
  unsettled *implementation route* (competing routes, required ordering, a shared seam, a
  non-obvious verification route, non-local touch points, a handoff, a contract to shape), never
  the size of the work. Stop conditions (single file, easily reversible, no handoff, already
  describable, a spike, a bug fix) are checked **before** the anchor, so a trivial change is
  never told to open an issue. Acceptance criteria belong to the issue and are referenced, never
  restated — copying them is the duplication the ADR work already removed. The anchor is read
  from `.github/issue-tracker.json`, which the `issue-tracking` skill owns: read it, never write
  or extend it, and fall back to the `origin` host when absent. The template is the consuming
  repo's; the plugin states only the minimum content (derivation, route and rejected routes,
  ordering and touch points, verification against the issue's criteria, `ADR-NNNN` constraints,
  out of scope) and ships no `spec-template.md`. Chosen over writing an opt-in spec artifact,
  because Spec Kit and Kiro own spec → plan → tasks and the `issue-tracking` skill owns the
  backlog, so a third implementation-plan format would duplicate all three and re-open the
  over-production problem the pipeline exists to fix; and over saying nothing, which leaves the
  suite with no handoff after the decision work is finished. Rules live in `spec-brief.md`, not
  `SKILL.md`, so the prompt body stays near its previous size.
- **The gate is local, and three checks guard the contract** (2026-11-26). A retrospective on
  the pipeline session found the repo had no guardrail at all: no `.github/workflows/`, no git
  hook, and `task check` run only when a human remembered — so a contract change (the ADR
  template, the state schema) was verified by memory. Worse, `task check` was not portable:
  `test:e2e` hard-failed without `PLAYWRIGHT_PKG`, and `lint:issues` invoked
  `~/.agents/skills/issue-tracking/scripts/issue-tree.ps1` with `pwsh`, so the "everything
  local" gate could not run on a fresh machine. And `task test` was green partly because it
  filters three tests. **Chosen over adding GitHub Actions**, which the owner ruled out:
  `scripts/ci.mjs` runs the whole gate locally in cost order (contract, issues, eval graders,
  sound cues, unit, extension, then the browser suites), skipping the browser steps with a
  notice when Playwright is absent rather than failing on setup; `task hooks:install` points
  `core.hooksPath` at the version-controlled `.githooks/` so `git push` runs the cheap subset
  and a blocked push names its failing step. Three new gates keep the repo's own rules true,
  each proven to fail on the regression it exists for: **`check-contract.mjs`** (the pipeline,
  ADR section list, verdict names and version agree across SKILL.md, domain-brief.md,
  spec-brief.md, adr-template.md, copilot-instructions.md, the design docs and server.mjs —
  and a `q-domain` mention without a legacy qualifier fails, which is the exact risk of a
  fork-sync port reintroducing upstream's opt-in question; it also refuses a fourth
  `UNIT_SKIP` pattern, so a real failure cannot be silenced by widening the filter);
  **`check-evals.mjs`** (every waza grader is run against a good fixture *and* a deliberately
  drifted one — 11/11 verified, because `waza run` needs an LLM and the suite was otherwise
  write-only, and a grader that cannot fail is decoration); and **`check-issues.mjs`** (the
  issue store and its tree agree, in dependency-free Node, replacing the `pwsh` scripts).
  Also split the 226-line dated log out of `design.md` into this file, because it was read
  eight times in one session while only its tail mattered: `design.md` now carries the terms,
  locked decisions, risks and state sketch, with one pointer here. Refines the 2026-10-21 and
  2026-11-26 pipeline entries, which stay as recorded.

- **The two manifests are one fact, told twice, and now asserted** (2026-11-27). `plugin.json`
  and the `.github/plugin/marketplace.json` entry both carry a version and a description.
  v0.11.0 and v0.12.0 bumped only `plugin.json`, so `copilot plugin install` served the new
  payload while `copilot plugin list` still advertised v0.10.0 — and the catalog description
  still promised the domain-modeling opt-in the skill had removed, which is the same drift
  one release earlier that a version comparison alone would not have caught. **Chosen over
  deleting the duplicated fields**, because the catalog copy is what a client renders before
  it fetches the plugin, so a marketplace that cannot state a version cannot list one; and
  over a release script that writes both, because a release script only guards releases —
  these manifests are also edited by hand during fork-sync. The lockstep lives in
  `scripts/check-contract.mjs`, whose manifest rule compares version, description and source
  and is itself proved against a drifted fixture on every run, because a lockstep assertion
  that cannot be shown to fire is the guard that rots first.