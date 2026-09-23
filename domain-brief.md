# Domain brief

You are writing the optional repo-level docs a grill produces in domain-modeling mode (state
`domainModeling: true`) at Finish: a glossary at the repo root (`CONTEXT.md`) and architecture
decision records under `docs/adr/`. This file holds the rules; follow every one. Adapted
from the `domain-modeling` skill in mattpocock/skills (MIT):
https://github.com/mattpocock/skills/tree/main/skills/engineering

## CONTEXT.md

Location: the repo root. Under a `## Language` section, one entry per term, in bold-term
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

Location: `docs/adr/`, files numbered sequentially as `NNNN-slug.md` (four digits). Scan
the directory for the highest existing number and increment; create the directory lazily,
only when the first ADR is needed.

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

The exhaustive design doc (`.grill-with-ui/<topic-slug>/design.md`) is always written and
remains the per-topic record; `CONTEXT.md` and the ADRs are cumulative, repo-level artifacts
across grills. Session-meta questions (id `q-domain`) produce no ADR — they are never durable,
so this falls out naturally.
