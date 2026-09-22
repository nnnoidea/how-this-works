# Research judgments and boundaries

Determinism means fixed inputs and rules can be replayed; it does not mean conclusions are necessarily true. Delegate material collection and checks to commands. The judgments below remain the Agent's responsibility.

## Understanding a project

Use the README, main usage examples, quickstart, and the materials they point to to identify what the project wants users to understand: recurring problems, representative tasks, outputs, and distinguishing choices. Treat these as revisable leads, locate the materials that deliver that value, and trace a representative task to verify its key choices and limits. If the README is missing, outdated, or contradicted by implementation, revise the account using available entry points, examples, and actual materials, explaining the discrepancy. Lengthy installation instructions do not make installation the core, and a file named SKILL.md is not automatically the focus. A Skill, core code, protocol, or documentation may carry the main value, depending on this project’s evidence.

The core explanation should connect the user’s problem, the project’s approach, and its result before explaining why supporting mechanisms are needed. Derive responsibilities and relationships from this verified account and the other major capabilities. Directory or symbol lists do not explain the structure, and shared comparison dimensions must not force a project to have components that do not exist.

Use concrete inputs to explain how key data moves and changes, which conditions determine branches, when processing ends or fails, and how relevant consumers are affected. When connecting scenario steps, check each next step's preconditions against the state actually produced by the preceding step: for example, whether a file created during initialization makes a later command refuse to overwrite it. Operations that work individually may not work in the sequence described. Preserve gaps where dynamic dispatch, external implementations, or recovery paths have not been read. Check identically named CLIs, services, and other entry points separately; do not generalize all behavior from one entry point.

Prioritize questions that could change the core explanation, such as whether a limit is actually enforced or whether retrying after failure repeats side effects. Split, merge, or revise units as evidence develops, without prescribing their number. Read, assigned, and explained are distinct states. Ununderstood material remains a gap; deep reading of one area does not represent the whole project.

Architectural delivery depends on evidence for the main responsibilities and their key collaboration. Compare the project’s main advertised or discovered capabilities with the account actually written: each needs a supported explanation and a reachable entry, or an explicit unresolved gap. Do not count a name in the introduction or a disclaimer as explaining a capability. Examine different entry points, code, Skills, documentation, and configuration rather than treating the first traced path as the whole project. This does not require another inventory or a minimum amount of reading. If unread material could overturn a core explanation, read the necessary available implementation or narrow the conclusion. Keep establishing the architecture while major responsibilities or relationships remain unsupported; secondary mechanisms and external implementations may retain explicit boundaries. For a topical study, limit the introduction, summary, and progress note to that slice without claiming that the whole project's architecture has been established.

## Nature of evidence

- `fact`: a specific fact directly supported by original materials. You may say “the registry declares this disabled by default,” but not infer that “every execution entry point enforces this.” Comments, logs, and explanatory strings establish what the code says, but cannot independently establish that their descriptions match actual behavior.
- `author`: the author's explicit goals, reasons, and experiment reports. Preserve their original point in time; do not present them as experiments performed in this study.
- `inference`: implications, tradeoffs, or relationships inferred from acquired evidence. State the gaps in the reasoning.
- Reading a test only proves that an assertion exists. For actual execution, retain inputs, fixed version, environment, results, and unverified scope. The specific question and authorization determine whether execution is needed.
- Limit negative conclusions to the inspected scope. A lack of matches does not prove that the repository lacks a capability.

Judge evidence by the claim, not the file extension. Skill text can define a workflow, but “requires a check first” does not mean “the program blocks unchecked operations”; the latter needs evidence from actual execution or control branches. For code repositories, directories, imports, type signatures, help text, and READMEs can guide navigation but cannot independently establish execution mechanisms.

Each piece of evidence must support a specific statement. Summaries must preserve exceptions that change the conclusion. Leave unknown reasons unknown; do not rationalize compatibility burdens, accidental outcomes, or every existing implementation as intentional design. See [Reading standards](reader-friendly.md) for organizing the prose. Do not add a spot-check process to the initial version.

## History and cross-project research (only as needed)

Select events that change capabilities, constraints, or design. Group commits around behavioral changes; size, similar titles, or nearby dates cannot substitute for semantic judgment. Policy and maintenance documents may also change boundaries. Record reversals and reintroductions separately. Preserve the exit status of deleted responsibilities and possible successor relationships.

Explain the old problem, why the solution made sense at the time, later limitations, the new mechanism, and its costs. Read the full commit messages and PR/issue discussions that are actually available. A link is only a lead, not proof that its contents were read. Preserve chains of corrections and superseded designs.

Before comparing projects, establish their state objects, lifecycles, and failure models. Identical terminology does not guarantee comparable mechanisms. Temporal sequence does not prove transmission, and a small sample does not represent changes in industry attention.

Scripts provide an approximate integration view based on the first-parent chain and committer timestamps. They cannot establish historical public availability, actual merge times, release dates, or adoption. Committers can rewrite timestamps. Leaving a time window is not a rollback, and the first appearance within a window is not necessarily the first in history. Use the output records for date anomalies and collection scope.

Trend predictions need a cutoff date, observable indicators, falsification conditions, and subsequent outcomes. Automated prediction tracking and backtesting are not currently provided. Abstain when evidence is insufficient; do not present hindsight narratives as prior predictions.
