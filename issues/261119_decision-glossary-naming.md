---
date: 2026-11-19
type: RFC
severity: Medium
status: Open for Comment
tags: [fork-sync, decision, lineage, domain-modeling]
---

# RFC: CONTEXT.md vs GLOSSARY.md — the lineage rename

## Summary

The method lineage (`mattpocock/skills`) renamed its artifacts on 2026-09-17:
`CONTEXT.md` / `CONTEXT-MAP.md` became `GLOSSARY.md` / `GLOSSARY-MAP.md`.
The fork still ships the old names everywhere (domain-modeling mode,
`server.mjs context` routing, `CONTEXT-MAP.md` parsing, the README, the briefs).
Decide once, then stop re-litigating.

## Context

- The fork's domain-modeling mode is **not upstream's** — it is the fork's own
  shape, ported from the lineage. Nothing forces the rename; it is a drift
  question, not a sync item.
- The rename ripples through: `skills/grill-with-ui/SKILL.md` (schema +
  instructions), `server.mjs context` command, `domain-brief.md`, `README.md`,
  `.github/copilot-instructions.md`, evals, and every existing session's
  artifacts.

## Alternatives

1. **Keep `CONTEXT.md`** — no churn; record in `docs/design.md` that the
   lineage rename was considered and rejected (the fork's name predates it and
   existing grills already carry the file).
2. **Adopt `GLOSSARY.md`** — align with the lineage; requires a compatibility
   story for existing `CONTEXT.md` files (read both, or migrate on next Finish).
3. **Accept both** — read whichever exists; write new ones as `GLOSSARY.md`.

## Decision

- [ ] User decides: keep / rename / accept-both — then record it as a durable
      decision in `docs/design.md` and update the skill accordingly (if it
      ripples, that is a contract change: bump versions together)

## References

- Lineage drift table: [.github/skills/fork-sync/references/mattpocock-lineage.md](../.github/skills/fork-sync/references/mattpocock-lineage.md)
- Fork files: `skills/grill-with-ui/{SKILL.md,server.mjs,domain-brief.md}`, `README.md`
