# Domain brief

You are writing the optional repo-level docs a grill produces in domain-modeling mode (state
`domainModeling: true`) at Finish: a `CONTEXT.md` glossary and architecture
decision records in the folders the rules below pick. This file holds the rules; follow every one. Adapted
from the `domain-modeling` skill in mattpocock/skills (MIT):
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

## CONTEXT.md

Location: resolve it before writing anything — `node $SKILL/server.mjs context --session
<session>` prints one JSON line holding everything this step needs:

- `map: false` (the usual repo): the repo-root `CONTEXT.md`, as always.
- `map: true`: the repo scopes one glossary per bounded context. `contexts` lists each one
  read from the root `CONTEXT-MAP.md` — `name`, the glossary's `path`, its `folder`, and
  the ADR folder for it. Match this grill's topic and intent against the context names and
  the map's one-line descriptions (read `CONTEXT-MAP.md` itself when the short list is not
  enough to judge):
  - **One clear match** → use it. Its `CONTEXT.md` exists: merge into that file — that is
    the update-a-context case. It does not exist: create it in the context's `folder`,
    which is this context's location.
  - **Several plausible, or none** → ask the user in the terminal before writing anything.
    Offer the candidates, then `fallback` (beside the design doc), then "no glossary this
    grill", and take the answer as the location. A confident match is never worth
    interrupting for; an uncertain one is never guessed.
- Whatever location wins, the `finished` patch records its project-relative path as
  `context`; that recorded path is what the Terms panel then reads.

The map owns the root: never create a repo-root `CONTEXT.md` in a mapped repo — that slot
belongs to `CONTEXT-MAP.md` itself.

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
- **Merge, never clobber.** If `CONTEXT.md` already exists, read it first; append or update
  only the terms from this grill. Never reorder, overwrite, or delete existing entries or
  any other section.

## ADRs

Location: the folder `$SKILL/server.mjs context` reports for the location chosen above —
its `adr` for a matched context (whichever of `docs/adr/` or `.docs/adr/` already exists
inside that context, `docs/adr/` when neither or both), `fallbackAdr` otherwise (the
standing `docs/adr/` convention). Files are numbered sequentially as `NNNN-slug.md` (four
digits) **within that folder**, and the folder is created lazily, only when the first ADR
is needed.

An ADR records a **decision**, not a question: one file per architecturally significant
decision — never one file per question, and never one file for two independent decisions.

### Which decisions get an ADR

The candidates are the answered `durable: true` questions — the ones that pass the three
gates (hard to reverse, surprising without context, a real trade-off). A question that is
open, reopened or deferred is never a candidate, and a decision reached only in a thread
was never recorded as a decision: a thread message never answers the question itself, so
do not mine threads for answers.

Work in this order — **cluster, split, then screen** — and screen groups, never questions.

1. **Cluster.** Two candidates settle the same decision when their answers could not
   change independently. Test: could you change one answer without changing the other? If
   yes, they are two decisions. Questions that all answer "where does this live" are one
   decision; storage engine and retry budget are two.
2. **Split.** If one answer states two commitments that could change independently, that is
   two decisions, each with its own ADR.
3. **Screen.** A group gets an ADR only when a newcomer who has the code but not the grill
   would plausibly have chosen differently. Test: *delete this ADR — would they build the
   same thing?* If yes, the code already tells them: **no ADR**. If no, the ADR is
   required. A decision that binds a contract, a data store, an external dependency, or a
   deployment unit always passes. Screen the group: commitments that are individually
   local but jointly structural are significant together.

Zero ADRs is a valid outcome, and the Finish line says so. A durable decision that gets
no ADR is **not lost**: it stays a Locked decision in the design doc, and the design doc
cites `→ ADR-NNNN` only where a decision does have one — the missing pointer is the
visible trace of the filter.

### Writing the file

For each decision that survives the screen:

```sh
node $SKILL/server.mjs adr --session <session> --folder <adr-folder> --title "<decision title>" [--status Proposed]
```

The command scaffolds `NNNN-slug.md` from `$SKILL/adr-template.md`: it claims the next
free number in the folder (never overwriting an existing file), writes the title, the
status, the date (the grill's start day, in local time) and the author (`git config
user.name` in the project, else `grill-with-ui`), and leaves every section heading in
place. It prints one line:
`{"path":"docs/adr/0003-storage-layout.md","number":3,"title":"Storage layout"}`.
Add `--status Proposed` only when the user's own answer reserved approval; the default is
`Accepted`.

Then fill the sections. **Add content under the headings; never delete a heading and never
reorder them.** A section with nothing to say says "None.", and no placeholder may
survive — replace `Option name` and the `…` in Decision Outcome.

Where each section comes from — every one from the session, never from the design doc
(the doc is written from the same material):

| Section | Source |
| --- | --- |
| Context and Problem Statement | the group's question bodies, the grill's `intent`, and what forced the decision now |
| Decision Drivers | every member's `rec.why` and `explore` pros |
| Considered Options | the union of the members' `options`, plus the `explore` cons — real options only, never invented; "None." when there were none |
| Decision Outcome | the accepted answer(s) in active voice: "We will …" |
| Technical Implementation | the settled answers and the thread notes; "Not applicable." when the decision is not about implementation |
| Consequences | Good/Bad from the trade-off (`rec.why`, `explore` cons); Risks from the risks the session raised (deferred questions, thread notes) |

Write the outcome in active voice — "We will store blobs on the filesystem", not "it was
decided that blobs are stored…".

### The three rules

1. **Immutable.** The record — Context, Drivers, Considered Options, Outcome,
   Implementation, Consequences — is never edited. Only the `Status` line may change, and
   only to `Superseded by ADR-NNN`. To supersede: scaffold the new ADR (which allocates
   its number), write its body, then update the old file's Status line — one line,
   nothing else. The new ADR names the one it replaces in its Context section. When the
   superseding decision arrives from outside a grill — a pull request, a human later — the
   new ADR still names the old one, and updating the old Status line is the author's job;
   the rule travels in the file (the template's closing comment).
2. **Live in git.** The files live in the repository and are reviewed by pull request.
   This one is for the human reader, so it rides in the template's closing comment.
3. **One decision per record.** Never bundle two unrelated choices in one ADR.

### Status

`Accepted` unless the user's own answer reserved approval ("propose it and I'll decide"),
which is `Proposed`. A grill never writes `Rejected` — a rejected *option* is a
Considered Option, not the record's status — and never writes `Superseded by …` at
creation. A conditional answer ("we will try X and revisit") is still `Accepted` for X;
the review trigger goes under Consequences → Risks.

### Recording them

`finished.adrs` records the paths written, **one entry per file** (never one per
decision), project-relative. The server accepts any array of strings, so this is the
brief's rule, not the server's.

## Relation to the design doc

The exhaustive design doc (`.grill-with-ui/<yymmdd>-<topic-slug>/design.md`) is always written and
remains the per-topic record; the glossary and the ADRs are cumulative, standing artifacts
across grills — each in the bounded context a map scopes them to, or the repo's root
`CONTEXT.md` and `docs/adr/` where no context map applies. Session-meta questions (ids
`q-domain` and `q-writing-profile`) produce no ADR — they are never durable, so this falls out
naturally. A durable decision that the screen rules out produces no ADR either: it stays a
Locked decision in the design doc, which cites `→ ADR-NNNN` only where a decision does have
one.

The design doc is written **after** the ADRs, because it cites their numbers. Write the
ADRs first, then the design doc. The glossary needs neither and can land at any point.
