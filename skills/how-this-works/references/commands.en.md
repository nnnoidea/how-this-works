# History commands and event input

Use only when the task calls for history, time windows, or cross-project research. Requires Python >=3.9 and Git; `SCRIPT` points to `scripts/evolution.py`. Consult `python3 "$SCRIPT" --help` or a subcommand's `--help` for arguments.

| Command | Purpose and main inputs |
| --- | --- |
| sync | Fetch/update a dedicated bare repository: `--slug owner/repo --repo directory` |
| collect | Collect a fixed time window: `--repo`, `--slug`, `--since`, `--until`, `--out`; optionally pin the version with `--revision` |
| inspect | Retrieve before/after materials for a selected commit and path: `--collection`, `--sha`, `--path`, `--out` |
| snapshot | Read the end-of-window snapshot at a specified path: `--collection`, `--path`, `--out` |
| compare | Compare two collections: `--old`, `--new`, `--out` |
| validate | Check event references: `--events`, repeatable `--collection` |
| render | Generate an event timeline and question index: `--events`, `--collection`, `--out`, `--timezone` |
| export | Verify and export events, commit dates, and historical originals for import into a current study: `--events` (accepts `-` for stdin), `--collection` |

`since/until` must include timezones and define a start-inclusive, end-exclusive window. `collect` requires full history; `sync` fills out a dedicated shallow repository. Current-state preparation may use a shallow repository. Do not call `collect` for current-state research alone. After identifying important paths from actual materials, use `--focus-prefix` if appropriate. Candidates are leads for locating material, not judgments of importance.

`collect` returns `manifest.json`, `commits.jsonl`, `candidates.json`, and `index.md`. Use a new directory when output cannot be overwritten. `inspect`/`snapshot` record truncation in metadata. Narrow the scope or adjust `--max-bytes` and retrieve again; do not use truncated content to support conclusions beyond its scope. Scripts handle caching and time calculations; do not recompute them manually.

The `--timezone` option of `render` sets a common display timezone. Monthly statistical indexes use UTC; account for that distinction when comparing months. See [Research judgments](research-contract.en.md) for time and historical interpretation boundaries.

## events.json input

The top level is `{"schema_version":1,"events":[...]}`. Each event has a unique `id`, `repo`, `commit_shas`, nonempty `problem_ids`, `summary`, and `claims`.

A claim has `level` (`fact`, `inference`, or `hypothesis`), `text`, and `evidence`. The first two levels require evidence; a hypothesis may temporarily lack it. Evidence has `commit`, `path`, `start_line`, and `end_line`; versions are restricted to the event's commits and their first parents. Optional fields include `before`, `after`, `motivation`, `tradeoff`, and `missing_evidence`. Explicit motivation still requires corresponding evidence.

The Agent supplies question classifications and event explanations. `validate`/`render` do not generate semantic conclusions. Import historical events through the `history` entry point below, not directly as a current-unit model.

## Connecting history to current learning artifacts

Submit event objects directly with `study.mjs history --study "$study_dir" --collection "$collection_dir" --from -`, or pass an existing event file. The programmatic entry point is `importHistory({study,collection,data})`. Then run a normal `study build`. The same model generates the website and Agent history index; do not write per-project pages.

This entry point requires top-level `summary` (overall evolution explanation) and `scope` (actual research scope). Each event also has `title`, `before`, `after`, and `units` (IDs of related current responsibilities, possibly empty), with optional `motivation`, `tradeoff`, and `missing_evidence`. A root commit has no parent version to compare; state this plainly. Preserve retired approaches as historical events rather than inventing current responsibilities just to link them.

The collection's repository and ending `revision` must match the current study. Historical evidence uses original text from an event commit or its first parent. Tools retrieve dates, before/after version markers, and excerpts. Do not put this evidence into the current snapshot's evidence or explanation coverage. Reference validation does not prove prose correctness or automatically mark a proposal as implemented. Preserve author accounts, research inferences, reversals and corrections, and unknown reasons.

Agents get an event overview with `materials.mjs history --index "$index"`, add `--unit ID` for a responsibility's overview, or add `--id EVENT_ID` to read one event and its versioned originals. `overview` and `unit` also return history entry points. Give subsequent Agents the delivered Agent index directory and this skill; opening the webpage does not by itself make its context known to an Agent.
