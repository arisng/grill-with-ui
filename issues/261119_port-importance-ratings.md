---
date: 2026-11-19
type: Task
severity: High
status: Proposed
tags: [fork-sync, upstream-port, schema]
---

# Task: Port importance levels and per-option rating chips

## Objective

Port upstream's importance levels and per-option rating chips — a genuine fork
gap (verified: no `importance`/rating in `skills/grill-with-ui/SKILL.md`). The
feature landed upstream as a reviewed cluster, so port it as one unit.

Upstream commits (tier REWORK unless noted):

- `7cb6693` (2026-10-18, PR #39) — the feature itself (schema + page + server)
- `fa319cf` (2026-10-18) — review fixes: question ordering, rating axis
  stability, pill contrast
- `ceb20d0` (2026-10-18) — doc clarifications, importance contracts, stale
  schema duplicates removed
- `02e69f9` (2026-10-18, ADOPT) — design doc `docs/importance-and-ratings-design.md`
  (cherry-picks cleanly; fork does not have the file)

## Tasks

- [ ] Show the user the diffs of `7cb6693` and `fa319cf` before porting
- [ ] Cherry-pick `02e69f9` (design doc) first — it documents the intent
- [ ] Add the importance/rating fields to the schema block in
      `skills/grill-with-ui/SKILL.md` and to `validateState`
- [ ] Render importance markers and rating chips in `skills/grill-with-ui/page.html`,
      including the `fa319cf` contrast/stability fixes
- [ ] Adapt upstream's tests (`test/server.test.mjs`, `test/page.e2e.mjs`)
- [ ] Update `README.md`; bump `metadata.version` + `plugin.json` `version`

## Acceptance Criteria

- [ ] A question can carry an importance level; an option can carry a rating
- [ ] The `fa319cf` review fixes are present (ordering, axis stability, contrast)
- [ ] Fork-only schema fields still validate; unknown fields still rejected
- [ ] `task test` green; ripple checklist completed

## References

- Upstream: `7cb6693`, `fa319cf`, `ceb20d0`, `02e69f9` (PR #39) in `jasonku09/grill-with-ui`
- Ripple checklist: [.github/skills/fork-sync/references/contract-ripple.md](../.github/skills/fork-sync/references/contract-ripple.md)
- Fork files: `skills/grill-with-ui/{SKILL.md,server.mjs,page.html}`, `README.md`, `test/server.test.mjs`, `test/page.e2e.mjs`
