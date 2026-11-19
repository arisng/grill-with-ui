---
id: 0007
title: Port `serve --detach` with the wait-mode heartbeat
type: task
status: open
priority: P2
created: 2026-11-19
theme: 0018
severity: Medium
tags: [fork-sync, upstream-port, server]
---

# Task: Port `serve --detach` with the wait-mode heartbeat

## Objective

Port upstream's detached-serve mode and its listening heartbeat, which keeps
`wait` mode honest about a live server. The fork's extension monitor runs
`server.mjs wait`, so the heartbeat composes with the existing flow.

Upstream commits (tier REWORK):

- `969bfa2` (2026-10-18, PR #38) — `--detach` plus a listening heartbeat for
  wait mode
- `dccafbc` (2026-10-21) — `--detach` composes with `--lan`, `--host`, `--open`
- `9d64da7` (2026-10-18) — docs for detached startup and the listener

## Tasks

- [ ] Show the user the diffs before porting
- [ ] Port `--detach` and the heartbeat in `skills/grill-with-ui/server.mjs`
      (CLI output contract: one short line, never the state)
- [ ] Verify composition with the fork's flags (`--port`, `SESSION=DIR`) and
      note any upstream flag the fork does not have
- [ ] Adapt `test/server.test.mjs` and upstream's `test/listener.e2e.mjs`
      (decide whether that file maps onto the fork's extension tests in
      `.github/extensions/grill-monitor/test/`)
- [ ] Update `README.md`; fold in the `9d64da7` docs; bump versions together

## Acceptance Criteria

- [ ] `--detach` returns immediately; the server survives the parent shell
- [ ] `wait` mode reports the heartbeat; a dead server is still detected
- [ ] CLI error/success output keeps the one-line contract
- [ ] `task test` and `task test:ext` green

## References

- Upstream: `969bfa2`, `dccafbc`, `9d64da7` (PR #38) in `jasonku09/grill-with-ui`
- Fork files: `skills/grill-with-ui/server.mjs`, `README.md`, `test/server.test.mjs`,
  `.github/extensions/grill-monitor/`
