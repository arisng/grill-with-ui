---
id: 0001
title: Port localhost hardening (body cap, Host allowlist, /visual CSP)
type: task
status: open
priority: P0
created: 2026-11-19
theme: 0017
severity: Critical
tags: [fork-sync, security, upstream-port]
related: [0002-port-lan-mode.md]
---

# Task: Port localhost hardening (body cap, Host allowlist, /visual CSP)

## Objective

Close the fork's three known security gaps by porting the intent of upstream's
hardening work — **not** its diff, because `server.mjs`, `README.md`, and the
tests are contested (all changed by both sides).

Upstream commits (tier REWORK, flagged `[security]`):

- `9830e54` (2026-10-18, PR #36) — refuse foreign `Host` headers, sandbox
  `/visual` with a CSP response header, cap request bodies (413)
- `697d092` (2026-10-18) — docs clarifying the localhost security guarantees
  and the visual sandbox

## Tasks

- [ ] Show the user the diff of `9830e54` and walk through it before porting
- [ ] Port the request body cap: `readBody` rejects over-limit bodies with 413
      and closes the socket
- [ ] Port the `Host` header allowlist: only self hosts are answered
- [ ] Port the `/visual` response header: `content-security-policy: sandbox
      allow-scripts` (the iframe attribute alone is not enough)
- [ ] Adapt upstream's denial tests to the fork's test files
      (`test/server.test.mjs`, `test/manual-visual.e2e.mjs`)
- [ ] Port the `697d092` doc wording after the code lands, so docs match reality
- [ ] Bump `skills/grill-with-ui/SKILL.md` `metadata.version` and `plugin.json`
      `version` together

## Acceptance Criteria

- [ ] Oversized bodies are refused with 413; the socket is closed
- [ ] Requests with a foreign `Host` header get no answer
- [ ] `/visual` responses carry the CSP sandbox header
- [ ] Upstream's three denial tests exist in the fork's suite and pass
- [ ] `task test` green (Windows skips respected); `waza check skills/grill-with-ui` green

## References

- Skill workflow: [.github/skills/fork-sync/SKILL.md](../.github/skills/fork-sync/SKILL.md)
- Ripple checklist: [.github/skills/fork-sync/references/contract-ripple.md](../.github/skills/fork-sync/references/contract-ripple.md)
- Upstream: `9830e54`, `697d092` in `jasonku09/grill-with-ui` (PR #36)
- Fork files: `skills/grill-with-ui/server.mjs`, `README.md`, `test/server.test.mjs`
