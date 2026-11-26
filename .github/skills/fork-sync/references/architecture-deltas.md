# Architecture deltas — the grilling loop, fork vs upstream

The durable record of **how the loop differs**: the correlation between a human
mutating state in the grilling UI, the agent ingesting those changes, and the
agent returning a patch the UI renders. Facts verified **2026-11-19** against
`upstream/main` (merge base `971bf21`, fork 121 ahead / 54 behind). Re-verify
with the recipe at the bottom before trusting an old line — this file is
consulted during Classify, never a substitute for the diff.

It exists because the coverage table answers *what* changed upstream; this file
answers *why a loop-touching port is adopt, adapt, or rewrite*. Ports that
ignore it end up adopting a mechanism the fork has already replaced.

## The shared contract (same in both repos — never re-litigate)

| Invariant | Meaning |
|-----------|---------|
| Two-file ownership | `state.json` written **only** by the agent via `patch`; `events.jsonl` appended **only** by the server, one line per Send. No locks. |
| Patch-only agent writes | A whole-file rewrite puts ~60 KB into the turn on every Send; a patch carries what changed. `null` deletes, one-level merges, server stamps times. |
| One Send = one turn = one atomic patch | `working` → outputs → `waiting` + `agent.handled` in a **single** patch; `agent.status` gates the Send button in the page. |
| Ingestion | agent reads `state.json` once, drains `pending` (sends past `agent.handled`), processes in order. |
| Render | page polls `GET /state` (`no-store`) and re-renders; staged answers live in the browser until Send. |
| Sessions outside the repo | `GRILL_HOME` (default `~/.grill-with-ui/sessions/...`), keyed by project root. |

A port that changes one of these rows is a contract change: run the
[ripple checklist](contract-ripple.md).

## Delta 1 — the wake channel (the fork's defining divergence)

| | Upstream | Fork |
|---|----------|------|
| Modes | Persistent Monitor, or **Wait mode**: the agent keeps its own turn alive in a foreground blocking `wait` loop ("a timeout means wait again, not end the interview") | Persistent Monitor, or **Extension monitor**: the grill-monitor extension runs `server.mjs wait --after <handled>` **outside the conversation** and delivers each Send as one `session.send` turn |
| Cost of idling | burns the agent's turn/context while waiting | zero — nothing runs in the chat while idle |
| No monitor, no tool | improvise the wait loop | **Installation gate**: `copilot plugin install arisng/grill-with-ui`; improvising a wait loop is forbidden |
| Serve support | `--detach` (serve.log), `listener.json` heartbeat written by `wait` | neither — deliberately absent |

**Port rule: adapt, never adopt.** Upstream commits shaped around Wait mode
(`serve-detach-heartbeat`, `wait-mode-listener-gate`, `--detach`) describe a
mechanism the fork replaced; take the intent (a liveness signal, a detached
serve) and re-express it in terms of the extension. See
[issues/0007-port-detach-heartbeat.md](../../../../issues/0007-port-detach-heartbeat.md).

## Delta 2 — listening truth (how the UI knows an agent will hear a Send)

| | Upstream | Fork |
|---|----------|------|
| Endpoint | `GET /listener` → `listening`, `via`, `at` | **none** |
| Signs of life | serve stdout read by a Monitor (`selfListening`), `listener.json` heartbeat from `wait`, `state.json` mtime from `patch`, evaluated under `LISTENER_FRESH_MS` | page-side heuristics only: `GONE_AFTER_MS` (server gone), pending-seq age, `agent.since` age |
| UI state | explicit `unheard`: "No agent is listening · sends will queue until it resumes" | soft warnings: "it may not be listening" |
| Agent-side truth | the heartbeat above | `grill_status` (attach state of the extension) |

**Port rule: this is an adapt with a design question.** In the fork the sign of
life should arguably be the *attach*, not `wait` — the extension, not a
foreground loop, is who will read the next event. Do not copy `listener.json`
mechanically; decide what "listening" means under Extension monitor first. Filed
with the detach/heartbeat port issue above.

## Delta 3 — payload surface (what may flow through the loop)

