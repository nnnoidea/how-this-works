# Current project commands

Requires Python >=3.9, Git, and Node >=22.18. The entire `how-this-works` directory is a portable, installable skill; `skill_dir` points to its actual installed location. Install the skill's own locked dependencies once: `npm ci --prefix "$skill_dir" --ignore-scripts --no-audit --no-fund`. Do not install or execute the project under study.

## Prepare materials

Given a dedicated bare repository, revision, and `owner/repo` name, one command generates the material inventory, original files, index, and preparation report:

```sh
node "$skill_dir/scripts/materials/study.mjs" prepare \
  --repo "$repo_dir" --revision "$revision" --name "$repo_name" --out "$prepared_dir"
```

The terminal JSON and `preparation.json` report output paths and timings. The same inputs can be rerun; failure reasons are saved. Use a new directory for a different snapshot. Preparation does not require a research model and does not generate a source-material graph.

## Find materials and read originals

Call the following commands through `materials.mjs`, appending `--index` with the index directory. For all arguments and reading budgets, see `node "$skill_dir/scripts/materials/materials.mjs" --help`.

| Command | Purpose |
| --- | --- |
| overview | Project introduction, if available, material overview, parsing coverage, and limits |
| find --term / --path | Exact term or path matching; no question understanding or relevance ranking |
| file --path | Locate declarations/sections; use `--part` to inspect imports, references, or explanation assignments |
| read --path | Read a file or anchor directly, with bounded pages returning text and the next range |
| read --requests - --paged true | Accept a multi-range object from stdin, merge duplicate ranges, then paginate |
| scenario --id | A scenario's starting point, process, outcome, and associated explanations; `overview` lists only brief entry points |
| unit --id | A delivered unit, research status, relationships, and evidence |
| history [--unit ID / --id EVENT_ID] | An organized evolution overview, events for a responsibility, or one event's explanation and historical originals; explicitly fails if no history study exists |
| coverage | Assignments and explanation gaps in the delivered structure |
| check | Material identity and record validity; does not check semantic truth |
| review | Optional hints about record gaps; not a spot check or correctness certification |
| impact --against | Material changes between versions that might affect explanations |

Prefer direct reading; do not first write request files. `start/end` may be omitted to mean from the beginning or through the end of the file. The tool returns only the current page; `next` directly supplies the remaining range and fixed version. Use it as the next request without cursor files.

```sh
node "$skill_dir/scripts/materials/materials.mjs" read --index "$material_index" --path src/example.py
```

Direct reading returns compact text by default; `--format json` returns structured blocks. The budget is 200 lines / 12,000 characters, adjustable downward with `--max-lines/--max-chars`. Limits are 400 lines / 16,000 characters, with a 24,000-character cap for the complete response package. A single line exceeding the character budget produces an explicit message. Inspect the original file if needed; do not pass incomplete text off as complete source. Continuing a read does not automatically register it as read or explained. The host tool must also allow sufficient output space; do not combine multiple large batches into one outer response.

For multiple ranges, use `--requests - --paged true` and submit `{"ranges":[{"path":"src/example.py","start":10,"end":30}]}` through stdin; anchors or evidence may also be used. Paginated reading binds the version to the current index. Explicit `revision/modelHash` values may check an expected version. Pass the `next` object back for continuation. The older `--requests` file input remains supported; without pagination, it retains the contract of returning the full request or a budget error.

Use `overview/file` results for parsing coverage and deferral reasons. Generated materials remain readable. If symbols are needed, use `build --parse-path` for specified files or `--parse-generated true` for all candidates. Missing anchors or matches do not imply missing capabilities, and material references are not runtime dependencies. `impact` cannot determine whether meaning changed and may miss unregistered dependencies.

## Write units and continue research

After initialization, submit semantic objects directly with `edit`; do not first generate request files or patches. Input fields and local editing rules are maintained only in the [Input contract](current-model.md).

