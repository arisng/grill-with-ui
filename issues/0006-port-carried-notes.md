---
id: 0006
title: Port carried discussion notes on Send
type: task
status: open
priority: P2
created: 2026-11-19
theme: 0018
severity: Medium
tags: [fork-sync, upstream-port]
---

# Task: Port carried discussion notes on Send

## Objective

Fix a real UX gap: text typed into the discussion but not explicitly added is
lost on Send. Upstream fixed this in a reviewed cluster; the fork predates it.

Upstream commits (tier REWORK):

- `9695ee7` (2026-10-18, PR #37) — Send carries typed-but-not-added discussion text
- `a0d6a8d` (2026-10-18) — persist and display the carried notes before sending
- `b025d24` (2026-10-18) — docs clarifying typed-note sending and Finish

## Tasks

- [ ] Show the user the diffs before porting
- [ ] Port the carry-on-Send behaviour in `skills/grill-with-ui/page.html`
      (staged-action model: the note is part of the staged Send)
- [ ] Port the pre-send display of carried notes
- [ ] Adapt `test/page.e2e.mjs` coverage; fold in the `b025d24` docs wording
- [ ] Update `README.md`; bump `metadata.version` + `plugin.json` `version`

## Acceptance Criteria

- [ ] Typing in the discussion and pressing Send without "add" still delivers
      the text
- [ ] Carried notes are visible before the Send, not silently swallowed
- [ ] Explicitly added notes are not duplicated
- [ ] `task test` green; ripple checklist completed

## References

- Upstream: `9695ee7`, `a0d6a8d`, `b025d24` (PR #37) in `jasonku09/grill-with-ui`
- Fork files: `skills/grill-with-ui/{page.html,SKILL.md}`, `README.md`, `test/page.e2e.mjs`
