# Explaining a project to new readers

Language is part of the learning product. Readers should not have to reconstruct background you already acquired during research before they can understand your conclusions.

Content is currently organized through the understanding graph, project explanations, and units read on demand. After establishing the purpose, explain the overall approach before exploring the key design choices actually discovered. Features, stages, responsibilities, and mechanisms need not form a fixed hierarchy. Each unit explains how it relates to the whole or the original problem. The understanding graph preserves the context of parent and directly related units, with explanations opened nearby. Source materials use inventories and original-text verification.

Keep “what it does” next to “why it does it this way.” For a choice, explain the concrete difficulty, selected approach, cost, and conditions together. Do not separate purpose and method into different levels and require another click to reconnect the reasoning. Organize titles and paragraphs around the materials, without forcing every item to have the same number of subsections. Preserve historical accidents, compatibility needs, failures, and unknown reasons. Do not rationalize every current implementation detail as a deliberate decision by the author.

## Where the writing should lead

First check whether the reader knows what the project does. If that shared understanding is missing, explain users, scenarios, features, and the inputs and outputs of one use before introducing internal mechanisms. “Why indexing fails” cannot be the first lesson for someone who does not yet know why indexing is needed.

The researcher needs to read code; the learner does not necessarily need to start there. Use a complete usage process to explain the work of the user, assistant, and tools. Clearly distinguish illustrative workflows from actual test results. Evidence may remain collapsed on the introduction page; readers should be able to understand the project's purpose from the prose alone. Feature names should explain what task they help accomplish, rather than presenting internal architectural characteristics as user features.

Summaries help readers choose an entry point. Once they enter a responsibility or question, develop the explanation in connected paragraphs. Let the reasoning determine the length; do not prescribe word counts or required subsections. Readers usually need to know what happened, why the earlier approach could not handle it, which responsibility or condition changed, and what costs remain.

Introduce terminology when needed and explain its role in the current scenario. Function names and evidence links locate material; they do not substitute for explanations missing from the prose. If readers must reason from A to C, supply B. Avoid compressing a string of internal operations into a single sentence.

For example, “incremental indexing must maintain incoming edges” does not explain the problem. First explain that A calls B. When only B changes, its old node is deleted, and database cascading rules also delete the edge from A to B, while A is not extracted again. Readers can then understand why “updating changed files” does not imply “relationships remain correct,” and know which step to check in the source.

## Present and history

Current-state prose explains responsibilities, contracts, key conditions, and boundaries. Historical prose explains what the earlier approach solved at the time, which limitations emerged later, and why it was narrowed or replaced. Do not use today's outcome to portray the past as obviously mistaken.

When the author's reasons are unavailable, explain costs and constraints from the implementation while clearly marking the inference. Reasons in commit bodies are usable material; do not read only titles and then claim that motivation is unknown. Preserve how later corrections change earlier judgments.

Deletion does not mean the problem disappeared, and reappearance does not prove continuous inheritance. Preserve the exit status of historical responsibilities, old-version evidence, and possible successor relationships. Distinguish “the implementation disappeared,” “the problem continued,” and “whether the effects are equivalent.”

## Keep boundaries near conclusions

Author reports, current source code, test assertions, and actual execution are different kinds of material. Readers should not reach the end before discovering that an important conclusion is only an inference. State conditions for performance ratios. When reusing an earlier experiment, identify when it took place rather than implying that it was rerun in this study.

Do not pad a detailed explanation with repeated disclaimers. Boundaries should help readers judge where an insight applies and what to verify when conditions change.

## Checks while writing

Check the following while writing a unit, without adding a separate spot-check or independent review step:

- Can someone who has never read the source first explain what the project does, who uses it, when, and what it returns?
- Can they understand the scenario and terminology without the researcher's background?
- Can they describe the main collaboration in their own words and explain which work is prepared in advance, performed on demand, or delegated externally? These are observational questions, not assumptions that every project must precompute something.
- Do they know why the earlier approach seemed reasonable and where it fell short?
- Can they find the actual code or author material supporting key transitions?
- Can they distinguish implementation facts, inferred tradeoffs, and effects that have not been independently verified?
- Which changed conditions would make an alternative worth reconsidering?

Record specific reasoning gaps found and before/after examples of revisions. The research Agent's self-check establishes only that a reading review occurred, not that real users have mastered the content. Browser tests verify presentation and interaction only.

## Reviewing summaries and evidence

Read the summary on its own first, then compare it with the detailed explanation and supporting materials. Check whether it compresses “one stage is read-only” into “all preparation operations are read-only,” or generalizes a gate on one entry point to all entry points. Restore exceptions that affect the conclusion.

For each evidence item, record the specific judgment it supports. `purpose`, `help`, and `description` strings in source still express declarations; a source-file extension alone does not prove that a restriction is enforced. To explain actual behavior, read the checking branch, consumers, and necessary failure handling. Without that evidence, narrow the claim or retain a gap.

Start with a scenario the reader can understand: what is taken over, the key choices, and the result. Then introduce project terminology. Do not substitute glossaries, sequences of function names, or repeated “not executed” statements for a coherent explanation.

Use understandable responsibility descriptions for node titles, such as “Decide whether to execute the next step.” Explain corresponding English terms and code names when first used in the prose. Do not make titles mere lists of internal terms.

Begin learning with a concrete situation that establishes the project's purpose, then follow one task through its process, revisit the division of responsibilities, and explore key choices. Scenarios explain how the parts work together for that task; units explain their own responsibilities and mechanisms. Do not duplicate entire explanations. Describe conditions and exceptions nearby, with entry points to the original supporting materials.

The homepage starts with purpose, examples, and scenario choices, rather than an unfamiliar responsibility graph. The overall architecture supports reflection after learning: preserve the originating scenario and step, connect concrete steps to the responsibilities actually involved, and help readers discover how the same responsibility participates in other scenarios. Do not add a “project overview” entry that duplicates “get to know the project” without a distinct purpose.

When entering a responsibility from a scenario, explain it in plain language before introducing implementation terms. Describe relationships in the reader's primary language too. If a scenario promises an operation, provide a concrete entry point and a way to check the result, supported by materials. Make the boundary between a static example of collaboration and a complete operational tutorial clear. Do not invent unverified integration or recovery paths as facts.
