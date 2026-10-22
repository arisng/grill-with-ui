# Source 2 — the method lineage: `mattpocock/skills`

## What it is

Not a git ancestor of this repo. `grill-with-ui` grew out of the *ideas* in Matt
Pocock's `grill-with-docs` skill, which lives in a monorepo of roughly 30 skills at
`mattpocock/skills`. The fork's interview method, its `durable` flag, its glossary and
ADR discipline are ports of that method.

The upstream shape has changed since the fork was cut:

- `grill-with-docs` is now a **six-line shim**: "Call the Skill tool twice, for
  'grilling' and 'domain-modeling'." The method itself moved into two skills.
- `skills/productivity/grilling/SKILL.md` — the interview method.
- `skills/engineering/domain-modeling/SKILL.md` — the glossary and ADR discipline.
- `skills/engineering/grill-with-docs/SKILL.md` — the shim, plus the composition.

So there is **nothing to merge**. `mattpocock/skills` has no common history with this
repo, and merging it would drag in 30 unrelated skills. Read it, compare it, port the
idea, keep the fork's artifacts.

## Reading it

```sh
gh api repos/mattpocock/skills/contents/skills/productivity/grilling/SKILL.md --jq .content
gh api repos/mattpocock/skills/contents/skills/engineering/domain-modeling/SKILL.md --jq .content
gh api repos/mattpocock/skills/contents/skills/engineering/domain-modeling/ADR-FORMAT.md --jq .content
gh api repos/mattpocock/skills/contents/skills/engineering/domain-modeling/GLOSSARY-FORMAT.md --jq .content
```

The API returns base64; pipe through `base64 -d` (or `Buffer.from(x, 'base64')` in
Node) to read it.

Check for drift with a timestamp rather than by re-reading everything:

```sh
gh api "repos/mattpocock/skills/commits?path=skills/productivity/grilling&per_page=1" \
  --jq '.[].commit.committer.date'
gh api "repos/mattpocock/skills/commits?path=skills/engineering/domain-modeling&per_page=1" \
  --jq '.[].commit.committer.date'
```

## The drift so far, and what it means for the fork

| Date | Upstream change | Status in the fork |
|------|-----------------|---------------------|
| 2026-10-07 | `grilling`: word questions so "yes" accepts the recommendation | **not ported** — see below |
| 2026-09-17 | `domain-modeling`: renamed `CONTEXT.md`/`CONTEXT-MAP.md` to `GLOSSARY.md`/`GLOSSARY-MAP.md` | **not adopted** — a live decision, see below |
| 2026-08-20 | `grilling`: separate questions in a round with an HR | ported in spirit — the fork already numbers and separates its questions |
| 2026-08-15 | removed em-dashes from the `grilling` skill | not ported — the fork's own prose style is its own decision |

This lineage moves slowly but not never. `grilling` last changed in October 2026 and
`domain-modeling` in September 2026, so **check quarterly** and read the commit
message before reading the file.

### The unported rule: "yes" should accept the recommendation

Upstream's `grilling` skill says: *"Word each question so 'yes' accepts your recommended
answer."* The fork's `writing-clarity.md` asks for options that answer the same
decision, but never states that a plain "yes" should mean "take the recommended
option".

This is a small but real gap in the fork's question cards, and it is upstream's most
recent method change. Porting it means one line in `writing-clarity.md`'s "Question
cards" section, plus a look at whether the page's free-text answers can express it.

### The rename: upstream moved away from the fork's convention

Upstream **renamed from** `CONTEXT.md`/`CONTEXT-MAP.md` **to** `GLOSSARY.md`/
`GLOSSARY-MAP.md` on 2026-09-17. The fork kept the *older* naming — `CONTEXT.md` and
`CONTEXT-MAP.md`.

So the fork's naming is not a fork-specific invention; it is upstream's original
convention, which upstream has since changed. Whether to follow is a decision for the
fork's users, not a default either way:

- **Follow upstream** — the glossary is a `GLOSSARY.md`, matching every other repo that
  uses the convention. Costs: a rename across `SKILL.md`, `server.mjs`, `domain-brief.md`,
  the page's Terms panel, and every existing user's file.
