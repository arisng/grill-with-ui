---
name: fork-sync
description: Keep the grill-with-ui fork in sync with its upstreams — the jasonku09/grill-with-ui code repo, the mattpocock/skills method lineage, and the installed skill copy. Use when asked to sync, refresh, update, catch up, or rebase the fork; when checking for new upstream commits, branches, or PRs; when deciding whether to adopt, adapt, or skip an incoming change; or when a schema or contract change needs the full ripple update. Do not use for ordinary feature work inside the repo.
metadata:
  version: 0.2.0
---

# fork-sync

`$REPO` is this repo's root. The fork is `arisng/grill-with-ui`; the code upstream is
`jasonku09/grill-with-ui`; the method lineage is `mattpocock/skills`.

**Never merge upstream wholesale.** The fork is not a mirror: it carries domain-modeling
mode, responsive tiers, a writing-clarity profile, a Taskfile, a waza eval suite, and its
own dark theme. Upstream's equivalents are older or differently shaped. Every incoming
change is classified and then either adopted as-is, adapted to the fork's shape, deferred,
or skipped on purpose. Blind application is the failure mode this skill exists to prevent.

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

Read-only with respect to the working tree. It fetches upstream, finds the merge base,
and prints every incoming commit tiered, the contested files, the installed copy's
freshness, and the open upstream PRs. Add `--json` to consume it programmatically,
`--no-fetch` to stay offline, `--upstream owner/repo` to point at a different repo.

The script classifies by two independent questions: does the commit touch a **contract
file** (the schema and its docs), and did the fork **also change that file**?

**The contract files** are: `SKILL.md`, `server.mjs`, `page.html`, `visual-brief.md`,
`domain-brief.md`, `writing-clarity.md`, `adr-template.md`, `README.md`,
`docs/design.md`, `docs/visualize-design.md`, `.github/copilot-instructions.md`. Test
files are deliberately not among them: a test change follows its subject change, it
does not define the contract.

### 3. Classify

| Tier | Meaning | Action |
|------|---------|--------|
| **REWORK** | A contract file the fork also changed | Port the intent onto the fork's structure. This is where the fork's richer implementation wins |
| **ADAPT** | A contract file the fork did not change | Port the intent; **do not** take the diff. The contract file means the change ripples — run the [ripple checklist](references/contract-ripple.md) |
| **ADOPT** | No contract file | Cherry-pick. The reason line says whether a file the fork also changed is involved — if so, expect a conflict and resolve it in favour of the fork's shape |
| **MERGE** | A merge commit | No diff of its own. Take the commits it merged, not the merge |
| **DEFER** | Not upstream yet, or a design question | Leave it. Record why in the commit or PR body |

The rule behind the table: **a commit's diff is evidence, not a patch.** Read it to learn
what upstream wanted, then write the change against the fork's contract. Take the diff
only when the commit touches nothing the fork has shaped.

The script also marks commits that add a **security control** to the server (a body cap, a
host check, an origin check, a CSP sandbox, an auth token) or a **test that asserts a
protected endpoint is refused** — with a `[security]` flag. The subject line is not
consulted, because upstream files a hardening commit under a documentation or review
name. **Port those first** — they close real holes, and the fork is behind upstream on
all of them today.

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

Bump `metadata.version` in `SKILL.md` **in the same commit** as the contract change it
describes — not at the end of the sync, and not after each cherry-pick.

Never use a bare `feat:`/`fix:` subject; the constitution bans it, and upstream's own
commits (which use `feat:`, `fix(page):`, `no-mistakes(document):`) are the exception, not
the rule. `feat`/`fix` accept only the `server` and `page` scopes; `skill` belongs to
`docs`, `agent`, and `copilot`. See [references/upstream-repo.md](references/upstream-repo.md)
for how to re-label an upstream commit and record its provenance in the body.

### 5. Validate

```sh
task test        # unit suite; skips the three Windows-broken tests
task test:e2e    # page e2e against a real serve
waza check .     # skill spec + token budgets
```

On Windows, do not trust a full unit-suite run — three tests are known-broken there.
Diagnose with `node --test --test-name-pattern "<name>" test/server.test.mjs`.

Re-record the demo GIF when the page changes visibly: `task gif` (needs Playwright and
ffmpeg).

### 6. Land and refresh the install

Push the branch, open a PR against `develop`, merge, then push `develop` — the installed
copy tracks the **remote** branch, so an unpushed merge is not yet installable. Then:

```sh
npx skills update -g -y
```

The installed copy is what the agent runs. A fork change that is never reinstalled is a
change nobody has.

## Edge cases the report cannot decide for you

**Renames and deletions.** The report lists the files a commit touches, and a rename
shows both the old and the new path. When upstream renames or deletes a file the fork
has, decide per path — keep the fork's name, follow upstream, or read both — and record
it. Check the whole divergence, not just the commits you are taking:

```sh
git diff --diff-filter=R --name-status <base>..upstream/main   # renames
git diff --diff-filter=D --name-status <base>..upstream/main   # deletions
```

**Schema compatibility.** The fork's `validateState` accepts fields upstream's does not
(`domainModeling`, `writingProfile`), and upstream accepts fields the fork's does not
(`multi`, `rec.options`, `answer.options`). After a sync that touches `server.mjs` or
`SKILL.md`, confirm the fork's own fields are still accepted and that the two schemas
have not silently drifted apart:

```sh
git diff <base>..HEAD -- server.mjs | grep -E '^\+.*(domainModeling|writingProfile)'
```

**Long divergence.** Per-commit cherry-picking is right while the gap is a few dozen
commits. Past that, the conflict cost of each individual commit outweighs the benefit of
taking the history: make an anchor commit instead.

```sh
git merge -s ours upstream/main -m "chore: record the upstream boundary for the sync"
```

That records the fork's divergence once, and the work continues as ordinary fork commits
on top. Use it deliberately, and say in the commit body why.

**Double-applied commits.** The skill tells you to cherry-pick, so the fork can end up
holding a commit it already took. `git cherry` shows which upstream commits are already
present:

```sh
git cherry -v upstream/main develop     # '-' means already applied
```

**When the fork wins.** A REWORK commit sometimes turns out to be a design disagreement
where the fork's implementation is the better one. That is a legitimate outcome — but
record it, or the next sync re-litigates it. Name the upstream commit and the reason in
`docs/design.md` under the decision it belongs to.

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

The lineage moves slowly — `grilling` last changed in October 2026, `domain-modeling` in
September 2026 — so check it quarterly. Details and the specific divergences to protect
are in [references/mattpocock-lineage.md](references/mattpocock-lineage.md).
