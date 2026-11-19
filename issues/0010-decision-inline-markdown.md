---
id: 0010
title: Adopt upstream's inline markdown rendering (brings `markdown.mjs`)
type: task
status: open
priority: P1
created: 2026-11-19
theme: 0019
severity: High
tags: [fork-sync, decision, markdown]
---

# RFC: Adopt upstream's inline markdown rendering (brings `markdown.mjs`)

## Summary

Decide whether the fork adopts upstream's inline markdown rendering for
questions, options, and threads. This is a **decision first, port second**:
the cluster adds `markdown.mjs`, a file the fork does not ship, plus parity
tests and CI references.

## Motivation

The fork has **zero markdown handling** in `skills/grill-with-ui/page.html`
(verified 2026-11-19) — question bodies render as plain text. Upstream ships
rendering with link safety (`http(s)`-only) and theme-aware code spans. The
gap is a genuine UX difference between the fork and upstream.

Upstream commits (tier REWORK):

- `40a5e6f` (2026-10-02, PR #9) — render inline markdown; adds `markdown.mjs`,
  `test/markdown.test.mjs`, `test/page-markdown-parity.test.mjs`
- `6166a49` (2026-10-05) — review fixes: links, emphasis, parity
- `6123fde` (2026-10-21) — `http(s)`-only links, theme-aware code spans
- `23415c8` (2026-10-21) — SKILL.md note: the page renders inline markdown only

## Alternatives

1. **Adopt the cluster** — port `markdown.mjs`, the page renderer, and the
   parity tests; adapt the SKILL.md note; the fork gains the capability and
   the CI issue ([0013-port-ci-workflows.md](0013-port-ci-workflows.md))
   can reference the real files.
2. **Defer** — keep plain text; record a fork-wins decision in
   `docs/design.md`. The CI issue must then be adapted to skip markdown jobs.
3. **Client-side only** — render markdown in `page.html` without
   `markdown.mjs`, dropping the parity tests. Simpler install surface, but
   abandons upstream's tested renderer and diverges from the parity contract.

## Open questions

- Does the fork want markdown in interview prose at all, or is plain text a
  deliberate reading-clarity choice of the writing-clarity profile?
- If adopting: does `markdown.mjs` live at the repo root (upstream's path) or
  under `skills/grill-with-ui/`?

## Decision

- [ ] User decides: adopt / defer / client-side only — then update this file
      and record the durable decision in `docs/design.md`

## References

- Upstream: `40a5e6f`, `6166a49`, `6123fde`, `23415c8` (PRs #9, #26)
- Related: [0013-port-ci-workflows.md](0013-port-ci-workflows.md),
  [0014-review-inline-drawing-docs.md](0014-review-inline-drawing-docs.md)
