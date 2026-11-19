---
date: 2026-11-19
type: RFC
severity: N/A
status: Open for Comment
tags: [fork-sync, decision, theme]
---

# RFC: Upstream's dark theme — defer wholesale, port only the contrast fix

## Summary

Confirm the standing decision: upstream's server-backed dark theme is a
**collision zone** and is deferred; only the standalone filled-button contrast
fix is worth porting to the fork's own client-side theme.

## Context

- `3903c55` (2026-09-23, PR #8, flagged `[security]`) — upstream's dark theme:
  server `ui.json` + `POST /theme` + `__GRILL_THEME__` substitution +
  `light-dark()`. The fork's theme is client-side (`localStorage grill-theme`,
  pre-paint head script, one `:root[data-theme="dark"]` block). Taking the diff
  would replace a locked fork decision.
- `5240431` (2026-10-12, PR #1, REWORK) — keep text on filled buttons readable
  in the dark theme. The same CSS pattern exists in the fork's page, so the
  *intent* applies even though the implementations differ.

## Proposal

1. **DEFER `3903c55`** — record in `docs/design.md` that upstream's
   server-backed theme was considered and rejected (fork-wins, already a
   locked decision; this issue is the record).
2. **ADAPT `5240431`** — read the diff, apply the contrast fix to the fork's
   own filled-button styles in `skills/grill-with-ui/page.html`, verify in
   both light and dark themes.

## Decision

- [ ] User confirms defer + contrast-only port
- [ ] Contrast fix applied and visually checked (`task detect` optional)

## References

- Upstream: `3903c55` (PR #8), `5240431` (PR #1) in `jasonku09/grill-with-ui`
- Fork theme rules: [.github/copilot-instructions.md](../.github/copilot-instructions.md)
  (locked fork shape), `docs/design.md` Terms
