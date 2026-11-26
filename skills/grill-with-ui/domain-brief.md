# Domain brief

You are writing the standing docs a grill produces at Finish: a `GLOSSARY.md` glossary and
architecture decision records in the folders the rules below pick. This file holds the rules;
follow every one. There is no longer an opt-in flag — Finish always runs this brief, and the
rules here decide what is actually written. An old session may still carry
`domainModeling: true`; accept it, ignore it. Adapted from the `domain-modeling` skill in
mattpocock/skills (MIT):
https://github.com/mattpocock/skills/tree/main/skills/engineering

## Writing clarity

Follow the active writing profile in `SKILL.md` for the design doc, glossary entries, and
ADRs. The clarity baseline uses direct words and clear sentence structure. Strict mode uses
the strictest available ASD-STE100-inspired rules only after the user opts in. Invoke the
separate skill when it is available. Otherwise, use the built-in guidance. Do not claim full
compliance with ASD-STE100.

Keep every term, condition, trade-off, and uncertainty that the source records. Do not make
a document shorter by dropping decision context or technical meaning. Use active voice when
it makes the actor clear. Keep each glossary definition to one or two sentences, as required
below. Keep ADR content complete under every required heading.

## GLOSSARY.md

Location: resolve it before writing anything — `node $SKILL/server.mjs glossary --session
<session>` prints one JSON line holding everything this step needs:

- `map: false` (the usual repo): the repo-root `GLOSSARY.md`, as always.
- `map: true`: the repo scopes one glossary per bounded context. `contexts` lists each one
  read from the root `GLOSSARY-MAP.md` — `name`, the glossary's `path`, its `folder`, and
  the ADR folder for it. Match this grill's topic and intent against the context names and
  the map's one-line descriptions (read `GLOSSARY-MAP.md` itself when the short list is not
  enough to judge):
  - **One clear match** → use it. Its `GLOSSARY.md` exists: merge into that file — that is
    the update-a-context case. Only a legacy `CONTEXT.md` exists there: rename it to
    `GLOSSARY.md` first, then merge — one file, never both. Neither exists: create
    `GLOSSARY.md` in the context's `folder`, which is this context's location.
  - **Several plausible, or none** → ask the user in the terminal before writing anything.
    Offer the candidates, then `fallback` (beside the design doc), then "no glossary this
    grill", and take the answer as the location. A confident match is never worth
    interrupting for; an uncertain one is never guessed.
- Whatever location wins, the `finished` patch records its project-relative path as
  `glossary`; that recorded path is what the Terms panel then reads. (Pre-rename sessions
  recorded `context` — the server still reads that field; never write it again.)

**Deprecated names.** `CONTEXT.md` and `CONTEXT-MAP.md` are the pre-rename names — the
lineage renamed them on 2026-09-17 and the fork adopted the rename. Everything this
brief creates or updates is written under the GLOSSARY names; a legacy file is renamed
on first contact, never duplicated or left beside its replacement.

The map owns the root: never create a repo-root `GLOSSARY.md` in a mapped repo — that slot
belongs to `GLOSSARY-MAP.md` itself.

Whichever file was located, the format below is unchanged.

Under a `## Language` section, one entry per term, in bold-term
format:

**Order**: one or two sentences saying what an Order IS.
_Avoid_: purchase, transaction

The definition comes from the term's `def`; the `_Avoid_` list from `state.terms[].avoid`.

- Only project-specific concepts belong. General programming concepts (timeouts, retries,
  error types, utility patterns) never do, even where the project uses them heavily.
- Keep definitions tight: one or two sentences, what the term IS, not what it does. No
  implementation detail — it is a glossary and nothing else.
- Be opinionated: one canonical term per concept; list the rejected words under _Avoid_.
- Create the file lazily: only when there is at least one term to write.
- **Merge, never clobber.** If `GLOSSARY.md` already exists, read it first; append or update
  only the terms from this grill. Never reorder, overwrite, or delete existing entries or
  any other section.

## ADRs

Location: the folder `$SKILL/server.mjs glossary` reports for the location chosen above —
its `adr` for a matched context (whichever of `docs/adr/` or `.docs/adr/` already exists
inside that context, `docs/adr/` when neither or both), `fallbackAdr` otherwise (the
standing `docs/adr/` convention). Files are numbered sequentially as `NNNN-slug.md` (four
digits) **within that folder**, and the folder is created lazily, only when the first ADR
is needed.

An ADR records a **decision**, not a question: one file per architecturally significant
decision — never one file per question, and never one file for two independent decisions.

### The decision pipeline

Finish runs five ordered stages. A group can leave the pipeline at any stage, and leaving is a
normal outcome: the decision stays a Locked decision in the design doc. Zero ADRs is valid.

