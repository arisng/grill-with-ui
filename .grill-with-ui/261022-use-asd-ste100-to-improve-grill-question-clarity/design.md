# Use ASD-STE100 to improve grill question clarity

The grill will use a clarity baseline for every text surface that a user reads. It will strengthen question-card structure and discussion replies, then offer the strongest available ASD-STE100 checks when they fit. The agent must ask before strict mode starts. This design does not claim full ASD-STE100 compliance because the official word list is not part of the available skill.

## Terms

- **Clarity baseline**: The default way the grill writes text. It uses plain words and clear sentence structure without claiming formal ASD-STE100 compliance.
  _Avoid_: basic English, minimum compliance.
- **Writing profile**: A set of writing rules that applies to text the grill creates.
  _Avoid_: compliance score, numeric level.
- **Recommendation reason**: An explanation of why the recommended option fits and what trade-off it carries.
  _Avoid_: hint, why hint.
- **Strictest available profile**: The strongest writing checks the grill can use with the available ASD-STE100 skill and tools. It does not mean full compliance with the standard.
  _Avoid_: 100% compliant, certified STE.

## Why

The user wants to incorporate the `asd-ste100` skill because the grill's questions, answer options, and reasons are difficult to understand. The user also wants clearer discussion replies. The goal is to reduce rereading without making non-technical discussions sound like technical procedures.

## Locked decisions

None. No topic decision passed all three durable-decision gates.

## Routine choices

- **Apply the clarity baseline to every grill-authored surface the user reads.** This includes the grill title and short description, question titles and bodies, options, recommendation reasons, discussion replies, accumulated terms, and final documents. When the user chooses Visualize, apply it to visible prototype or diagram text. Do not rewrite an existing `CONTEXT-MAP.md`; the grill reads that file only to route output.
- **Use named profiles, not a numeric compliance scale.** The baseline applies by default. The agent may detect text where stronger checks could help and recommend the strictest available profile. It must ask before applying that profile. A true 100% compliance claim is not available because the official word list is absent.
- **Keep the default guidance in `SKILL.md`.** The grill remains portable. When the user opts in to strict mode, invoke the separate `asd-ste100` skill if it is available. If it is not available, use the grill's built-in clarity guidance and state the limitation. The opt-in applies for the rest of the current grill session. A new grill starts at the baseline.
- **Ask about strict mode only when the agent detects text where strict checks may help.** Do not add a profile question to every grill. The agent must allow the user to opt in explicitly. Detection can be wrong, so the agent must not apply strict mode without approval.
- **Require a clarity check for each question card.** Each card must ask one decision. Its options must answer that decision and must not overlap. Its recommendation reason must name the benefit and the trade-off. This adds drafting work, but it addresses content ambiguity that a language rewrite cannot fix.
- **Use direct, natural language in discussion replies.** The agent should answer the user's point first, use plain words, and use the same term for the same concept. It should not impose strict sentence-length limits on every reply.
- **Do not add clarity tests or a linter gate as part of this change.** The user chose to rely on readers to request rewrites. Existing tests and evaluations remain unchanged.

## Verified facts

- `SKILL.md` already defines question titles, bodies, options, recommendations, and a one-paragraph reason. It does not give a specific clarity check for distinct options or one decision per card.
- The README describes `grill-with-ui` as a standalone Agent Skill that runs across agent systems. Node 20 or newer is its only stated runtime requirement. The separate `asd-ste100` skill is not bundled with this repository.
- The current waza evaluation suite covers session setup, state ownership, Finish, and skill routing. It has no task for question comprehension or discussion style.
- The `asd-ste100` skill does not include the official word list. Its linter checks selected structural patterns, but a clean linter result cannot establish full ASD-STE100 compliance.

## Risks

- The agent may misclassify a text type and recommend strict mode when it does not fit. The opt-in requirement reduces this risk.
- Strong wording limits can remove useful nuance or necessary technical terms. The agent must preserve conditions, scope, and uncertainty.
- The separate skill may not be installed. The built-in baseline must still work without it.
- The user chose not to add automated clarity evaluations. Future changes can reduce readability without an automatic failure signal.

## Deferred

None.

## Open threads

None. All questions received answers, and no discussion thread remains unresolved.