```sh
node "$skill_dir/scripts/materials/study.mjs" init \
  --index "$material_index" --out "$study_dir" --target architecture --from - <<'JSON'
{"intro":{"title":"Project name","text":"A project introduction based on materials already read."}}
JSON
node "$skill_dir/scripts/materials/study.mjs" edit --study "$study_dir" --from - <<'JSON'
{"unit":{"title":"An identified responsibility","summary":"What this responsibility provides.","boundary":"Its currently established boundaries."}}
JSON
node "$skill_dir/scripts/materials/study.mjs" edit --study "$study_dir" --id "$unit_id" --from -
```

`edit` accepts unit metadata, `explanations` (inline evidence and independent coverage), `relations`, and `parent`. Submit one item or a small batch for the same unit. Reuse returned unit, explanation, or relationship IDs to update local fields without rewriting the whole unit. The programmatic entry point `editUnit({study,id?,data})` accepts objects. When using a string interface, serialize with `JSON.stringify`; do not manually escape long JSON.

`study unit --id` retrieves the authoring package. Add `--explanation` or `--relation` to read only one entry. Errors identify range or reference issues; fix the relevant entry and resubmit. `--expected unitHash` can prevent overwriting concurrent updates. Empty units may be saved, but export rejects units lacking explanations.

Update project introductions or scenarios with `project --from`. `put` is only for importing/replacing complete authoring packages. `init --model` imports an existing model without inventing a state of understanding.

## Architecture first, then deeper reading

Explicitly select `init --target architecture` or `--target complete` for the task. The example above selects architectural delivery; use `complete` for complete organization. Omission still defaults to `complete`, which is not evidence of the user's request. Initialization returns the actual target and stage for inspection. Both start in the architecture stage. Old studies and imported models do not receive invented stage-completion records. Switch targets only when the task's scope changes, preserving all units and material relationships in the same study:

```sh
node "$skill_dir/scripts/materials/study.mjs" status --study "$study_dir"
node "$skill_dir/scripts/materials/study.mjs" target --study "$study_dir" --target complete
```

`status` returns only current progress and paginated unit summaries. Call `coverage` for global explanation gaps or dangling relationships. Programmatic reads access the corresponding unit page rather than computing the whole project's state for a local query.

`progress --from -` directly submits a [progress object](current-model.md), replacing the current account without retaining a confirmation history. Architecture before deepening remains the research order; fingerprints or repeated confirmations do not enforce it. Marking `complete` checks structural validity and zero explanation-assignment gaps, without requiring a separate prior architecture certificate. A normal `build` can deliver interim results too. Coverage and progress declarations are displayed separately, and a successful build does not prove research is finished.

## Record returned ranges and reuse them

After initialization, prefer the `study` reading entry point. Direct paths, anchors, batched stdin, and `next` continuation ranges work as in the materials interface. The tool records ranges returned by each read, so the Agent need not transcribe a reading log. Recording failure explicitly returns `recorded:false` and a reason; verified original text remains usable.

```sh
node "$skill_dir/scripts/materials/study.mjs" read --study "$study_dir" --path src/example.py --unit "$unit_id"
node "$skill_dir/scripts/materials/study.mjs" readings --study "$study_dir" --path src/example.py
```

The optional `--unit` identifies the current or planned research unit; `--reason` may explain the reading purpose. `readings` reports previously returned ranges, ranges not yet returned for the file, unique and repeated line counts, and stage statistics. It does not cover reading through ordinary shell, browser, or other entry points. An empty log does not establish that nothing was read; do not reread mechanically just to fill the log. For the next page, pass the returned `next` object directly as the request or as `--requests` input. The Agent still maintains unit explanations and planned reading locations. Tools do not treat returned-text logs as proof of understanding. Programmatic entry points are `readForStudy({study,request,unit?,reason?})`, `studyReadings(study)`, and `studyStatus(study)`.

## Deliver the understanding graph and Agent index

For final delivery, explicitly pass the task's target. Use `--target complete` for complete organization:

```sh
node "$skill_dir/scripts/materials/study.mjs" build --study "$study_dir" --target architecture --out "$delivery_dir"
```

