# Source 1 — the code upstream: `jasonku09/grill-with-ui`

## What it is

The repo this fork was cut from. Same runtime, same file names, same core contract
(`state.json` written only by the agent, `events.jsonl` appended only by the page). It
moves fast: 308 stars, 50 forks, and new merges most days. It is a source of **changes to
adopt**, not a truth to conform to.

## Getting oriented

```sh
git fetch upstream --prune
git log --oneline upstream/main ^develop    # what you are missing
git log --oneline develop ^upstream/main    # what the fork has that upstream does not
gh pr list --repo jasonku09/grill-with-ui --state open
```

`upstream/main` is the trunk. Upstream also keeps long-lived feature branches
(`upstream/feat/…`, `upstream/fix/…`); the report lists the ones not yet merged.

## What upstream has that the fork lacks

**CI and infrastructure — take as-is.** The fork has no GitHub Actions at all. Upstream
carries three workflows worth adopting whole, because they encode constraints the fork
already honours:

| File | What it enforces |
|------|------------------|
| `.github/workflows/ci.yml` | `node --check server.mjs` and the unit suite on Node 20, 22, 24 |
| `.github/workflows/e2e.yml` | the page e2e in Chromium |
| `.github/workflows/static.yml` | every script syntax-checks, and `page.html` fetches no external resources |

That last one is a real invariant of this skill, not a style preference: the page must
work offline. Adopt it and it keeps holding.

Also upstream-only: `.github/dependabot.yml`, `.no-mistakes.yaml`, and
`test/subagent-toggle.e2e.mjs`. All are additive — cherry-pick, no adaptation.

**Features.** Upstream has multi-select options, inline markdown rendering, Cmd+Enter
compose staging, a subagent toggle for Visualize, importance levels and rating chips,
reply markers with next-unread navigation, and a `serve --detach` mode. Each of these
touches `page.html` and usually `SKILL.md`, so each is at least an ADAPT.

## The two collision zones

### 1. The dark theme — both sides built one, differently

Upstream's theme (`3903c55`, plus the contrast fix `5240431`) is a **server**-backed
toggle: the page POSTs to `/theme` and the server sets `data-theme`.

The fork's theme (`4876990`) is **client**-backed: a `localStorage` key `grill-theme`,
resolved by an inline head script before first paint, cycling System → Light → Dark, with
one `:root[data-theme="dark"]` block restating every colour token. The fork's own
instructions call that single dark block the thing to keep in step.

So: **do not take upstream's theme diff.** It would replace a pre-paint, no-flash,
system-aware implementation with a server round-trip, and would collide with the fork's
documented invariant. What *is* worth taking from upstream is the bug fix in `5240431`
— text on filled accent/ok buttons drops below 3:1 contrast in dark mode. Port that one
rule into the fork's token block, and take upstream's `test/page.e2e.mjs` assertions for
it.

If upstream later ships a fork-compatible theme change, judge it on the same question:
does it preserve "concrete `data-theme` before first paint, one dark block, three states"?

### 2. `SKILL.md` and `server.mjs` — the contract

`SKILL.md` and `server.mjs` are the same schema seen from two sides. Upstream's
`validateState` and the fork's both reject malformed state, but the *fields* differ:
the fork adds `domainModeling`, `writingProfile`, `q-domain`, `q-writing-profile`, the
`finished.context` / `finished.adrs` outputs, and the `CONTEXT-MAP.md` routing.

So an upstream `SKILL.md` diff is a **specification of a different product**, not a
patch. Read it for the behaviour upstream wanted, then write the behaviour against the
fork's schema.

The `multi` feature (`f440aff`) is the clearest example. Upstream adds `multi: true` to
a question, `rec.options: ["A","C"]`, and an answer of `{"kind":"accept|option",
"options":[...]}`. The fork's schema has none of these. Adopting it means touching
`SKILL.md` (the question schema, the `answer` field, the send-line schema), `server.mjs`
(`validateState`), `page.html` (the option toggling), `test/server.test.mjs`, and
`test/page.e2e.mjs` — and deciding how a multi answer interacts with the fork's
`durable` flag, its `explore` rows, and its design-doc output. That is a design task,
not a merge.

## Re-labelling an adopted commit

Upstream's commit subjects use bare `feat:`/`fix:` and a `no-mistakes(...)` type. The
fork's constitution ([../../../git-scope-constitution.md](../../../git-scope-constitution.md))
bans both for hand-authored commits and only tolerates `no-mistakes(...)` as external
tooling output in older history.

When you adopt an upstream commit, keep its message as the body and re-label the
subject:

```sh
git cherry-pick -n <sha>          # stage without committing
git commit -m "fix(page): keep text on filled buttons readable in the dark theme"
```

Scope by the file the change actually lands in — `server` for `server.mjs`, `page` for
`page.html`, `skill` for `SKILL.md` and the briefs, `readme` for `README.md`.

## Open PRs

Upstream keeps work in PRs before it lands. A PR is not upstream yet, so a cherry-pick
of its branch is a DEFER-shaped decision:

- Merge upstream first, then re-run the report and take it as a normal commit.
- Or cherry-pick `upstream/<branch>` when the fix is needed now — and say so in the
  commit body, so the next sync sees it is already taken.

Security-relevant PRs deserve an early look regardless of merge state. Localhost
hardening (bounding the listen address, sandboxing the visual, capping request bodies)
protects every user of the skill, so port it even while it is still a PR.

## Reducing future debt

The fork's own changes — domain-modeling mode, the responsive tiers, the Taskfile, the
waza eval suite — are upstreamable. Sending them as PRs to `jasonku09` converts permanent
merge conflicts into upstream history. The cost is writing the PR against upstream's
schema, which is the same work as adapting them here. Do it once, and the next sync
gets cheaper.
