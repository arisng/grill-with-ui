---
id: 0008
title: Port Cmd+Enter two-press staging for Send
type: task
status: open
priority: P3
created: 2026-11-19
theme: 0018
severity: Low
tags: [fork-sync, upstream-port, page]
---

# Task: Port Cmd+Enter two-press staging for Send

## Objective

Small UX port: staging a compose draft with Cmd+Enter as a two-press send, so
an accidental keystroke does not ship the message.

Upstream commit (tier REWORK):

- `85a2041` (2026-09-28, PR #22) — stage compose drafts on Cmd+Enter for
  two-press send

## Tasks

- [ ] Show the user the diff before porting
- [ ] Port the two-press behaviour in `skills/grill-with-ui/page.html`
- [ ] Adapt `test/page.e2e.mjs`; fold into any open page-e2e conflicts once
      other page ports land (rebase the test hunks, do not stack blindly)
- [ ] Bump `metadata.version` + `plugin.json` `version` (page contract change)

## Acceptance Criteria

- [ ] First Cmd+Enter stages, second sends; Escape or edit clears the stage
- [ ] The staged draft survives a reload until Send (staged-action rule)
- [ ] `task test` green; ripple checklist completed

## References

- Upstream: `85a2041` (PR #22) in `jasonku09/grill-with-ui`
- Fork files: `skills/grill-with-ui/page.html`, `test/page.e2e.mjs`
