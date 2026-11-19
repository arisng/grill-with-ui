---
id: 0005
title: Port the Visualize "Use subagent" checkbox
type: task
status: open
priority: P2
created: 2026-11-19
theme: 0018
severity: Medium
tags: [fork-sync, upstream-port]
---

# Task: Port the Visualize "Use subagent" checkbox

## Objective

Port upstream's opt-in checkbox that draws the visual through a subagent
instead of inline, plus its copy and doc follow-ups. Verify at port time
whether the fork's visual flow already has an equivalent toggle.

Upstream commits (tier REWORK):

- `fb39c0d` (2026-10-05, PR #29) — the checkbox itself (page + skill + README)
- `cc71363` (2026-10-05) — reworded the "Use subagent" info bubble
- `350eb28` (2026-10-05) — doc consolidation for visualization modes

## Tasks

- [ ] Show the user the diffs before porting
- [ ] Check whether the fork already has a subagent path for Visualize
      (`visual.queued` / the grill-monitor flow) — record a fork-wins outcome
      if so, rather than porting a duplicate
- [ ] If porting: add the checkbox to `skills/grill-with-ui/page.html`, the
      state/send fields to `SKILL.md`, and the agent-side handling
- [ ] Adapt `test/manual-visual.e2e.mjs` and `test/page.e2e.mjs`
- [ ] Fold in the `cc71363` wording; update `README.md`; bump versions together

## Acceptance Criteria

- [ ] The checkbox appears in the Visualize panel and its staged state survives
      a reload until Send
- [ ] A decision (port or fork-wins) is recorded in `docs/design.md` either way
- [ ] `task test` green; ripple checklist completed

## References

- Upstream: `fb39c0d`, `cc71363`, `350eb28` (PR #29) in `jasonku09/grill-with-ui`
- Fork files: `skills/grill-with-ui/{SKILL.md,page.html}`, `README.md`,
  `test/manual-visual.e2e.mjs`, `test/page.e2e.mjs`
