# Collections, ecosystem research, and recurring updates

Start from the existing project library, then explore a domain, a direction within it, and an individual project—for example Agent → Memory → Mem0. Observe attention across directions, changes in the solutions within one direction, and design changes inside a project. Do not replace this hierarchy with shared implementation questions from a few handpicked projects.

Reuse architecture studies, Agent indexes, and versioned evidence. The Agent judges classification, mechanisms and the meaning of changes from actual materials, not from filenames, keywords, or Star counts. Scripts handle identity, deduplication, bounded selection, retained versions, work lists, and rendering. A project can have several capabilities; a primary classification prevents duplicate counts within an aggregate, while other capability tags may coexist.

## Choose each collection request

Select the ranking basis, scope, period, and N for the current request; ask before selecting candidates if the basis has not been agreed. Do not assume cumulative stars, monthly growth, or Top 50. Candidates must retain their source, observation time and ordering basis. The script accepts an already ranked candidate list; it is not a universal ranking-data collector. Retrieve candidates through the API or collection tool appropriate to the chosen source, rather than inventing ranks.

Recurring updates do not authorize automatic scheduling or publication. Projects remain in the library when they fall outside a later selection. Selection does not mean research is complete. Research may run in parallel, but serialize commands that modify the same collection.

The plan returns:

| Action | Research needed |
|---|---|
| `new` | Deliver an architecture study using the existing single-project workflow. |
| `reuse` | The reviewed upstream revision is unchanged; reuse its study and retain this selection's metrics. |
| `update` | Read changes since the last reviewed revision, locate affected explanations and consumers, then deepen or revise only as needed. |
| `inspect` | No candidate revision was supplied; pin one before deciding whether anything changed. |

Use `materials.mjs impact --against` to help locate affected explanations; see [current commands](material-supply.md). This does not judge semantic impact. Changes to dependencies or architecture may require broader reading. Existing studies are bound to their original materials: prepare a new material/study directory for another revision, reuse understanding, and verify references. Never relabel old line numbers as new evidence.

If changes do not alter existing explanations, retain the old study and record the review and its evidence. The collection keeps the **study revision** separate from the **reviewed-through revision**. A diff review is not a complete study of the new version. Changes to major capabilities, relationships or classification require corresponding updates.

## Commands and inputs

Requires Python 3.9+. `SCRIPT` is `scripts/collection.py`. JSON can be passed directly with `--from -`; intermediate request files are unnecessary. Keep collections outside the Skill directory.

| Command | Purpose |
|---|---|
| `init --catalog DIR --from -` | Create a collection and optionally register existing studies without copying the entire library. |
| `plan --catalog DIR --batch ID --period YYYY-MM --top N --from -` | Deduplicate, select N, retain selection provenance and work items; preserve existing deliveries before inspecting/updating them. |
| `status --catalog DIR [--batch ID]` | Resume outstanding work rather than recreating a batch. |
| `record --catalog DIR --batch ID --from -` | Register one completed delivery or an evidence-backed review of an existing project. |
| `edit --catalog DIR --from -` | Edit the collection title, domains and direction explanations. |
| `observe --catalog DIR --from -` | Append sourced monthly metric snapshots without replacing earlier observations or treating missing values as zero. |
| `build --catalog DIR` | Generate the collection website in `DIR/site/` with a fixed template, without model calls. |

Use a unique readable batch ID, such as `2026-10-memory-growth`. A month may contain several selections with different scopes or bases. Candidate order is rank order; duplicates do not consume N. A short candidate list remains short rather than silently switching its ranking basis.

Initialization:

```json
{"title":"My project library","domains":[{"id":"agent","label":"Agent"}],"directions":[{"id":"memory","domain":"agent","label":"Memory","text":"Direction explanation","milestones":[]}],"projects":[]}
```

An existing project entry may specify `repo`, numeric GitHub `repositoryId`, `domain`, `direction`, an absolute `delivery` directory, and a working `studyUrl`. Optional interpretation fields are `method`, `scope`, `description`, and `history`. The delivery must contain `index.html` and `understanding.json`. Do not overwrite that delivery before the plan archives it. It must already be an independently readable static study.

Ranked candidates:

```json
{"basis":"The actual ranking basis and scope","source":"Actual source/query","observedAt":"2026-10-01T00:00:00Z","candidates":[{"repo":"owner/project","repositoryId":123,"revision":"pinned-full-commit","score":100}]}
```

Prefer `repositoryId` to recognize renames. Without it, match names only; do not guess that two repositories are the same. Missing `revision` yields `inspect`. The meaning of `score` belongs in `basis`; cumulative stars and monthly star events are different metrics. Example values are not observations.

Completed delivery:

```json
{"repo":"owner/project","repositoryId":123,"revision":"selected-full-commit","delivery":"/absolute/path/to/new-delivery","domain":"agent","direction":"memory","method":"The verified approach","summary":"What changed in this study."}
```

For a review that retains existing explanations, omit `delivery` and provide `reviewEvidence` with actual diff/commit references plus `summary`. New projects cannot skip their first delivery. `history` can reuse a single project's exported `{events:[...]}`; direction `milestones` accept `date/title/text/url/kind`, distinguishing release statements from inspected implementation and inference.

Initial imports may link to an existing site. Subsequent new or updated deliveries are retained under `site/versions/`; identical revision/interpretation pairs share a snapshot. Only archived studies are self-contained with the new site; imported external links must remain accessible. Publish only `site/`, not the research-management files beside it.

Preview with `python3 -m http.server 8790 --bind 127.0.0.1 --directory COLLECTION/site`. Domains have collapsible navigation independent of reading filters; batch and historical study links remain available. The monthly line chart switches between group totals and members; hover or focus a month to see its date and exact metric value. The heatmap remains available for comparison. Missing observations create gaps, never interpolated lines or zero values.

Attention observations are separate from ranking selections. An `observe` input is:

```json
{"metric":"monthly-star-events","label":"Archived monthly star additions","period":"2026-09","source":"Actual aggregation source","observedAt":"2026-10-01T00:00:00Z","warning":"Actual data limitations; omit if absent","values":[{"repo":"owner/project","repositoryId":123,"value":100}]}
```

For repeated metric/period observations, the website displays the latest `observedAt` while retaining earlier snapshots. Different measurement bases need different metric IDs. A group with missing member observations shows a gap rather than presenting a Top N subset as the whole group's attention. State partial months, coverage problems or changed cohorts in `warning`.

## Research over time

Top N limits work; it is not an unbiased census. Ranking movement, renames, classification changes and source gaps are separate facts. Absence from a selection does not mean zero attention. Use comparable observations, do not infer past popularity from today's cumulative stars, and distinguish partial months from completed months.

Retain source windows and coverage diagnostics. The current month cannot by itself explain a drop in earlier completed months; neither does a drop prove a collection failure. Keep an unknown cause unknown.

An existing project's design change may alter its solution category. Update current interpretations while retaining previous studies and their versions. Place attention and design changes together when useful, without presenting temporal coincidence as causation or diffusion.
