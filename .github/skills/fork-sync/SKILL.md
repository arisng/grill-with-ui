---
name: fork-sync
description: Keep the grill-with-ui fork in sync with its upstreams — the jasonku09/grill-with-ui code repo, the mattpocock/skills method lineage, and the installed skill copy. Use when asked to sync, refresh, update, catch up, or rebase the fork; when checking for new upstream commits, branches, or PRs; when deciding whether to adopt, adapt, or skip an incoming change; or when a schema or contract change needs the full ripple update. Do not use for ordinary feature work inside the repo.
---

# fork-sync

`$REPO` is this repo's root. The fork is `arisng/grill-with-ui`; the code upstream is
`jasonku09/grill-with-ui`; the method lineage is `mattpocock/skills`.

**Never merge upstream wholesale.** The fork is not a mirror: it carries domain-modeling
mode, responsive tiers, a writing-clarity profile, a Taskfile, a waza eval suite, and its
own dark theme. Upstream's equivalents are older or differently shaped. Every incoming
change is classified and either adopted as-is, adapted to the fork's shape, deferred, or
skipped on purpose. Blind application is the failure mode this skill exists to prevent.

## Sources

| # | Source | Where | What it carries | Reference |
|---|--------|-------|-----------------|-----------|
| 1 | Code upstream | `upstream` remote → `jasonku09/grill-with-ui` | Commits, branches, PRs: features, fixes, CI, docs | [upstream-repo.md](references/upstream-repo.md) |
| 2 | Method lineage | `mattpocock/skills` | The interview method, glossary/ADR discipline. Not a git ancestor — watch, don't merge | [mattpocock-lineage.md](references/mattpocock-lineage.md) |
| 3 | Installed copy | `~/.agents/skills/grill-with-ui` + `~/.agents/.skill-lock.json` | What the agent actually runs. Tracks this fork's `develop` | [install-target.md](references/install-target.md) |

Set up source 1 once if missing:

```sh
git remote add upstream https://github.com/jasonku09/grill-with-ui.git
git fetch upstream --prune
```

## Workflow

### 1. Preflight

```sh
git status --short          # must be clean; a dirty tree hides real conflicts
git branch -vv              # work on develop; main tracks origin/main
```

Never sync onto `main` directly. Branch first:

```sh
git switch -c sync/upstream-YYYY-MM develop
```

### 2. Scan

```sh
node $REPO/.github/skills/fork-sync/scripts/sync-report.mjs
```

Read-only. Fetches upstream, finds the merge base, and prints every incoming commit
tiered, the contested files, the installed copy's freshness, and the open upstream PRs.
Add `--json` to consume it programmatically, `--no-fetch` to stay offline.

The script classifies by two independent questions: does the commit touch a **contract
file** (the schema and its docs), and did the fork **also** change that file? The four
tiers follow from the answers.

### 3. Classify

| Tier | Meaning | Action |
|------|---------|--------|
| **ADOPT** | No contract file, no overlap | Cherry-pick as-is |
| **ADOPT (conflicting)** | No contract file, but the fork changed it | Cherry-pick; expect a conflict in a test or a doc — resolve in favour of the fork's shape |
| **ADAPT** | Contract file, no overlap | Port the intent; **do not** take the diff. The contract file means the change ripples — run the [ripple checklist](references/contract-ripple.md) |
| **REWORK** | Contract file **and** the fork changed it | Port the intent onto the fork's structure. This is where the fork's richer implementation wins |
| **DEFER** | Not yet upstream, or a design question | Leave it. Record why in the commit or PR body |

The rule behind the table: **a commit's diff is evidence, not a patch.** Read it to learn
what upstream wanted, then write the change against the fork's contract. Take the diff only
when the commit touches nothing the fork has shaped.

### 4. Apply, in dependency order

Upstream's own commit order encodes a dependency the fork shares: the server contract
lands before its tests, the skill text after the code, the README after the skill. Adopt
that order, one logical change per commit, using the scopes in
[.github/git-scope-constitution.md](../../git-scope-constitution.md):

```
feat(server): / feat(page):   the behaviour
test(server):                 the contract coverage for it
agent(skill):                 SKILL.md and the briefs
docs(readme):                 the user-facing description
copilot(instruction):         the repo instructions
docs(design):                 only when a decision was made
```

Bump `metadata.version` in `SKILL.md` when the contract changes — it is the only version
marker either lineage has, and how an installed copy tells it is stale.

Never use a bare `feat:`/`fix:` subject; the constitution bans it, and upstream's own
commits (which use `feat:`, `fix(page):`, `no-mistakes(document):`) are the exception, not
the rule. See [references/upstream-repo.md](references/upstream-repo.md) for how to
re-label an upstream commit when adopting it.

### 5. Validate

```sh
task test        # unit suite; skips the three Windows-broken tests
task test:e2e    # page e2e against a real serve
waza check .     # skill spec + token budgets
```

On Windows, do not trust a full unit-suite run — three tests are known-broken there.
Diagnose with `node --test --test-name-pattern "<name>" test/server.test.mjs`.

Re-record the demo GIF when the page changes visibly: `node design/record-demo.mjs`
(needs Playwright and ffmpeg).

### 6. Land and refresh the install

Push the branch, open a PR against `develop`, and — once merged — refresh source 3:

```sh
npx skills update -g -y
```

The installed copy is what the agent runs. A fork change that is never reinstalled is a
change nobody has.

## The two failure modes this prevents

**Silent drift.** The fork's `main` is a month behind `develop`; a stale `main` means a
fresh clone of the fork gets old behaviour. Keep `main` fast-forwarded and make `develop`
the default branch.

**Contract half-updates.** `SKILL.md` is the product: its frontmatter description, the
listening-mode rules, and the `state.json`/send schemas are implemented by
`server.mjs` (`validateState`), `page.html`, the briefs, and the tests. A schema change
that lands in `SKILL.md` alone is a broken skill. Run the
[ripple checklist](references/contract-ripple.md) for every ADAPT and REWORK commit.

## Checking the method lineage

Source 2 has no merge base, so it needs a different routine — diff the method, port the
idea, keep the fork's artifacts:

```sh
gh api repos/mattpocock/skills/contents/skills/productivity/grilling/SKILL.md --jq .content
gh api repos/mattpocock/skills/contents/skills/engineering/domain-modeling/SKILL.md --jq .content
```

Details and the specific divergences to protect are in
[references/mattpocock-lineage.md](references/mattpocock-lineage.md).