**Stage 0 — Roster.** The candidates are the answered questions. `durable: true` is a **hint,
not a filter**: a flagged answer enters the roster, and a `false`-flagged answer is promoted
when its `explore` rows, its answer text, or a settled thread exception shows a real trade-off.
A settled exception or a durable **Verified fact** may enter the roster without ever having
been a question — an exception that only ever surfaced in discussion is the classic case, and
it is exactly what a code reader cannot reconstruct. Never a candidate: a question that is
open, reopened or deferred, and a thread message that did not settle anything (a thread never
answers a question, so do not mine threads for answers — only for a settled exception).
Session-meta questions (`q-domain`, `q-writing-profile`) are never candidates.

**Stage 1 — Eligibility by subject.** Run this **before** any property test, and stop the group
here if it fails. A decision is eligible only when it is about one of:

- the system's shape or boundaries (module split, sync vs async, monolith vs services);
- the core stack or infrastructure (database, broker, cache, hosting, deployment topology);
- a cross-cutting standard (auth/authz, observability, API versioning, test strategy);
- a deliberate exception to an established standard, with the reason;
- a deprecation or a migration path off something in use.

Explicitly ineligible, however hard to reverse: product scope and priority, UI/UX acceptance
criteria, naming and formatting preferences, routine implementation detail, a bug fix. Those
belong in the design doc, the issue tracker, or the code — not in the decision log. A noisy log
is one people stop reading, which costs the records that matter.

**Stage 2 — Cluster.** Two candidates settle the same decision when their answers could not
change independently. Test: could you change one answer without changing the other? If yes,
they are two decisions. Questions that all answer "where does this live" are one decision;
storage engine and retry budget are two.

**Stage 3 — Split.** If one answer states two commitments that could change independently, that
is two decisions, each with its own ADR.

**Stage 4 — Screen (a tie-breaker, never the only gate).** For a group that reached here, ask:
*delete this ADR — would a newcomer with the code build the same thing?* If yes, no ADR: the
code already tells them. This test measures how obvious a decision is from the code, which is
why it cannot be the only gate — the biggest choices are often the most obvious (a monolith is
visible in the folder layout, a database in the connection string), and the *why* is exactly
what the code cannot show. So stage 1 has already admitted the group, and stage 4 only breaks a
tie. A group that binds an external or public contract, a data store, an external dependency, or
a deployment unit always passes the screen. Screen the group, not the question: commitments
individually local but jointly structural are significant together.

**Stage 5 — Alternatives.** A group with no real alternatives produces no ADR. `Considered
Options: None.` is a signal that the decision was not contested, and an ADR whose only option
was the only option records *what was built*, which is what the code already says. If a decision
really was single-option and high-impact, say so in its Context — but that needs a record with
alternatives, not an empty section.

**Authorship and status.** The default status is `Accepted`, because the grill user answered the
decision themselves. Two refinements: when the author resolves to the `grill-with-ui` fallback
(no `git config user.name`), the record is `Proposed` — there is no human behind it yet — and
say so in the Finish line. `Deprecated` is an allowed one-line Status change alongside
`Superseded by ADR-NNN`.

Zero ADRs is a valid outcome, and the Finish line says so. A decision that leaves the pipeline
is **not lost**: it stays a Locked decision in the design doc, and the design doc
cites `→ ADR-NNNN` only where a decision does have one — the missing pointer is the
visible trace of the filter. Record the counts (`durable` questions, `decisions`, `written`,
`skipped`) in `finished.pipeline`.

### Writing the file

For each decision that survives the pipeline:

```sh
node $SKILL/server.mjs adr --session <session> --folder <adr-folder> --title "<decision title>" [--status Proposed]
```

