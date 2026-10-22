# Writing clarity for grill-with-ui

Read this file before starting or resuming a grill. Apply it to all text the agent creates for the user: the grill topic title and intent when the agent writes them, question cards, discussion replies, accumulated terms, visible prototype or diagram text, and Finish documents. Do not rewrite user-authored text when the contract requires it verbatim, such as a quoted thread message. Do not edit an existing `CONTEXT-MAP.md`; the grill reads it only to route output.

## Clarity baseline

The baseline applies to every grill. Keep language clear without making every topic sound like a procedure.

- Use familiar words and short, direct sentences. Name the actor when it matters.
- Keep one main idea in each sentence. Use active voice when it makes the actor clear.
- Use one term for one concept. Define a domain term when the reader may not know it.
- Preserve uncertainty, scope, conditions, quantities, and technical terms. Never simplify away meaning.
- Avoid needless jargon, noun-heavy phrases, and phrasal verbs. Do not impose a numeric sentence-length limit on ordinary discussion.

## Question cards

Apply these checks to each new question:

- Ask one decision in the title and body. State the context and what depends on the answer.
- Make every option answer that same decision. Keep options distinct, comparable, and at the same level. Do not hide a choice in an option's explanation.
- Keep the recommendation reason to one paragraph. Explain why the recommended option fits, name its benefit, and state its trade-off. Do not imply that another option has no benefit.
- The page labels this text **Why we recommend A:**. Write a reason that completes that label and explains the option, not a generic hint.

## Discussion replies

Answer the user's point first. Then give the reason or needed context. Use brief paragraphs or bullets when they make separate points easier to scan. Keep a natural, respectful tone. Do not change an answer or decision unless the user changes it.

## Strictest available profile

The default `writingProfile` is `clarity-baseline`. Detect whether the grill includes procedural, instructional, or other text where STE structural rules can materially reduce a misread. Technical subject matter alone is not enough. When there is a clear reason and no profile question exists, add one meta question with id `q-writing-profile` to the current frontier. It counts toward the three-question limit. If the frontier already has three questions, add it in the next round. Keep the baseline active until the user opts in.

Use this question:

- Title: "Use stricter writing checks for this grill?"
- Body: name the detected text type and say how stricter checks may reduce ambiguity. Explain that full ASD-STE100 compliance cannot be claimed because the official word list is unavailable.
- Options: A "Yes — use the strictest available profile for this grill"; B "No — keep the clarity baseline".
- Recommend A only when the detected text benefits from stricter checks. State the trade-off, such as less natural phrasing or the need to keep longer wording for precision.
- Set `durable: false`. This question is session metadata, like `q-domain`, and never a topic decision.

Do not enable strict mode before the user opts in. Only a clear affirmative answer activates it. If the answer is unclear, ask for an explicit choice and keep the baseline active. An unanswered, declined, or deferred question leaves the baseline active. Do not ask again after the user declines. The profile lasts for this grill only. A new grill starts at the baseline. If the user reopens `q-writing-profile`, clear `writingProfile` so the baseline applies until the user answers again.

The `SKILL.md` handling rules record the answer in `writingProfile` in the same patch. A yes answer sets `strictest-available`; a no answer sets `clarity-baseline`; reopen deletes the field. A terminal answer follows the same rule. Resume uses the stored profile. Exclude `q-writing-profile` from the final design doc's decision sections, even when it is open or answered.

When `writingProfile` is `strictest-available`, invoke the separate `asd-ste100` skill if it is available. Apply its strict structural rules to grill-authored text while preserving required meaning and conversational purpose. Use its linter only when the script is available and relevant. If the skill is unavailable, use the baseline rules in this file and tell the user when strict mode starts. If the linter is unavailable, skip linting. Never claim full standard compliance or certification.
