# Domain brief

You are writing the optional repo-level docs a grill produces in domain-modeling mode (state
`domainModeling: true`) at Finish: a `CONTEXT.md` glossary and architecture
decision records in the folders the rules below pick. This file holds the rules; follow every one. Adapted
from the `domain-modeling` skill in mattpocock/skills (MIT):
https://github.com/mattpocock/skills/tree/main/skills/engineering

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
standing `docs/adr/` convention). Files numbered sequentially as `NNNN-slug.md` (four
digits) **within that folder**. Scan it for the highest existing number and increment;
create the folder lazily, only when the first ADR is needed.

- Write an ADR for exactly the grill's questions with `durable: true` AND status answered —
  that flag already encodes the three gates: hard to reverse, surprising without context,
  a real trade-off. Everything else never gets an ADR.
- Template:

      # {Short title}

      {1-3 sentences: the context, the decision, and why.}

  An ADR can be a single paragraph. The value is recording that a decision was made and
  why, not filling out sections.
- Add a **Considered options** bullet list only when the rejected alternatives are
  non-obvious — source material: the question's `options` and `rec.why` (the design doc
  records the same rejections under Locked decisions). Most ADRs won't need it.
- Never renumber or rewrite an existing ADR.

## Relation to the design doc

The exhaustive design doc (`.grill-with-ui/<yymmdd>-<topic-slug>/design.md`) is always written and
remains the per-topic record; the glossary and the ADRs are cumulative, standing artifacts
across grills — each in the bounded context a map scopes them to, or the repo's root
`CONTEXT.md` and `docs/adr/` where no context map applies. Session-meta questions (id `q-domain`) produce no ADR — they are never durable,
so this falls out naturally.
