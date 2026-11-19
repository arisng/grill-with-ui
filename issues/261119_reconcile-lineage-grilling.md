---
date: 2026-11-19
type: Task
severity: Medium
status: Proposed
tags: [fork-sync, lineage, method-port]
related: [261119_decision-glossary-naming.md]
---

# Task: Reconcile the `grilling` method drift (two unported rules)

## Objective

Close the two open method gaps against the lineage's `grilling` skill. Both are
wording-level ADAPT ports — read the intent, write it against the fork's shape,
never copy the diff (the lineage's terminal round format is not the fork's page
format).

Upstream commits in `mattpocock/skills` (path `skills/productivity/grilling`):

- `95249b0` (2026-10-07) — *"Word each question so 'yes' accepts your
  recommended answer."* The fork's `writing-clarity.md` asks for options that
  answer the same decision but never says a plain "yes" must mean "take the
  recommendation".
- `7739eae` (2026-10-29) — *"dispatch a sub-agent **with a fresh context
  window** to find it"*: subagents must start fresh, not fork the parent
  conversation (forked context defeats their purpose).

## Tasks

- [ ] Show the user both hunks before porting (both are one-liners upstream)
- [ ] Port the "yes accepts the recommendation" rule into
      `skills/grill-with-ui/writing-clarity.md`'s Question cards section
- [ ] Check whether the page's free-text answers can express a plain yes →
      note the outcome (page change or prompt-only rule)
- [ ] Port the fresh-context rule into `skills/grill-with-ui/SKILL.md`'s
      Explore / fact-finding guidance
- [ ] Run the [ripple checklist](../.github/skills/fork-sync/references/contract-ripple.md):
      prompt-visible rules may need an eval task review and a README line
- [ ] Bump `skills/grill-with-ui/SKILL.md` `metadata.version` and
      `plugin.json` `version` together (prompt contract change)
- [ ] Pins in `lineage.json` already match the audited state — no pin edit
      needed; close this issue instead

## Acceptance Criteria

- [ ] `writing-clarity.md` states that a "yes" answer accepts the recommended option
- [ ] `SKILL.md`'s fact-finding rule says subagents get a fresh context window
- [ ] Ripple checklist completed; `task test` and `waza check skills/grill-with-ui` green
- [ ] Nothing was copied verbatim from the lineage's terminal format

## References

- Lineage: [.github/skills/fork-sync/references/mattpocock-lineage.md](../.github/skills/fork-sync/references/mattpocock-lineage.md)
  (drift table rows 2026-10-07 and 2026-10-29)
- Pins: [.github/skills/fork-sync/lineage.json](../.github/skills/fork-sync/lineage.json)
- Fork files: `skills/grill-with-ui/{SKILL.md,writing-clarity.md}`
