---
date: 2026-11-19
type: Task
severity: Medium
status: Proposed
tags: [fork-sync, upstream, watch]
---

# Task: Watch the two open upstream PRs

## Objective

Two upstream pull requests are open; neither is in the 54-commit scan yet.
Handle each when it lands (or cherry-pick the branch deliberately).

## PRs

- **#40** `feat/new-reply-markers` (2026-10-20) — new-reply markers and
  next-unread navigation. A **feature**: when merged, triage it fresh (will
  likely be REWORK — `page.html` + `SKILL.md` are contested). Evaluate value:
  unread tracking in long threads.
- **#41** dependabot `actions/setup-node` 6 → 7 (2026-10-22). Mechanical;
  arrives with the next scan after merge — but only matters once
  [261119_port-ci-workflows.md](261119_port-ci-workflows.md) has given the
  fork any workflows at all.

## Tasks

- [ ] Re-run `task sync-report` after either merges; triage the new commits
      through the normal classify → show-diff → port flow
- [ ] If #40 stalls and the feature is wanted, cherry-pick its branch instead
      of waiting

## Acceptance Criteria

- [ ] Neither PR is silently missed: next scan picks it up or it is
      deliberately skipped with a recorded reason

## References

- Open PRs listed by: `node .github/skills/fork-sync/scripts/sync-report.mjs`
- Upstream: `jasonku09/grill-with-ui` PRs #40, #41