**Fork-only, outward (the fork's shape — protect these):**

- `GET /glossary` (with `/context` as read alias) — Terms panel merges live
  `state.terms` with the repo's `GLOSSARY.md`; `glossary`/`context`/`adr` CLI
  commands; `finished.glossary` / `finished.adrs`.
- The **decision pipeline** — no round-1 opt-in question; Finish always runs
  roster → eligibility by subject → cluster → split → screen and writes
  GLOSSARY.md + one ADR per surviving decision (legacy `domainModeling` accepted, ignored;
  legacy `CONTEXT*.md` read everywhere, written never); `finished.pipeline` records the counts.
- **Spec readiness verdict** at Finish (`spec-brief.md`, no `SKILL.md` bulk) — `recommended` /
  `not warranted` / `blocked`, anchored to an issue read from `.github/issue-tracker.json`
  (read-only; that manifest belongs to the `issue-tracking` skill).
- Visual contract — `visual.queued`, `version` bump rules, `stale` flag.
- **Client-side three-state theme** (`localStorage grill-theme`, deliberately
  not agent-owned state) — upstream's server-backed theme (`__GRILL_THEME__`,
  `POST /theme`) is its inverse. See
  [issues/0011-decision-dark-theme-upstream.md](../../../../issues/0011-decision-dark-theme-upstream.md).

**Inbound, gated (in `issues/`, never auto-applied):**

| Upstream capability | Loop impact | Record |
|---------------------|-------------|--------|
| Importance levels + ratings | new state fields: page controls + `validateState` + SKILL schema + tests must ripple together; the fork's validator rejects them today | [port-importance-ratings](../../../../issues/0004-port-importance-ratings.md) |
| Inline markdown (`markdown.mjs`) | thread rendering; server-side render vs page parity | [decision-inline-markdown](../../../../issues/0010-decision-inline-markdown.md) |
| Reply markers (upstream PR `jasonku09/grill-with-ui#40`) | how human replies correlate to question ids in state | [watch-upstream-prs](../../../../issues/0016-watch-upstream-prs.md) |
| `--lan` / `--detach` / per-serve LAN secret | serve exposure + wake (Delta 1) | [port-lan-mode](../../../../issues/0002-port-lan-mode.md), [port-detach-heartbeat](../../../../issues/0007-port-detach-heartbeat.md) |
| Localhost hardening (`/send` origin/token) | trust boundary of `POST /send` — **security: port first** | [port-localhost-hardening](../../../../issues/0001-port-localhost-hardening.md) |

**Schema-compatibility warning:** `validateState` is strict. A field one side
accepts and the other does not is a half-update — confirm both directions after
any `server.mjs` sync (the check lives in SKILL.md, "Schema compatibility").

## Delta 4 — where the loop terminates (Finish)

Upstream lands the interview in the design doc only. The fork, in domain mode,
additionally merges `GLOSSARY.md` and scaffolds one ADR per architecturally
significant decision, and groups per-topic outputs under
`.grill-with-ui/<yymmdd>-<slug>/`. A Finish-related upstream diff is therefore
usually a REWORK: take the intent, write it against the fork's artifact set.

## How to re-verify (the audit recipe)

```sh
git fetch upstream --prune

# Wake channel + listening truth, upstream side
git show upstream/main:SKILL.md   | grep -nE 'Wait mode|Persistent Monitor|foreground'
git show upstream/main:server.mjs | grep -nE 'listenerOf|LISTENER_FRESH|--lan|--detach|listener\.json'
git show upstream/main:page.html  | grep -nE '/listener|unheard|Importance|RATING_'

# Fork side — expect: Extension monitor / grill_attach present,
# and NO listenerOf / listener.json in server.mjs
grep -nE 'Extension monitor|grill_attach|Installation gate' skills/grill-with-ui/SKILL.md
grep -nE 'listener' skills/grill-with-ui/server.mjs || echo "no server-side listener (expected)"
grep -nE 'const cmds' skills/grill-with-ui/server.mjs   # glossary/context/adr = fork-only surface
```

If a re-verification contradicts a line here, fix this file in the same commit
as the change that invalidated it, and bump `metadata.version`.

## Rules of thumb for loop-touching ports

1. **Wake channel and listening truth:** the Extension monitor is fork-owned
   design — adapt the intent onto it; never reinstate Wait mode.
2. **Payload fields:** one ripple — `page.html` + `validateState` + SKILL schema
   + tests, in that dependency order, one commit each.
3. **Theme, domain/glossary, artifacts:** the fork wins; record the disagreement
   in `docs/design.md` instead of re-deciding.
4. **Security controls on `POST /send` and the serve surface:** port first,
   ahead of any feature — see the `[security]` flags in the report.
