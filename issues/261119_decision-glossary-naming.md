---
date: 2026-11-19
type: RFC
severity: Medium
status: Accepted
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

- [x] User decided (2026-11-19): **adopt `GLOSSARY.md` / `GLOSSARY-MAP.md`** — option 2,
  with option 3's acceptance as the compatibility story.

## Resolution (implemented 2026-11-19, released v0.10.0)

- Everything new is written under the GLOSSARY names: Finish output, `fallback` targets,
  the `finished.glossary` field, `GET /glossary`, the `server.mjs glossary` command, and
  the repo's own root glossary (renamed `CONTEXT.md` → `GLOSSARY.md`).
- The server **reads the legacy names everywhere** — root file, `CONTEXT-MAP.md`, map
  links to `CONTEXT.md`, the recorded `finished.context` field, the `/context` endpoint
  alias, and the `context` command alias — so pre-rename sessions and unmigrated repos
  keep working with no migration pass.
- `domain-brief.md` renames a legacy file on first contact at Finish — one file, never
  both. `docs/design.md` carries the dated decision entry; its older dated entries keep
  their original names as recorded.
- Ripple shipped together: `server.mjs`, `page.html`, the tests (44/44, incl. three
  legacy-acceptance tests), `SKILL.md` + briefs + `writing-clarity.md`, the
  `finish-domain-docs` eval, README, repo instructions, plugin/marketplace manifests.

## References

- Lineage drift table: [.github/skills/fork-sync/references/mattpocock-lineage.md](../.github/skills/fork-sync/references/mattpocock-lineage.md)
- Fork files: `skills/grill-with-ui/{SKILL.md,server.mjs,domain-brief.md}`, `README.md`
