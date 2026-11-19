# Source map — the fork-sync coverage table

Everything the forked plugin depends on, how each dependency is kept current,
and what the report checks on its own. **When the user asks "are we up to
date?", fill this table with the report's live values and present it** — the
tier counts alone are not the answer.

The report (`sync-report.mjs`) prints four gap sections: incoming commits
tiered, install freshness, lineage drift with new-skill detection, and open
upstream PRs. Everything else in this table is checked by hand at the cadence
noted per row.

## A. Code upstream — `jasonku09/grill-with-ui`

| What it provides | Kept current by | Cadence |
|------------------|-----------------|---------|
| Commits, branches, PRs: features, fixes, CI, docs | the report's tier classification (REWORK/ADAPT/ADOPT/MERGE) + `issues/` triage | every activation; triage lands as issues, ports never auto-apply |

Gap detail lives in [upstream-repo.md](upstream-repo.md) and the per-commit
files under `issues/`. The **loop-shape deltas** — wake channel, listening
truth, payload surface, Finish — are recorded in
[architecture-deltas.md](architecture-deltas.md); a port touching any of them
consults that file before it consults the diff.

## B. Method lineage — `mattpocock/skills`

No merge base, so freshness is **pinned, not merged**: `lineage.json` (next to
`SKILL.md`) records each dependency's last *audited* commit, a snapshot of
every skill path in the repo (`knownSkills`), and the relevance keywords.

| Dependency | What the fork receives | Pin semantics |
|------------|------------------------|---------------|
| `skills/productivity/grilling` | interview method → `SKILL.md`, question wording → `writing-clarity.md` | `pinnedCommit`/`pinnedDate` = last audit, **not** what is ported |
| `skills/engineering/domain-modeling` | glossary + ADR discipline → `domain-brief.md`, `adr-template.md`, the `durable` gates | same |
| `skills/engineering/grill-with-docs` | the original two-skill composition shim | same |

**The report's Lineage section, deterministically:**

1. **Pin drift** — for each pinned path, the live tip commit vs `pinnedCommit`.
   `DRIFTED` means: read the new commits, reconcile (always ADAPT, never a
   cherry-pick — see [mattpocock-lineage.md](mattpocock-lineage.md)), file an
   `issues/` record, and only then update the pin. **A stable pin means
   "audited", not "ported"** — the porting backlog lives in `issues/`.
2. **New skills** — the live skill tree (every dir with a `SKILL.md`) is
   set-diffed against `knownSkills`. Any path outside the snapshot is reported;
   paths matching `relevanceKeywords` are additionally marked *relevance
   candidates*. Detection is deterministic; **relevance is a human call** —
   audit the description, then either add the skill as a pinned dependency or
   record the rejection in the table below (and it stays in `knownSkills`, so
   it is never re-flagged).
3. **Gone skills** — a `knownSkills` entry missing from the live tree means a
   rename or removal: re-read the shim/composition before assuming.

### New-skill audit record

| Date | Skill | Verdict |
|------|-------|---------|
| 2026-11-19 | `productivity/grill-me` | rejected — a two-line alias that invokes `grilling` |
| 2026-11-19 | `productivity/to-questionnaire` | rejected — async questionnaire output, a different product; no method consumed |
| 2026-11-19 | `productivity/wait-what` | rejected — re-pitch helper, not part of the interview method |
| 2026-11-19 | `productivity/writing-for-agents` | rejected — skill-authoring guidance; the fork uses skill-creator and its own briefs |
| 2026-11-19 | `in-progress/writing-{shape,beats,fragments}` | rejected — article-writing experiments, unrelated to the interview's writing-clarity profile |

## C. Shipped plugin surface

| Dependency | What it provides | Kept current by |
|------------|------------------|-----------------|
| `plugin.json` (agent-plugins.org schema 1.0.0) | one-command install | `copilot plugin install arisng/grill-with-ui` validates it; version paired with the skill's `metadata.version` |
| `.github/plugin/marketplace.json` | the repo as its own marketplace | `copilot --plugin-dir . plugin list` (offline validation) |
| `.github/extensions/grill-monitor/` (v0.1.0, no runtime deps — the host provides the SDK) | wakes the agent once per Send | `task ext-install`; freshness = byte diff of the two folders |
| `.mcp.json` | Playwright MCP for development | floating `npx @playwright/mcp@latest` — re-check when the page workflow changes |

## D. Install targets (what actually runs)

| Copy | Freshness signal | Remedy |
|------|------------------|--------|
| `~/.copilot/installed-plugins/grill-with-ui/` | `plugin.json` version vs repo | `copilot plugin marketplace update grill-with-ui && copilot plugin update grill-with-ui` |
| `~/.agents/skills/fork-sync/` | `SKILL.md` `metadata.version` vs repo | re-copy `.github/skills/fork-sync/` |
| `~/.copilot/extensions/grill-monitor/` | file diff vs `.github/extensions/grill-monitor/` | `task ext-install` |

The first two are checked by the report's Install section every run; the
listener needs `robocopy /L /MIR` or a re-run of `task ext-install`.

## E. Toolchain

| Tool | Needed for | Requirement | Observed 2026-11-19 |
|------|------------|-------------|---------------------|
| Node | everything (dependency-free scripts) | ≥ 20 | v26.8.1 ✓ |
| [taskfile.dev](https://taskfile.dev) | `task test` / `check` / `sync-report` wrappers | any 3.x | 3.54.0 ✓ |
| `gh` | the report's PR + Lineage sections | any | 2.102.0 ✓ (report degrades gracefully without it) |
| [waza](https://github.com/microsoft/waza) | eval suite (`waza check skills/grill-with-ui`) | any | 0.39.0 ✓ |
| ffmpeg | `task gif` demo re-record | any | 9.0 ✓ |
| Playwright (`@playwright/test`) | `task test:e2e`, `task gif` | next to the repo or `PLAYWRIGHT_PKG` | **missing in this environment — e2e/gif blocked** ✗ |
| Copilot CLI | `plugin install/update`, `task ext-install` verification | plugin-capable | present ✓ |

## F. Zero-dependency guarantees (locked)

`server.mjs` and `page.html` ship with **no npm dependencies, no build step**;
the page is self-contained (no network, no CDN). Any PR that would add one is
a design question, not a port — record it in `docs/design.md`.

## Activation checklist

1. `node .github/skills/fork-sync/scripts/sync-report.mjs` (or `task sync-report`).
2. Present the coverage table above with live values: upstream gap, lineage
   section, install freshness, toolchain exceptions (Playwright).
3. For each `DRIFTED` pin: read the commits → file/reuse an `issues/` record →
   reconcile with the [ripple checklist](contract-ripple.md) → update the pin
   in `lineage.json`.
4. For each new skill: audit → pin as a dependency or reject in the audit
   record above (it stays in `knownSkills` either way).
5. Never apply an upstream or lineage diff without walking the user through it.
6. When a port touches the grilling loop (wake channel, listening truth,
   payload surface, Finish), read
   [architecture-deltas.md](architecture-deltas.md) first — several inbound
   ports are pre-classified there, and its facts are re-verified with the
   recipe at the bottom of that file.
