# Source 2 — the method lineage: `mattpocock/skills`

## What it is

Not a git ancestor of this repo. `grill-with-ui` grew out of the *ideas* in Matt
Pocock's `grill-with-docs` skill, which lives in a monorepo of ~25 skills at
`mattpocock/skills`. The fork's interview method, its `durable` flag, its glossary and
ADR discipline are ports of that method.

The upstream shape has changed since the fork was cut:

- `grill-with-docs` is now a **six-line shim**: "Call the Skill tool twice, for
  'grilling' and 'domain-modeling'." The method itself moved into two skills.
- `skills/productivity/grilling/SKILL.md` — the interview method.
- `skills/engineering/domain-modeling/SKILL.md` — the glossary and ADR discipline.
- `skills/engineering/grill-with-docs/SKILL.md` — the shim, plus the composition.

So there is **nothing to merge**. `mattpocock/skills` has no common history with this
repo, and merging it would drag in 25 unrelated skills. Read it, compare it, port the
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
```

The `grilling` skill was last touched in August 2026; the domain-modeling skill before
that. This lineage moves slowly — check it quarterly, not weekly.

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
| `GLOSSARY.md` | `CONTEXT.md` | The fork's name for the same artifact. Upstream's `GLOSSARY-MAP.md` became the fork's `CONTEXT-MAP.md`. |
| `docs/adr/`, ADR file is one paragraph | `docs/adr/`, `adr-template.md` with Status/Context/Drivers/Options/Outcome/Consequences | The fork's ADR format is richer; the ADR brief sets the exact shape. |
| Glossary lives at the repo root, or a `GLOSSARY-MAP.md` | Same, plus the fork parses the map and asks the user when the match is unclear | The fork routes by bounded context. |
| Glossary updates happen *inline* during the session | The fork collects `terms` in state and writes the glossary at Finish | The fork's page owns staged answers; writing the glossary mid-session would fight the Send model. |

So when the method lineage changes the ADR or glossary *rules*, port the rule — not the
file names, and not the write-timing. The fork's artifacts are settled decisions
(locked decision 5 in `docs/design.md`).

### What to watch for

- A change to the three ADR gates → the fork's `durable` definition in `SKILL.md` and
  `domain-brief.md` must move with it.
- A change to the glossary format (the `## Language` section, `_Avoid_` lists) → the
  fork's `CONTEXT.md` writer in `domain-brief.md`, and the Terms panel in `page.html`.
- A change to the frontier/round rules → the fork's "Interview method" section.
- A new skill that supersedes `grill-with-docs` → re-check whether the shim's two-skill
  split still holds.

## Porting rule

Method changes are edits to `SKILL.md` and the briefs — that is, `agent(skill):` commits.
They are always ADAPT, never cherry-picks, and they always move with the
[ripple checklist](contract-ripple.md): if the interview method changes, the `durable`
definition, the design-doc output, the eval tasks, and the README all describe it and
must change together.

Because the lineage is slow and the fork has already ported its core, most checks end
with "no change needed". That is a legitimate outcome — record it and move on.
