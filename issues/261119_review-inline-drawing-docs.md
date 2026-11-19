---
date: 2026-11-19
type: Task
severity: Low
status: Proposed
tags: [fork-sync, upstream-port, docs]
---

# Task: Review upstream's inline-drawing documentation clarifications

## Objective

Read upstream's doc-only clarifications about inline drawing and decide,
line by line, whether the fork's drawing/visualize docs need the same words.
Docs are contract-adjacent here: `visual-brief.md` and `docs/visualize-design.md`
are contested files.

Upstream commit (tier REWORK):

- `552f66a` (2026-10-05) — clarify inline drawing documentation and verify
  static checks; touches `README.md`, `SKILL.md`, `visual-brief.md`,
  `docs/visualize-design.md`

## Tasks

- [ ] Show the user the diff before porting any wording
- [ ] Compare each clarified statement against the fork's current docs —
      keep the fork's wording where the fork's behaviour differs
- [ ] Port only statements that are true of the fork's inline drawing
- [ ] If wording changes a rule, ripple it: `skills/grill-with-ui/SKILL.md`,
      `visual-brief.md`, `README.md`, Terms sections

## Acceptance Criteria

- [ ] Every ported statement is verified true against the fork's behaviour
- [ ] No fork-specific wording was overwritten wholesale
- [ ] Vocabulary stays consistent with the design docs' Terms sections

## References

- Upstream: `552f66a` in `jasonku09/grill-with-ui`
- Fork files: `README.md`, `skills/grill-with-ui/{SKILL.md,visual-brief.md}`,
  `docs/visualize-design.md`
