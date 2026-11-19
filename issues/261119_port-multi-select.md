---
date: 2026-11-19
type: Task
severity: High
status: Proposed
tags: [fork-sync, upstream-port, schema]
---

# Task: Port multi-select questions (upstream `multi`)

## Objective

Give a question several selectable options — upstream's `multi` field — which
the fork's schema does not accept today (verified: no `multi` anywhere in
`skills/grill-with-ui/SKILL.md`). This is a full contract ripple: schema,
validator, page, tests.

Upstream commit (tier REWORK):

- `f440aff` (2026-10-02, PR #27) — let a question take several options (`multi`)

## Tasks

- [ ] Show the user the diff of `f440aff` before porting
- [ ] Add `multi` to the state schema block at the end of
      `skills/grill-with-ui/SKILL.md` with its comment
- [ ] Accept it in `validateState` (`skills/grill-with-ui/server.mjs`)
- [ ] Render the multi-option control in `skills/grill-with-ui/page.html`
      (staged-action model unchanged: one Send still ships the staged answers)
- [ ] Port the send-line fields if the answer shape changes
- [ ] Adapt upstream's tests (`test/server.test.mjs`, `test/page.e2e.mjs`)
- [ ] Update `README.md`; bump `metadata.version` + `plugin.json` `version`

## Acceptance Criteria

- [ ] A question with `multi: true` lets the user stage several options
- [ ] Unknown fields are still rejected: a typo'd field fails validation
- [ ] Fork-only fields (`domainModeling`, `writingProfile`) still validate —
      schema compatibility check from the skill passes
- [ ] `task test` green; ripple checklist completed

## References

- Upstream: `f440aff` (PR #27) in `jasonku09/grill-with-ui`
- Ripple checklist: [.github/skills/fork-sync/references/contract-ripple.md](../.github/skills/fork-sync/references/contract-ripple.md)
- Fork files: `skills/grill-with-ui/{SKILL.md,server.mjs,page.html}`, `test/server.test.mjs`, `test/page.e2e.mjs`
