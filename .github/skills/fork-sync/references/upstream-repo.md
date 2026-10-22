# Source 1 — the code upstream: `jasonku09/grill-with-ui`

## What it is

The repo this fork was cut from. Same runtime, same file names, same core contract
(`state.json` written only by the agent, `events.jsonl` appended only by the page). It
moves fast — around 310 stars and 50 forks, with new merges most days. It is a source of
**changes to adopt**, not a truth to conform to.

## Getting oriented

```sh
git fetch upstream --prune
git log --oneline upstream/main ^develop    # what you are missing
git log --oneline develop ^upstream/main    # what the fork has that upstream does not
gh pr list --repo jasonku09/grill-with-ui --state open
```

`upstream/main` is the trunk. Upstream also keeps long-lived feature branches
(`upstream/feat/…`, `upstream/fix/…`); the report lists the ones with an open pull
request, which is not the same set as the unmerged branches.

## What upstream has that the fork lacks

Twelve files exist upstream and not in the fork. They are **not** all adoptable as-is:

| Upstream-only file | Adopt? | Why |
|--------------------|--------|-----|
| `.github/dependabot.yml` | yes | Pure config, no prerequisites |
| `.no-mistakes.yaml` | yes | Pipeline config for external review tooling |
| `.github/workflows/ci.yml` | **adapt** | References `markdown.mjs`, which the fork does not have |
| `.github/workflows/static.yml` | **adapt** | Same `markdown.mjs` reference |
| `.github/workflows/e2e.yml` | **adapt** | Runs `test/listener.e2e.mjs`, which the fork does not have |
| `markdown.mjs` | with the feature | The inline-markdown renderer; needs its own feature port |
| `test/markdown.test.mjs` | with the feature | Tests for the above |
| `test/page-markdown-parity.test.mjs` | with the feature | Tests for the above |
| `test/listener.e2e.mjs` | with the feature | Tests `serve --detach` and the listener heartbeat |
| `test/subagent-toggle.e2e.mjs` | with the feature | The fork has no subagent checkbox yet |
| `docs/importance-and-ratings-design.md` | with the feature | The design record for importance levels |
| `docs/importance-and-ratings-visual.html` | with the feature | The prototype for the same |

**The CI workflows need the feature they test.** Adopting `ci.yml` as-is fails
immediately: `node --check markdown.mjs` errors because the file does not exist.
Adopting `e2e.yml` as-is fails the same way on `test/listener.e2e.mjs`. So they are
ADAPT, not ADOPT — take the workflow, and either port the feature it tests first, or
drop the lines that reference files the fork does not have. Prefer the former: the
workflows encode real constraints the fork already honours.

| Workflow | What it enforces |
|----------|------------------|
| `ci.yml` | `node --check server.mjs` and the unit suite on Node 20, 22, 24 |
| `e2e.yml` | the page e2e in Chromium |
| `static.yml` | every script syntax-checks, and `page.html` fetches no external resources |

That last one is a real invariant of this skill, not a style preference: the page must
work offline. Adopt it and it keeps holding.

**Features.** Upstream has multi-select options, inline markdown rendering, Cmd+Enter
compose staging, a subagent toggle for Visualize, importance levels and rating chips,
a `serve --detach` mode with a listener heartbeat, and opt-in LAN mode. Each touches
`page.html` and usually `SKILL.md`, so each is at least an ADAPT.

## The security gap — the fork is behind upstream here

