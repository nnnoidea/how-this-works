# Research input contract

Use v3 for new studies. See [Current commands](material-supply.md). The Agent supplies explanations and judgments; scripts maintain storage identifiers, associations, and export structures.

## Project and progress

The `init` input includes `intro.title/text`. It may also include `intro.example` (a string identifying the example as illustrative or actually tested; not a `{kind,text}` object), `intro.map`, `displayName`, `omitted`, `validationNote`, and `scenarios` (scenario processes, below). `repo` and `revision` come from the material index. Use `intro.text` for the reader's problem, the project's approach, and the result. Put internal implementation details in responsibility explanations and research scope or unexplored areas in `progress.summary/remaining`, rather than crowding the landing-page introduction. If the study covers only a slice, the introduction must still limit its scope explicitly rather than imply whole-project understanding.

The `progress` input is `{"stage":"deepening","summary":"Overall understanding","remaining":["Areas not yet explored deeply"]}`. `stage` is `architecture`, `deepening`, or `complete`. Use `summary` and `remaining` only for understanding and research gaps. Scripts and pages generate counts of units, explanations, and relationships and report build results; do not repeat build tasks in the prose. `target` maintains the research goal. Complete organization requires zero explanation-assignment gaps; declaring progress does not prove semantic correctness.

`target` says what this delivery aims to achieve; `stage` says what has actually been achieved. Stage `architecture` means the overall architecture is still being established; `deepening` means the main responsibilities and key collaboration have been established and details can be explored further; `complete` means all materials have explanation assignments. `target=complete` is not a completion declaration. A local study without an overall project account remains at `architecture`; do not add a separate slice mode. State its actual scope in the introduction and research note. Checks cannot decide whether the overall architecture is established.

## Scenario processes

Submit `scenarios` through `project`. Each scenario has `id`, `label`, `description`, `start` (starting point), `outcome` (result and boundaries), and `steps`. Steps are readable explanations of the actual process, with `title`, `text`, `nodes` (IDs of units responsible for this step), and `claims` (IDs of explanatory passages in those units that support the explanation). Scripts deduplicate responsibility IDs within each step and derive the set of participating units from the steps; do not maintain it again manually. Export errors identify the scenario and step with an invalid reference.

```json
{"scenarios":[{"id":"one-task","label":"Complete a concrete task","description":"The problem this scenario solves.",
 "start":"The situation the reader faces.","outcome":"What is obtained and where progress may stop.",
 "steps":[{"title":"What happens first","text":"Explain conditions, behavior, division of work, and exceptions.",
 "nodes":["existing-unit-ID"],"claims":["existing-explanation-ID-in-that-unit"]}]}]}
```

Reuse evidence from existing explanations and source material. When support is missing, read more and add it to the relevant unit first. Judge step order, conditions, and branches from materials, not node positions or reference relationships. Do not treat a shared project root as the sole participant in a scenario. Old scenarios without steps can still show associated responsibilities, but the page explicitly states that the process has not been organized; it does not fabricate a workflow.

The understanding graph offers project, scenario, step, and responsibility entry points. Scenarios and steps reuse the same responsibilities without changing unit parent-child relationships. The Agent selects a scenario from `overview`, reads its process with `scenario --id`, and accesses relevant responsibilities with `unit --id`. There is no need to read all scenario prose at once.

## Local writes: edit

On the first call, omit `--id` and submit the unit's `title`, `summary`, and `boundary` to create it. Reuse the returned unit ID thereafter. A request may submit several explanations and relationships for the same unit. Write only fields that need changing; omitted content is preserved. Empty units may be saved temporarily but cannot be exported as completed research.

