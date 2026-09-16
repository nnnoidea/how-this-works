# Research judgments and boundaries

Determinism means fixed inputs and rules can be replayed; it does not mean conclusions are necessarily true. Delegate material collection and checks to commands. The judgments below remain the Agent's responsibility.

## Understanding a project

Derive responsibilities and relationships from actual uses, entry points, and materials. Directory or symbol lists do not explain the structure, and shared comparison dimensions must not force a project to have components that do not exist.

Use concrete inputs to explain how key data moves and changes, which conditions determine branches, when processing ends or fails, and how relevant consumers are affected. Preserve gaps where dynamic dispatch, external implementations, or recovery paths have not been read. Check identically named CLIs, services, and other entry points separately; do not generalize all behavior from one entry point.

Prioritize questions that could change the core explanation, such as whether a limit is actually enforced or whether retrying after failure repeats side effects. Split, merge, or revise units as evidence develops, without prescribing their number. Read, assigned, and explained are distinct states. Ununderstood material remains a gap; deep reading of one area does not represent the whole project.

## Nature of evidence

- `fact`: a specific fact directly supported by original materials. You may say “the registry declares this disabled by default,” but not infer that “every execution entry point enforces this.” Explanatory strings in source code are still evidence of a declaration.
- `author`: the author's explicit goals, reasons, and experiment reports. Preserve their original point in time; do not present them as experiments performed in this study.
- `inference`: implications, tradeoffs, or relationships inferred from acquired evidence. State the gaps in the reasoning.
- Reading a test only proves that an assertion exists. For actual execution, retain inputs, fixed version, environment, results, and unverified scope. The specific question and authorization determine whether execution is needed.
- Limit negative conclusions to the inspected scope. A lack of matches does not prove that the repository lacks a capability.

Each piece of evidence must support a specific statement. Summaries must preserve exceptions that change the conclusion. Leave unknown reasons unknown; do not rationalize compatibility burdens, accidental outcomes, or every existing implementation as intentional design. See [Reading standards](reader-friendly.en.md) for organizing the prose. Do not add a spot-check process to the initial version.

## History and cross-project research (only as needed)

Select events that change capabilities, constraints, or design. Group commits around behavioral changes; size, similar titles, or nearby dates cannot substitute for semantic judgment. Policy and maintenance documents may also change boundaries. Record reversals and reintroductions separately. Preserve the exit status of deleted responsibilities and possible successor relationships.

Explain the old problem, why the solution made sense at the time, later limitations, the new mechanism, and its costs. Read the full commit messages and PR/issue discussions that are actually available. A link is only a lead, not proof that its contents were read. Preserve chains of corrections and superseded designs.

Before comparing projects, establish their state objects, lifecycles, and failure models. Identical terminology does not guarantee comparable mechanisms. Temporal sequence does not prove transmission, and a small sample does not represent changes in industry attention.

Scripts provide an approximate integration view based on the first-parent chain and committer timestamps. They cannot establish historical public availability, actual merge times, release dates, or adoption. Committers can rewrite timestamps. Leaving a time window is not a rollback, and the first appearance within a window is not necessarily the first in history. Use the output records for date anomalies and collection scope.

Trend predictions need a cutoff date, observable indicators, falsification conditions, and subsequent outcomes. Automated prediction tracking and backtesting are not currently provided. Abstain when evidence is insufficient; do not present hindsight narratives as prior predictions.