Upstream merged `9830e54` ("refuse foreign Host headers, sandbox /visual, cap request
bodies") via PR #36. **It is merged, not an open PR** — the report will not list it
under open PRs, so it has to be found among the incoming commits. The report marks a
commit `[security]` when its diff adds a **security control** to the server (a body cap,
a host check, an origin check, a CSP sandbox, an auth token) or a **test that asserts a
protected endpoint is refused**. The subject line is not consulted, because upstream
files hardening under a documentation or review name. Port those first.

Today that is five commits upstream and none of them in the fork:

| Commit | What it brings |
|--------|----------------|
| `9830e54` | The three mitigations below, in one commit |
| `6ffe658` | Opt-in LAN mode, with the origin check |
| `238f713` | A token-authenticated LAN request may use any Host |
| `3903c55` | The origin check (came in with the server-backed theme) |
| `697d092` | The test that asserts the iframed visual cannot send |

The fork genuinely lacks all three mitigations:

| Mitigation | Upstream | Fork |
|------------|----------|------|
| Request body cap | `MAX_BODY = 1024 * 1024`, rejects with 413 | `readBody` accumulates with no cap (`server.mjs`) |
| `Host` header check | answers only self hosts (DNS-rebinding defence) | no `Host` check on any route |
| `/visual` sandbox | serves `content-security-policy: sandbox allow-scripts` | no CSP header; only the iframe's `sandbox` attribute, which does not apply when `/visual` is opened in a tab |

The third one matters most: the page renders the visual in a sandboxed iframe, but a
user who opens `/visual` directly gets full same-origin access to `/state` and
`POST /send`. Port upstream's header.

## The two collision zones

### 1. The dark theme — both sides built one, differently

The **persistence and resolution** differ, not the idea:

| | Fork | Upstream |
|---|---|---|
| Where the choice is stored | `localStorage`, key `grill-theme` — never in `state.json` | a server-side `ui.json` under `GRILL_HOME` |
| How it reaches the page | an inline head script resolves `system` and writes a concrete `data-theme` **before first paint** | the server substitutes `__GRILL_THEME__` into the HTML |
| Colour blocks | one `:root[data-theme="dark"]` block | a `:root[data-theme="light"]` block plus `light-dark()` for the system case |
| Cycle | System → Light → Dark | System → Light → Dark |

So upstream's theme is **not** a different feature — it is the same three states with
server-side persistence. What upstream has that the fork does not is a `POST /theme`
route and the `ui.json` file.

**Do not take upstream's theme diff.** It would replace a pre-paint, no-flash,
client-side implementation with a server round-trip, and would collide with the fork's
documented invariant that the theme choice is the reader's, not the session's.

What *is* worth taking from upstream is the bug fix in `5240431` — text on filled
accent/ok buttons drops below 3:1 contrast in dark mode. Port that one rule into the
fork's token block, and take upstream's `test/page.e2e.mjs` assertions for it.

Upstream's own theme commit `3903c55` also added the `originOk` cross-origin check to
`server.mjs` — that part is a security change and is covered above.

### 2. `SKILL.md` and `server.mjs` — the contract

`SKILL.md` and `server.mjs` are the same schema seen from two sides. Both sides'
`validateState` reject malformed state, but the *fields* differ: the fork adds
`domainModeling`, `writingProfile`, the `q-domain` and `q-writing-profile` questions,
the `finished.context` / `finished.adrs` outputs, and the `CONTEXT-MAP.md` routing.
Upstream adds `multi`, `rec.options`, and `answer.options`, which the fork has none of.

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

The constitution's approved scopes are:

| Type | Approved scopes |
|------|-----------------|
| `feat` | `server` (server.mjs), `page` (page.html) |
| `fix` | `server`, `page` |
| `test` | `server` (test/*) |
| `docs` | `skill`, `design`, `readme`, `constitution` |
| `agent` | `skill` (SKILL.md and the briefs) |
| `copilot` | `instruction`, `mcp`, `skill` (repo tooling skills) |
| `devtool` | `config`, `taskfile` |

So `feat(skill):` and `fix(skill):` are **not** valid — `skill` is approved under
`docs`, `agent`, and `copilot`, not under `feat`/`fix`. A behaviour change to
`SKILL.md` is `agent(skill):`; a behaviour change to `page.html` is `feat(page):`.

When you adopt an upstream commit, keep its message as the **body** and re-label the
subject:

```sh
git cherry-pick -n <sha>          # stage without committing
git commit -F - <<'MSG'
fix(page): keep text on filled buttons readable in the dark theme

Upstream: jasonku09/grill-with-ui@9695ee7 (fix(page): keep text on filled
buttons readable in the dark theme (#1))

Ported rather than cherry-picked: the fork's theme keeps the choice in
localStorage and resolves it before first paint, so only the contrast rule
was taken. See .github/skills/fork-sync/references/upstream-repo.md.
MSG
```

Recording the upstream sha in the body matters: it is how the next sync knows the
commit was already taken, and it is how a reader tells a port from a copy.

## Open PRs

Upstream keeps work in PRs before it lands. A PR is not upstream yet, so a cherry-pick
of its branch is a DEFER-shaped decision:

- Merge upstream first, then re-run the report and take it as a normal commit.
- Or cherry-pick `upstream/<branch>` when the fix is needed now — and say so in the
  commit body, so the next sync sees it is already taken.

Reply markers with next-unread navigation (PR #40) are an open PR, not an upstream
feature, until they merge. The report lists the open PRs with their branch names, so
the branch is one `git fetch` away.

Security-relevant PRs deserve an early look regardless of merge state. Localhost
hardening (bounding the listen address, sandboxing the visual, capping request bodies)
protects every user of the skill.

## Reducing future debt

The fork's own changes — domain-modeling mode, the responsive tiers, the Taskfile, the
waza eval suite — are upstreamable. Sending them as PRs to `jasonku09` converts permanent
merge conflicts into upstream history. The cost is writing the PR against upstream's
schema, which is the same work as adapting them here. Do it once, and the next sync
gets cheaper.
