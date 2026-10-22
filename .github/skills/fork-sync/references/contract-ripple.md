# The contract ripple checklist

`SKILL.md` is the product. Its frontmatter `description`, the listening-mode rules, and
the `state.json` / send schemas at the bottom are a contract that `server.mjs`,
`page.html`, the briefs, and the tests all implement. A change to one of those without
the others is a **broken skill**, not an incomplete one.

Run this checklist for every ADAPT and REWORK commit.

## Find every file that describes the change

```sh
git show <sha> --stat
```

The upstream commit's own file list is the shortest route to the affected set, but check
it against the fork's structure — the fork has files upstream does not:

| Layer | File | What must match |
|-------|------|-----------------|
| Prompt contract | `SKILL.md` | The schema block at the end, the `Patching state.json` rules, the round/question shape, the frontmatter `description` and `metadata.version` |
| Server | `server.mjs` | `validateState` (the accepted fields and their shapes), the CLI's output contract, any new file under `state.json` |
| Page | `page.html` | The renderer for the new field, the staged-action model, the Terms/Explore/Visualize panels that read it |
| Briefs | `visual-brief.md`, `domain-brief.md`, `writing-clarity.md`, `adr-template.md` | The shape of the artifacts the change feeds |
| Tests | `test/server.test.mjs`, `test/page.e2e.mjs`, `test/manual-visual.e2e.mjs` | The new behaviour, and the *old* behaviour that must still hold |
| Evals | `evals/grill-with-ui/**` | The task that exercises the behaviour, if the behaviour is prompt-visible |
| Docs | `README.md` | The user-facing description |
| Repo rules | `.github/copilot-instructions.md` | The architecture note, if the invariant changed |
| Decisions | `docs/design.md`, `docs/visualize-design.md` | Only when a **decision** was made — not for every change |
| Version | `SKILL.md` frontmatter | `metadata.version`, bumped once per contract change |

## The four invariants that break most often

**1. The patch semantics.** `SKILL.md` documents exactly how `patch` merges: `null`
deletes; `agent` and `visual` merge one level; `questions` merge one level by lowercase
id; `thread` and `visual.queued` append; everything else replaces whole. A new field
needs a line here, or the agent will patch it wrong at runtime.

**2. The state schema block.** The `state.json` block at the end of `SKILL.md` is
commented JSON. Every field the server accepts appears there with its comment. A field
that exists in `server.mjs` but not in that block is invisible to the agent.

**3. The send-line schema.** The `events.jsonl` lines are documented next to the state
schema. A new action type the page can send must appear there with the fields it carries.

**4. The error/output contract.** CLI failures exit non-zero with exactly one stderr line
and leave `state.json` untouched. Successes print one short line, never the state.
Unknown subcommands print usage and exit 2. A new command keeps this shape.

## Order of work

Keep every commit buildable. The order the fork already uses:

```
feat(server): / feat(page):   the behaviour
test(server):                 the contract coverage for it
agent(skill):                 SKILL.md and the briefs
docs(readme):                 the user-facing description
copilot(instruction):         the repo instructions
docs(design):                 only when a decision was made
```

Within one feature, the same order applies across layers: `server.mjs` before
`page.html` before `SKILL.md`, because each layer describes the one below it.

## Vocabulary

When a change introduces or renames a concept, every place that names it moves
together: `SKILL.md`, `README.md`, the page's UI strings, and the Terms sections of
`docs/design.md` and `docs/visualize-design.md`. The design docs' Terms sections are the
authority on the words — *Send*, *round*, *frontier*, *staged action*, *durable
decision*, *session folder* — and each lists the words to avoid. A rename that skips the
page's UI strings leaves the user reading a word the docs forbid.

## Locked decisions

Six decisions in `docs/design.md` and the ones in `docs/visualize-design.md` are settled.
An incoming upstream change that contradicts one is not adopted — it is a design
question, and it goes back to the user. Read both documents before starting a sync that
touches the contract.

## Finish

```sh
task test && task test:e2e && waza check .
```

Then bump `metadata.version`, commit, and land. If the page changed visibly, re-record
the GIF with `node design/record-demo.mjs`.
