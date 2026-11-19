---
id: 0013
title: Port upstream's CI workflows, adapted to the fork
type: task
status: open
priority: P2
created: 2026-11-19
theme: 0020
severity: Medium
tags: [fork-sync, upstream-port, ci]
related: [0010-decision-inline-markdown.md]
---

# Task: Port upstream's CI workflows, adapted to the fork

## Objective

Give the fork the upstream safety net it lacks — the fork has **no
`.github/workflows/` at all** — but adapt rather than cherry-pick: upstream's
CI references `markdown.mjs` and test files the fork does not have (audit
finding H1).

Upstream commits (tier ADOPT unless noted):

- `c211421` — Dependabot for GitHub Actions
- `b50efbf` — Playwright page checks on PRs
- `159958c` — static checks for syntax and page independence
- `bb796e3` — server unit tests on node 20/22/24
- `39c06ca` — catch fetch and CSS import vectors in page checks
- `655db0c` — drop redundant node version log
- `c4f7cbb` — pin Playwright to major v1
- `797624d` — no-mistakes pipeline steps on Codex
- `026adb4` — dependabot actions group bumps
- `035f90f` — no-mistakes CI fixes (touches `test/page.e2e.mjs` — hand-resolve)
- `b7742d6` — listener test cleanup after browser failures (hand-resolve)

## Tasks

- [ ] Blocked by: [0010-decision-inline-markdown.md](0010-decision-inline-markdown.md)
      (upstream's CI runs markdown tests — decide first, then adapt the jobs)
- [ ] Show the user each workflow diff before adding it
- [ ] Add `.github/workflows/` files with paths/tests corrected to the fork's
      layout (`task test` on Linux runs the full suite — the three
      Windows-broken tests are Windows-only)
- [ ] Adapt `035f90f`'s `test/page.e2e.mjs` hunks and `b7742d6` against the
      fork's current tests
- [ ] Make CI green on a branch before merging (CI that fails on day one gets
      disabled)

## Acceptance Criteria

- [ ] A PR runs: unit tests, page e2e, static checks
- [ ] No job references a file the fork does not ship
- [ ] Dependabot config present; Actions pinned as upstream pinned them
- [ ] First real PR on `develop` shows all checks green

## References

- Upstream: the 11 commits above in `jasonku09/grill-with-ui`
- Fork: `.github/` (workflows to be created), `Taskfile.yml` (`task test`,
  `task test:e2e`)
