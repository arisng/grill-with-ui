---
date: 2026-11-19
type: Task
severity: High
status: Proposed
tags: [fork-sync, security, upstream-port]
related: [261119_port-localhost-hardening.md]
---

# Task: Port opt-in LAN mode with browser auto-open

## Objective

Port upstream's opt-in LAN mode so the grill can be opened from another device
on the network, authenticated by a token — built **on top of** the localhost
hardening, which is why it is sequenced after it.

Upstream commits (tier REWORK, flagged `[security]`):

- `6ffe658` (2026-10-22, PR #25) — opt-in `--lan` mode and browser auto-open;
  adds token auth
- `238f713` (2026-10-21) — lets a token-authenticated LAN request use any
  `Host` header (depends on the token that `6ffe658` introduces)

## Tasks

- [ ] Blocked by: [261119_port-localhost-hardening.md](261119_port-localhost-hardening.md)
- [ ] Show the user both diffs and the dependency before porting
- [ ] Port the `--lan` / `--host` / `--open` flag behaviour and the token check
- [ ] Port the `238f713` Host exemption **for token-authenticated requests only**
- [ ] Adapt upstream's tests (`test/server.test.mjs`, PR #25 coverage)
- [ ] Update `README.md` usage and the `skills/grill-with-ui/SKILL.md` CLI notes
- [ ] Bump `metadata.version` and `plugin.json` `version` together

## Acceptance Criteria

- [ ] LAN mode is off by default; enabling it requires the token
- [ ] A token-authenticated request from another device is served; without the
      token it gets no answer
- [ ] Non-LAN behaviour is unchanged (regression: hardening issue still holds)
- [ ] `task test` green; docs describe the flags

## References

- Upstream: `6ffe658` (PR #25), `238f713` in `jasonku09/grill-with-ui`
- Prerequisite: [261119_port-localhost-hardening.md](261119_port-localhost-hardening.md)
- Fork files: `skills/grill-with-ui/server.mjs`, `skills/grill-with-ui/SKILL.md`, `README.md`