- **Keep `CONTEXT.md`** — the fork is not upstream, and its domain-modeling mode is
  opt-in. Costs: the two lineages drift further apart in vocabulary, which the
  glossary's own _Avoid_ lists exist to prevent.

Whichever way it goes, it is a **durable decision**: record it in `docs/design.md` so
the next person does not re-litigate it. The skill's job is to surface the choice, not
to make it silently.

## What the fork already ported, and how it diverges

### The interview method → the fork's `SKILL.md`

`grilling` defines the shape: a **design tree** of decisions, worked in **rounds**, where
the **frontier** is every decision whose prerequisites are settled. A round asks the whole
frontier at once, numbered, each with a recommended answer. Crucially: *"Finding facts is
your job, never the user's"* — dispatch a subagent rather than asking.

The fork carries all of this in `SKILL.md`'s "Interview method (frontier per round)" and
its Explore-deeper action. The word **frontier** is the fork's own Terms entry; upstream
uses it too, so the vocabulary matches.

Two upstream rules the fork states differently, and should keep stating its way:

- Upstream's round format is a fixed `❓ **Q1** - …` / `➡️ …` template for a terminal.
  The fork's page renders cards with a `rec` object, so the format is a page concern, not
  a prompt concern. Keep the fork's shape; port the *content* rules.
- Upstream says *"Do not act on it until the user confirms you have reached a shared
  understanding."* The fork's Finish has an inline confirm and a `finished` contract.
  Same idea, different mechanics.

### The `durable` three gates → the fork's ADR rule

`domain-modeling` offers an ADR only when all three hold: **hard to reverse**, **surprising
without context**, and **the result of a real trade-off**.

The fork already carries this verbatim in `domain-brief.md` and in the `durable` flag's
definition in `SKILL.md`. It also borrowed the **Terms** section with `_Avoid_` lists.

### Where the fork deliberately diverges — protect these

| Upstream | Fork | Why |
|----------|------|-----|
| `GLOSSARY.md` (renamed 2026-09-17) | `CONTEXT.md` | The fork kept the original naming; see the rename decision above |
| `docs/adr/`, ADR file is one paragraph | `docs/adr/`, `adr-template.md` with Status/Context/Drivers/Options/Outcome/Consequences | The fork's ADR format is richer; the ADR brief sets the exact shape |
| Glossary lives at the repo root, or a `GLOSSARY-MAP.md` | Same, plus the fork parses the map and asks the user when the match is unclear | The fork routes by bounded context |
| Glossary updates happen *inline* during the session | The fork collects `terms` in state and writes the glossary at Finish | The fork's page owns staged answers; writing the glossary mid-session would fight the Send model |
| The ADR file may be a single paragraph | The fork's template has fixed sections | The fork's ADRs are reviewed by pull request, so they carry more structure |

The first row is the live decision, not a settled one. The rest are settled: the ADR
shape and the write-timing are locked decisions in `docs/design.md`.

## What to watch for

- A change to the three ADR gates → the fork's `durable` definition in `SKILL.md` and
  `domain-brief.md` must move with it.
- A change to the glossary format (the `## Language` section, `_Avoid_` lists) → the
  fork's `CONTEXT.md` writer in `domain-brief.md`, and the Terms panel in `page.html`.
- A change to the frontier/round rules → the fork's "Interview method" section.
- A change to how questions are worded → the fork's `writing-clarity.md`.
- A further rename, or a new skill that supersedes `grill-with-docs` → re-check whether
  the shim's two-skill split still holds, and re-open the naming decision.

## Porting rule

Method changes are edits to `SKILL.md` and the briefs — that is, `agent(skill):` commits.
They are always ADAPT, never cherry-picks, and they always move with the
[ripple checklist](contract-ripple.md): if the interview method changes, the `durable`
definition, the design-doc output, the eval tasks, and the README all describe it and
must change together.

Because the lineage is slow and the fork has already ported its core, most checks end
with "no change needed". That is a legitimate outcome — record it and move on.