The command scaffolds `NNNN-slug.md` from `$SKILL/adr-template.md`: it claims the next
free number in the folder (never overwriting an existing file), writes the title, the
status, the date (the grill's start day, in local time) and the author (`git config
user.name` in the project, else `grill-with-ui`), and leaves every section heading in
place. It prints one line:
`{"path":"docs/adr/0003-storage-layout.md","number":3,"title":"Storage layout"}`.
Add `--status Proposed` when the user's own answer reserved approval ("propose it and I'll
decide"), and always when the author printed `grill-with-ui` because no `git config user.name`
was found — the default `Accepted` otherwise.

Then fill the sections. **Add content under the headings; never delete a heading and never
reorder them.** Every section is mandatory here, unlike MADR where most are optional: a
generated record that silently drops its rationale is worse than a slightly longer one. A
section with nothing to say says "None.", and no placeholder may
survive — replace `Option name` and the `…` in Decision Outcome.

Where each section comes from — every one from the session, never from the design doc
(the doc is written from the same material):

| Section | Source |
| --- | --- |
| Context and Problem Statement | the group's question bodies, the grill's `intent`, and what forced the decision now |
| Decision Drivers | every member's `rec.why` and `explore` pros |
| Considered Options | the union of the members' `options`, plus the `explore` cons — real options only, never invented; there are always at least two, because a group with none left the pipeline at stage 5 |
| Decision Outcome | the accepted answer(s) in active voice: "We will …" |
| Confirmation | how the decision is kept: a test, a lint rule, a review check, a fitness function, or the measurement that would reveal drift — "Not applicable." when nothing enforces it. This is how the decision is *verified*, not how it is *implemented*; the implementation lives in the design doc |
| More Information | the design doc this grill wrote, as a project-relative link, plus any related `ADR-NNNN` |
| Consequences | Good/Bad from the trade-off (`rec.why`, `explore` cons); Risks from the risks the session raised (deferred questions, thread notes) |

An ADR records **why**, not **how**: never write an implementation walkthrough under
Confirmation or More Information. The how changes and belongs to the design doc and the spec;
the ADR is immutable, so freezing it there makes a stale document that can only be fixed by
supersession.

Write the outcome in active voice — "We will store blobs on the filesystem", not "it was
decided that blobs are stored…".

### The three rules

1. **Immutable.** The record — Context, Drivers, Considered Options, Outcome,
   Confirmation, More Information, Consequences — is never edited. Only the `Status` line may
   change, and only to `Superseded by ADR-NNN` or `Deprecated`. To supersede: scaffold the new
   ADR (which allocates its number), write its body, then update the old file's Status line —
   one line, nothing else. The new ADR names the one it replaces in its Context section. When
   the superseding decision arrives from outside a grill — a pull request, a human later — the
   new ADR still names the old one, and updating the old Status line is the author's job;
   the rule travels in the file (the template's closing comment).
2. **Live in git.** The files live in the repository and are reviewed by pull request.
   This one is for the human reader, so it rides in the template's closing comment.
3. **One decision per record.** Never bundle two unrelated choices in one ADR.

### Status

`Accepted` unless the user's own answer reserved approval ("propose it and I'll decide"), or
unless the author resolved to the `grill-with-ui` fallback with no `git config user.name` —
both are `Proposed`. A grill never writes `Rejected` — a rejected *option* is a
Considered Option, not the record's status — and never writes `Superseded by …` at
creation. A conditional answer ("we will try X and revisit") is still `Accepted` for X;
the review trigger goes under Consequences → Risks. `Deprecated` is never written at creation
either: it is the one-line change a later reader makes when a decision is abandoned without a
replacement.

### Recording them

`finished.adrs` records the paths written, **one entry per file** (never one per
decision), project-relative. `finished.glossary` records the glossary's path when one was
written. `finished.pipeline` records the arithmetic — `{ "durable": 6, "decisions": 2,
"written": 1, "skipped": 1 }` — so a skipped decision leaves a trace in state, not only in
the Finish line. The server validates these shapes but never derives them; they are this
brief's rules.

## Relation to the other artifacts

Four artifacts, four different questions — do not blur them:

| Artifact | Owns | Answers |
| --- | --- | --- |
| the issue, in the repo's tracker | what to implement, and what closes it | *what* |
| the spec (written elsewhere, derived from that issue) | how to implement it correctly | *how* |
| an ADR | one irreversible choice, and what lost | *why* |
| the design doc | what this one conversation settled | *what was decided here* |

The exhaustive design doc (`.grill-with-ui/<yymmdd>-<topic-slug>/design.md`) is always written
and remains the per-topic record; the glossary and the ADRs are cumulative, standing artifacts
across grills — each in the bounded context a map scopes them to, or the repo's root
`GLOSSARY.md` and `docs/adr/` where no context map applies. Session-meta questions (ids
`q-domain` and `q-writing-profile`) produce no ADR. An old session's `q-domain` is ordinary
metadata now: answer it like any other question, and it changes nothing at Finish. A decision
that leaves the pipeline produces no ADR either: it stays a
Locked decision in the design doc, which cites `→ ADR-NNNN` only where a decision does have
one.

**Write order: glossary, then ADRs, then the design doc.** The doc is last because it cites the
ADRs' numbers. The glossary is **first**, not "at any point": it fixes the canonical term and
its _Avoid_ list, and an ADR is immutable, so writing ADRs before the glossary can freeze
non-canonical vocabulary into a file correctable only by supersession.

An ADR records *why*; the spec records *how*; the design doc records *what was decided here*.
The design doc and the ADRs are inputs to the spec — never its content. Finish does not write
a spec: it emits a readiness verdict (`SKILL.md` carries the signals, the issue anchor, and the
stop conditions) and leaves the template to the consuming repo.