With `--target`, `build` checks the recorded target, delivery stage, research note, scenario steps, and existing references before export. `complete` also requires the complete stage and zero explanation-assignment gaps. Failed checks leave an existing delivery unchanged. `deliveryCheck` in the terminal JSON and `build-summary.json` records the structural conditions checked, always with `semanticTruthChecked:false`; it does not certify that all major responsibilities are represented or that explanations are correct. To check the current study without building, use `study.mjs check --study "$study_dir" --target architecture`; the programmatic entry point is `checkStudy({study,target})`.

Without `--target`, `build` retains interim preview behavior and normal website registration but produces no `deliveryCheck`. A successful build is not evidence that research is finished. Draft saves, ordinary exports, and progress updates gain no delivery gate. Use [Research judgments](research-contract.md) to decide whether the architecture is actually established before recording its stage; do not change a target or stage merely to pass a check.

Terminal JSON and `build-summary.json` report artifacts and timings together, including the understanding graph, Agent index, and coverage inventory. Do not assemble reports file by file. A successful web build automatically registers the project in `how-this-works-site/` under the current working directory and returns `site.home` and `site.project`. Use `--site "$site_dir"` to select an existing library. When continuing from a different working directory, pass the same site path to update the same homepage. Rebuilding the same repository updates its existing entry; original study and delivery directories remain. The homepage sorts by registration update time; do not confuse that with the upstream commit date. `--ui false` delivers data only and does not register a page. Advanced standalone builds from existing models use `materials build`; see `--help`.

Report research time and tokens only from available measurements. A command's `elapsedMs` is its own duration, not the duration of the entire study. Omit unavailable measurements rather than estimating them as facts. When a research report is needed, record scope, key findings, and boundaries without reproducing the webpage's explanations.

The Chinese/English button in the header switches only fixed interface text and remembers the browser preference. It does not translate research prose or originals, or rebuild research data.

The webpage also generates a “Sources and licensing” entry: it identifies the work as an independent interpretation, links the upstream repository and fixed version, and preserves standard-named `LICENSE`, `NOTICE`, `COPYRIGHT`, and similar notices verbatim. Web-component licenses are listed separately. This preserves files and displays provenance; it does not certify authorization. Before public display, check the specific licenses of the materials used and rights to independent assets. Do not assume that a public repository or its root license permits arbitrary redistribution of every file.

The understanding graph uses the skill's fixed `assets/web/` template, built by `scripts/build_web.mjs`, without requiring the original development workspace. If only data is needed, explicitly pass `--ui false`; do not describe a data-only delivery as a generated understanding graph. After changing units or the project introduction, the old export is no longer current: rebuild it. Do not edit exports by hand or remove version records. To explicitly read an archive, use the materials commands with `--snapshot true`.

When only the template changes and research data needs no update, run `node "$skill_dir/scripts/build_web.mjs" --out "$delivery_dir"`, then register it again using the command below. Existing learning pages use the same registration command, with repeatable `--add`:

```sh
node "$skill_dir/scripts/site.mjs" --site "$site_dir" --add "$delivery_dir"
python3 -m http.server 8790 --bind 127.0.0.1 --directory "$site_dir"
```

Open `http://127.0.0.1:8790/` in a browser. The site contains the homepage and each project's independent pages, materials, and notices. Copy the whole site and serve it with an ordinary static server; separate project ports are unnecessary. A fixed template generates the homepage. The Agent does not write project cards or link lists by hand. Search supports project names, purposes, and scenarios. Registered copies provide a return-to-home entry, while original deliveries can still be served independently. Old-template archives can be registered without automatically rewriting their reading interactions. Default Agent reads retain freshness checks against authoring data. Use the snapshot mode above to read an archive detached from the original study. This generates static artifacts only; it does not deploy to the public internet.

Run writes, `check`, and `build` sequentially for the same study directory. Although `check` does not edit prose, it holds the study lock; do not run it alongside another check or build. If a lock is reported, wait for the current operation to finish rather than removing it merely because you are not writing prose. See `node "$skill_dir/scripts/materials/study.mjs" --help` for more arguments. The Agent need not recreate internal storage or locking logic.
