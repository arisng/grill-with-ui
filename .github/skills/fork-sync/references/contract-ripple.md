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
| Repo memory | `.github/copilot-memories.jsonl` | A durable fact the change establishes (a new invariant, a renamed concept) |
| Decisions | `docs/design.md`, `docs/visualize-design.md` | Only when a **decision** was made — not for every change |
| Version | `SKILL.md` frontmatter | `metadata.version`, bumped once per contract change |

## The four invariants that break most often

**1. The patch semantics.** Restate these from `SKILL.md` itself — do not paraphrase
them, because the paraphrases are wrong in ways that corrupt state silently:

- `null` deletes a key, at any level: `"answer": null`, `"drawing": null`, `"visual": null`.
- `agent` and `visual` merge **one level**: the keys you give replace those keys whole;
  the rest stay.
- `questions` is keyed by `id`. A **known** id merges one level: each field you give
  replaces that field whole (`rec`, `answer`, `options`, `deps`, `explore`). An
  **unknown** id is a **new question, appended** — it needs `round`, `title`, and `rec`
  (give `body` and `options` too); `status: "open"`, `deps: []`, `options: []`,
  `thread: []`, `durable: false`, and `updated: false` are filled in. An unknown id
  without `title` is an error, not a new question. **Ids are case-sensitive: `q7`,
  never `Q7`.**
- `thread` (on a question and on `visual`) and `visual.queued` **append**: list only the
  new messages or bullets.
- `terms` is keyed by `term`: a known term is replaced whole, a **new** one is appended.
- `writingProfile` replaces the whole value. Accepted values are `clarity-baseline` and
  `strictest-available`; omit it for the baseline. `null` deletes it and restores the
  baseline.
- Every other key (`note`, `intent`, `finished`, `doc`, `domainModeling`, …) is replaced
  whole.

**2. The state schema block.** The `state.json` block at the end of `SKILL.md` is
commented JSON. Every field the server accepts appears there with its comment. A field
that exists in `server.mjs` but not in that block is invisible to the agent.

**3. The send-line schema.** The `events.jsonl` lines are documented next to the state
schema. A new action type the page can send must appear there with the fields it carries.

**4. The error/output contract.** CLI failures exit non-zero with exactly one stderr line
and leave `state.json` untouched. Successes print one short line, never the state.
Unknown subcommands print usage and exit 2. A new command keeps this shape.

## The security delta

The fork's `server.mjs` is behind upstream's on three mitigations — see
[upstream-repo.md](upstream-repo.md). When porting a security change, check all of:

| Check | What to verify |
|-------|----------------|
| Request body cap | `readBody` rejects over the limit with 413, and the socket is closed |
| `Host` header | only self hosts are answered, so a rebound hostname cannot forge a request |
| `/visual` sandbox | the response carries `content-security-policy: sandbox allow-scripts`, not only the iframe attribute |
| Cross-origin `POST` | `Origin` mismatches are refused, including the `null` origin of the sandboxed iframe |

The iframe's `sandbox` attribute only applies inside the page. A user who opens
`/visual` in a tab directly gets the full origin's powers, so the **response header**
is the one that matters.

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
the GIF with `task gif` (which wraps `node design/record-demo.mjs`).
