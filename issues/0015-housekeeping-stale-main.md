---
id: 0015
title: Housekeeping — fast-forward the stale `main` branch
type: chore
status: open
priority: P3
created: 2026-11-19
theme: 0020
severity: Low
tags: [fork-sync, housekeeping]
---

# Task: Housekeeping — fast-forward the stale `main` branch

## Objective

The local (and origin) `main` branch is a pre-plugin-era snapshot, behind its
own `origin/main` and far behind `develop`. A fresh clone that checks out
`main` gets old behaviour — the "silent drift" failure mode the fork-sync
skill names.

## Tasks

- [ ] Confirm `develop` is the default branch on GitHub (`origin/HEAD` →
      `develop` — verified 2026-11-19)
- [ ] Fast-forward `main` to match `origin/main`, then decide: point `main`
      at `develop`, or archive/delete it so only `develop` is published
- [ ] Record the choice in `docs/design.md` if it is durable

## Acceptance Criteria

- [ ] `git branch -vv` shows `main` with no "behind N" marker
- [ ] A fresh clone's default branch carries the plugin-era layout

## References

- `.github/skills/fork-sync/SKILL.md` — "Silent drift" failure mode
- Current state: `main` behind `origin/main` by 4; `develop` @ `f6a25f1`