```json
{
  "unit":{"title":"Return execution results","summary":"Based on actual materials.","boundary":"The scope this unit explains."},
  "explanations":[{
    "title":"What is retained on failure","text":"Explain conditions, behavior, and boundaries coherently.","level":"fact",
    "evidence":[{"path":"src/example.py","start":10,"end":15,
      "role":"implementation","note":"This branch retains failure information.","reviewed":true}],
    "coverage":[{"path":"src/example.py","start":8,"end":18,
      "status":"explained","note":"Explains this branch's entry and result."}]
  }]
}
```

The tool returns IDs in `changed.explanations` / `changed.relations`. To update an explanation, pass its ID and changed fields, for example `{"explanations":[{"id":"ID-returned-by-the-tool","text":"Revised prose"}]}`. Updating `coverage` does not require resending prose or evidence; updating `evidence` does not require resending coverage. Explicit `evidence`/`coverage` arrays replace the corresponding collection for that explanation; `coverage:[]` clears its coverage. `{"id":"...","remove":true}` deletes one explanation or relationship. Deleting an explanation also removes its coverage associations, without deleting other explanations.

`level` is `fact`, `author`, or `inference`. Attach `evidence` directly to explanations. Each item identifies a fixed-version `path` and one-based `start/end`, or an `anchor` returned by the tool. `kind` and `label` are optional. `role` is `declaration`, `implementation`, `test`, or `observation`; `note` explains exactly what it supports. Do not infer the role from a file extension. `reviewed:true` means only that the researcher actually checked this evidence, not that execution was verified or understanding is complete.

`coverage` is independent of `evidence`. Each item has `path`, `start/end`, `status`, and `note`; `status` is `pending` or `explained`. For empty files or unreadable materials, use `wholeFile:true` and omit line numbers. Multiple explanations or units may own the same range. Evidence references do not automatically create explanation coverage, and generated materials do not disappear from the gaps.

`unit.study` supports partial updates to `depth`, `scope`, `openQuestions`, and `nextReads`. `depth` is `located`, `explained`, or `traced`. `scope` bounds actual understanding. Each `openQuestions` item has `question/impact`; each `nextReads` item has `path/reason` and optional `start/end`. Initially, `depth` defaults to `located` and `scope` to the unit's `boundary`. Increasing depth requires explicitly checked evidence. Record checks with `evidence.reviewed`; do not maintain evidence IDs manually.

## Relationships and composition

```json
{"relations":[{"target":"another-unit-ID","kind":"cooperation",
 "label":"Submit execution results","text":"Explain how the two collaborate and under what conditions.",
 "evidence":[{"path":"src/example.py","start":20,"end":25}]}]}
```

A relation starts at the unit being edited (`--id`); `target` names the receiving unit. Write A → B by editing A. To change the source, remove the old relation and add it under the actual source with its supporting evidence. Do not collect every relationship under one unit. Valid endpoint IDs alone do not establish correct collaboration semantics.

The `kind` of a relationship is `cooperation` or `feedback`. Pass its returned ID to update only `text`, `label`, `target`, or `evidence`. Omission preserves content; deletion requires explicit `remove:true`.

For composition, set `parent` on the child unit: `{"parent":{"id":"parent-unit-ID","text":"Why this belongs to that responsibility","evidence":[{"path":"src/example.py","start":1,"end":5}]}}`. Scripts generate composition relationships; do not also maintain a reverse edge. `parent:null` removes parent membership. Discover the hierarchy through research rather than prefilling it from directories. References to units not yet created may be saved temporarily; final export checks integrity.

## Existing data

`study unit` returns the saved authoring package. Use `--explanation` or `--relation` to read only one entry with its inline evidence for local revisions. `--expected unitHash` can check for concurrent changes.

`put` / `putUnit` remain available for full import or replacement of existing authoring packages, accepting `unit`, `evidence`, and optional `relations`, `parentEvidence`, and `parentNote`. They are not the everyday editing entry point. Use saved packages rather than manually rebuilding global ID mappings. `init --model` imports an existing model; do not invent reading states missing from old v2 data. Historical `concepts/questions/events` are not automatically converted into current explanations.
