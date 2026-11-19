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

**Tracker:** files are `NNNN-<slug>.md` with schema frontmatter
(`id`/`title`/`type`/`status`/`priority`/`created`/`theme`); the five themes
below mirror the phases. The generated views are [`tree.html`](tree.html)
(interactive) and [`tree.md`](tree.md); the gate is `task lint:issues` (also a
dependency of `task check`).

## Phase 1 — security (do first)

| Issue | Severity | Upstream commits |
|-------|----------|------------------|
| [0001-port-localhost-hardening.md](0001-port-localhost-hardening.md) | Critical | `9830e54`, `697d092` |
| [0002-port-lan-mode.md](0002-port-lan-mode.md) | High | `6ffe658`, `238f713` |

## Phase 2 — feature ports (by value)

| Issue | Severity | Upstream commits |
|-------|----------|------------------|
| [0003-port-multi-select.md](0003-port-multi-select.md) | High | `f440aff` |
| [0004-port-importance-ratings.md](0004-port-importance-ratings.md) | High | `7cb6693`, `fa319cf`, `ceb20d0`, `02e69f9` |
| [0005-port-visual-subagent-toggle.md](0005-port-visual-subagent-toggle.md) | Medium | `fb39c0d`, `cc71363`, `350eb28` |
| [0006-port-carried-notes.md](0006-port-carried-notes.md) | Medium | `9695ee7`, `a0d6a8d`, `b025d24` |
| [0007-port-detach-heartbeat.md](0007-port-detach-heartbeat.md) | Medium | `969bfa2`, `dccafbc`, `9d64da7` |
| [0008-port-cmd-enter-staging.md](0008-port-cmd-enter-staging.md) | Low | `85a2041` |
| [0009-reconcile-lineage-grilling.md](0009-reconcile-lineage-grilling.md) | Medium | lineage `grilling`: `95249b0` (10-07), `7739eae` (10-29) |

## Phase 3 — decisions (block related ports)

| Issue | Severity | Upstream commits |
|-------|----------|------------------|
| [0010-decision-inline-markdown.md](0010-decision-inline-markdown.md) | High | `40a5e6f`, `6166a49`, `6123fde`, `23415c8` |
| [0011-decision-dark-theme-upstream.md](0011-decision-dark-theme-upstream.md) | N/A | `3903c55` (defer), `5240431` (contrast) |
| [0012-decision-glossary-naming.md](0012-decision-glossary-naming.md) | Medium | **adopted 2026-11-19** — shipped in v0.10.0 |

## Phase 4 — CI, docs, housekeeping

| Issue | Severity | Upstream commits |
|-------|----------|------------------|
| [0013-port-ci-workflows.md](0013-port-ci-workflows.md) | Medium | 10 CI/chore ADOPTs + `b7742d6` |
| [0014-review-inline-drawing-docs.md](0014-review-inline-drawing-docs.md) | Low | `552f66a` |
| [0015-housekeeping-stale-main.md](0015-housekeeping-stale-main.md) | Low | — |

## Watching

| Issue | What |
|-------|------|
| [0016-watch-upstream-prs.md](0016-watch-upstream-prs.md) | open upstream PRs `#40` (reply markers), `#41` (dependabot) |
