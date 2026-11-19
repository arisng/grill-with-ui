---
date: 2026-11-19
type: Task
severity: N/A
status: Proposed
tags: [fork-sync, triage, upstream]
---

# Index: upstream sync triage (2026-11-19)

The fork-sync report on 2026-11-19: **54 behind / 119 ahead** of
`jasonku09/grill-with-ui@main` (merge base `971bf21`) — **25 REWORK, 0 ADAPT,
12 ADOPT, 17 MERGE**, 5 flagged `[security]`. The 17 MERGE commits need no
action: their content is already counted in the other tiers. Every decision
and port is filed below as its own issue; work them incrementally in phase
order.

Standing rules (from [.github/skills/fork-sync/SKILL.md](../.github/skills/fork-sync/SKILL.md)):
never merge upstream wholesale; a commit's diff is evidence, not a patch —
**show the user the diff before porting**; contract changes run the ripple
checklist and bump `skills/grill-with-ui/SKILL.md` `metadata.version` together
with `plugin.json` `version`.

## Phase 1 — security (do first)

| Issue | Severity | Upstream commits |
|-------|----------|------------------|
| [261119_port-localhost-hardening.md](261119_port-localhost-hardening.md) | Critical | `9830e54`, `697d092` |
| [261119_port-lan-mode.md](261119_port-lan-mode.md) | High | `6ffe658`, `238f713` |

## Phase 2 — feature ports (by value)

| Issue | Severity | Upstream commits |
|-------|----------|------------------|
| [261119_port-multi-select.md](261119_port-multi-select.md) | High | `f440aff` |
| [261119_port-importance-ratings.md](261119_port-importance-ratings.md) | High | `7cb6693`, `fa319cf`, `ceb20d0`, `02e69f9` |
| [261119_port-visual-subagent-toggle.md](261119_port-visual-subagent-toggle.md) | Medium | `fb39c0d`, `cc71363`, `350eb28` |
| [261119_port-carried-notes.md](261119_port-carried-notes.md) | Medium | `9695ee7`, `a0d6a8d`, `b025d24` |
| [261119_port-detach-heartbeat.md](261119_port-detach-heartbeat.md) | Medium | `969bfa2`, `dccafbc`, `9d64da7` |
| [261119_port-cmd-enter-staging.md](261119_port-cmd-enter-staging.md) | Low | `85a2041` |
| [261119_reconcile-lineage-grilling.md](261119_reconcile-lineage-grilling.md) | Medium | lineage `grilling`: `95249b0` (10-07), `7739eae` (10-29) |

## Phase 3 — decisions (block related ports)

| Issue | Severity | Upstream commits |
|-------|----------|------------------|
| [261119_decision-inline-markdown.md](261119_decision-inline-markdown.md) | High | `40a5e6f`, `6166a49`, `6123fde`, `23415c8` |
| [261119_decision-dark-theme-upstream.md](261119_decision-dark-theme-upstream.md) | N/A | `3903c55` (defer), `5240431` (contrast) |
| [261119_decision-glossary-naming.md](261119_decision-glossary-naming.md) | Medium | **adopted 2026-11-19** — shipped in v0.10.0 |

## Phase 4 — CI, docs, housekeeping

| Issue | Severity | Upstream commits |
|-------|----------|------------------|
| [261119_port-ci-workflows.md](261119_port-ci-workflows.md) | Medium | 10 CI/chore ADOPTs + `b7742d6` |
| [261119_review-inline-drawing-docs.md](261119_review-inline-drawing-docs.md) | Low | `552f66a` |
| [261119_housekeeping-stale-main.md](261119_housekeeping-stale-main.md) | Low | — |

## Watching

| Issue | What |
|-------|------|
| [261119_watch-upstream-prs.md](261119_watch-upstream-prs.md) | open upstream PRs `#40` (reply markers), `#41` (dependabot) |
