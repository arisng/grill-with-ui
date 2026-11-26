# Spec brief

At Finish the grill says whether an **implementation spec** is the next step. It never writes
one. This file holds the rules; `SKILL.md` calls it and carries only the one-line handoff.

The template is the consuming repo's: look for `.specify/templates/spec-template.md`,
`docs/specs/`, or a path the user names. If none exists, say "define a spec template for this
repo" rather than inventing a format.

## The division of labour

Do not blur these. They are four artifacts answering four different questions.

| Artifact | Owns | Answers |
| --- | --- | --- |
| the issue, in the repo's tracker | what to implement, and what closes it | *what* |
| the spec (elsewhere) | how to implement it correctly, derived from that issue | *how* |
| an ADR | one irreversible choice, and what lost | *why* |
| the design doc | what this conversation settled | *what was decided here* |

A spec **derives from an issue**, one way: issue → spec → code. It never invents scope (the
issue owns that) and never re-decides a settled choice (the ADR owns that). **Acceptance
criteria belong to the issue**: reference them, never restate them — copying them into the spec
is the duplication this skill exists to avoid.

## Is the *how* still unsettled?

Count these. They are about the implementation route, never about the size of the work: a large
job with an obvious route needs no spec, and a small one with a contested route does.

| # | Signal | Weight |
| --- | --- | --- |
| S1 | More than one viable implementation route, and the grill did not settle which | strong |
| S2 | A required ordering of changes (migrate → backfill → cutover) | strong |
| S3 | A shared seam two implementers must agree on (module boundary, interface, event shape) | strong |
| S4 | Correctness has a non-obvious verification route (an NFR to measure, a conformance check) | strong |
| S5 | Non-local touch points: several files or packages must change together in a way a reader cannot infer | medium |
| S6 | Someone other than the author will implement it | medium |
| S7 | An external contract must be shaped (public API surface, published schema, partner payload) | medium |

## The issue anchor

A precondition, not a score. Read the tracker from `.github/issue-tracker.json` — the
`issue-tracking` skill owns that file, so read it and never write or extend it. Its `tracker` is
`local-markdown`, `github`, or `azure-devops`. No manifest? Use the host of `origin`. Then look
for an issue matching this grill's topic and intent: the manifest's `issuesDir` files, a GitHub
search, or an Azure Boards work item.

| # | Condition | Effect |
| --- | --- | --- |
| A1 | No tracker readable at all | anchor missing |
| A2 | An issue matches | eligible |
| A3 | No issue matches | anchor missing |
| A4 | The match is a theme/epic | say so: the spec attaches to one child |
| A5 | Two or more plausible matches | ask which, in one terminal line; never guess the anchor |

## Do not recommend when

| # | Stop condition |
| --- | --- |
| X1 | Single file or single function change |
| X2 | Easily reversible, low blast radius |
| X3 | No handoff and an obvious route |
| X4 | The design doc plus the visual already state the route buildably |
| X5 | A spike or throwaway prototype |
| X6 | A bug fix |

## The verdict

Three outcomes, checked in this order — the stop conditions and work shape come first, because
the anchor only matters once a spec is actually warranted:

1. `not warranted` — any X-signal holds, or fewer than two strong S-signals. Nothing to spec, so
   the anchor is irrelevant: never tell the user to open an issue for a change that needs none.
2. `blocked` — the signals say a spec is warranted, but A1 or A3 holds. Name the tracker and say
   the spec derives from an issue.
3. `recommended` — two or more strong S-signals (or one strong plus two medium), an anchor from
   A2/A4, and no X-signal.

Exactly one strong signal is ambiguous: ask in one terminal line rather than asserting.

Emit one line. Examples:

```
Spec: recommended — route unsettled, ordered migration, shared seam (S1,S2,S3);
      derived from issue #0042 (local-markdown). Derive how only: cite ADR-0007,
      link design.md and GLOSSARY.md; criteria stay in #0042.
```

```
Spec: blocked — no issue matches this topic; tracker local-markdown (issues/).
      Create the issue, then derive the spec from it.
```

```
Spec: not warranted — single reversible change, obvious route (X1, X2).
```

## What a spec must contain

The repo's template decides the shape. This is the minimum, and every item is *how*:

1. **Derivation** — the issue it derives from, one line. Not a copy of the issue.
2. **Implementation route** — the chosen approach and the routes rejected, with why each lost.
3. **Ordering and touch points** — the sequence of changes, and the files or components that
   move together.
4. **Verification** — how correctness is proven against the issue's criteria. References them,
   never restates them.
5. **Constraints** — citing `ADR-NNNN`, referenced not restated.
6. **Out of scope** — drawn from the ADRs' rejected options and the design doc's Deferred items.

## Why the grill does not write it

The skill is chartered to decide, not to plan implementation (its `DO NOT USE FOR` line rules
out tasks). Spec Kit and Kiro own spec → plan → tasks; the repo's `issue-tracking` skill owns the
backlog and therefore the *what*. Writing a spec uninvited would duplicate all three and re-open
the over-production problem the decision pipeline exists to fix. The verdict closes the gap
without claiming their work.
