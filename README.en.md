# How This Works

**Turn a repository into an interactive guide through its scenarios, architecture, and source.**

[简体中文](README.md) · **English**

You find an interesting project. What problem does it solve? How does one task move through it? Why do its parts work together this way? Can you check the explanation against the implementation?

How This Works is a Skill for coding agents. It guides an Agent through actual project materials, then uses a fixed template to build a learning website and a research index that other Agents can read. It works with code repositories as well as text-heavy Skills, documentation, and configuration projects.

**Architecture analysis is our main focus: understand how a project works first.** Start with its purpose and scenarios, explore how its parts cooperate, and check key explanations against the implementation. Continue with a deep dive when a mechanism needs closer examination, or study history to understand how the design took shape.

> **Showcase: [How This Works](https://www.how-this-works.cn/).** This repository owns the Skill, reusable scripts, and page templates. A separate private website repository maintains study content, classifications, and publishing configuration. Website releases do not automatically include every local study.

![An English gitignore walkthrough with a selected step, an inline explanation, and links to source evidence](docs/images/scenario-en.png)

*An actual generated study of github/gitignore: follow a concrete task, then explore the responsibilities and implementation behind it.*

## Two ways to use it

| What you want to do | How to start |
| --- | --- |
| Understand your own project or another open-source repository | Give the Skill and a repository to your Agent to create a learning website. |
| Learn from an existing project study | Browse the project library, starting with purpose and scenarios before exploring architecture and implementation. Visit the [project learning website](https://www.how-this-works.cn/). |

## Three ways to study a project

| Approach | Questions it helps answer | What you get |
| --- | --- | --- |
| **Architecture analysis · Recommended starting point** | What is this project for? How does a task get done? How do its parts cooperate? | An introduction, scenario walkthroughs, a graph of responsibilities and relationships, and code or documentation supporting key explanations. Unexplored areas are identified. |
| **Deep understanding · Follow a question** | How does this mechanism actually work? Which conditions, exceptions, or limits matter? | Implementation details and boundaries added to existing responsibilities and scenarios, with earlier explanations corrected where needed. Focus on the questions you care about. |
| **Historical evolution · Add when useful** | How did the current design emerge? What was tried, replaced, or removed, and why? | Events connected to current responsibilities, evidence from earlier and later versions, and supported explanations of tradeoffs. Unknown motives remain unknown. |

Architecture analysis includes reading implementation, but does not aim to explain every file. Deep dives and history are optional directions for further research. A project need not go through all three, and historical research does not require a complete deep dive first.

As of September 22, 2026, our local library contains **135 project studies**. The earlier batches focused on architecture analysis across Agent frameworks, coding assistants, Skills, memory and context, evaluation, and verification. A few projects also include history. This count does not mean 135 exhaustive codebase studies, or that all of them are already available online.

## Follow a scenario. Explore the architecture. Check the evidence.

- **Start with what the project does.** Learn who uses it, for which task, with what inputs and outcomes. Reading the code first is not required.
- **Follow one task through the project.** Select a scenario step to see what happens, who handles it, and which conditions or exceptions matter.
- **Review the architecture.** Explore a graph of responsibilities and relationships, expanding details while retaining related context.
- **Check original materials.** Explanations link to a pinned version of the code or documentation. Browse the original directory structure to see covered materials and explanation gaps.
- **Trace history when needed.** Use commits and version differences to understand design changes, including approaches that were replaced or removed.
- **Keep asking your Agent.** The generated `agent/` index supports reading by scenario, responsibility, file, or historical event, so further research need not load the entire repository at once.

![The gitignore understanding graph highlights responsibilities involved in the selected scenario, with their steps shown alongside](docs/images/architecture-en.png)

*Return from a scenario to connect the steps you just read with the project's division of responsibilities.*

<details>
<summary>See a design evolution example</summary>

![A LoopX history study showing earlier problems, implementation changes, and links to current responsibilities; this study is in Chinese](docs/images/history-zh.png)

This LoopX study is shown in Chinese. Historical research is added when requested and links explanations to the relevant older versions. Building a current architecture does not imply that the project's full history has been studied.

</details>

## What do deeper reading and history add?

We used Luna to continue existing architecture studies of Ponytail and Loop Anything, first with targeted deep dives and then with history. These examples show what we learned beyond the architectural overview.

### Deep understanding: establish what a feature actually guarantees

- **Ponytail: how are shared rules kept consistent across hosts?** The checker compares seven specified copies with a compact rule set and checks nine key phrases in both the full Skill and the compact version. It detects particular differences; it does not generate and synchronize every copy from the full Skill. Readers can now judge what a passing consistency check guarantees. [Read the checker at the studied revision](https://github.com/DietrichGebert/ponytail/blob/e3ba2aa6f1e6f0bc4d69eb09c9f0d0a93af56156/scripts/check-rule-copies.js).
- **Loop Anything: who enforces stages and turn budgets?** Reading through the CLI shows that it validates stage names and produces prompts and state files. It does not enforce transitions against the active state or count executed turns. Progress relies on the Agent and operator following the conventions—a useful distinction when deciding how to use its loop. [Read the CLI at the studied revision](https://github.com/rossinsilico/loop-anything/blob/b817268b1cd4b9abdc2581194f8bbc5c517e6cf3/src/cli.js).

### Historical evolution: recover choices absent from the current version

- **Ponytail: why was a web guidance lookup rule removed?** The rule was added to the always-loaded Skill, then removed because of external CLI availability, persistent context overhead, and problems keeping a mirror in sync. Reading only the current version would hide both the experiment and its tradeoffs. [Read the removal commit and the author's explanation](https://github.com/DietrichGebert/ponytail/commit/cf9cbd531eb988c87ee82fcd6d2a3a3f0a3bd9b7). This study organized 213 first-parent commits reachable from the pinned revision into 17 historical events.
- **Loop Anything: how did its unified entry point emerge?** Four commits show the progression from template installation and checks to stage handoff prompts, work-object and budget conventions, and a unified Skill entry point. This reveals the formation of a design; all four commits occurred on one day, so they cannot establish long-term optimization trends. [Browse the history at the studied revision](https://github.com/rossinsilico/loop-anything/commits/b817268b1cd4b9abdc2581194f8bbc5c517e6cf3/).

Interactive pages for these two new examples have been built locally but are not yet published. The links above point to their original evidence. The studies reused existing architecture and evidence, with reference corrections and focused verification. They are static studies: we did not run the upstream projects or claim exhaustive explanation coverage.

## Get started

You need **Git, Python 3.9+, Node.js 22.18+**, and an Agent that can read Skill instructions, access files, and execute local commands.

### 1. Prepare the Skill

After downloading this repository, install the Skill's dependencies from the repository root:

```sh
npm ci --prefix skills/how-this-works --ignore-scripts --no-audit --no-fund
```

Ask your Agent to read [`skills/how-this-works/SKILL.md`](skills/how-this-works/SKILL.md) to use it in this workspace. You can also copy the entire `skills/how-this-works/` directory into a Skill location supported by your Agent, then run `npm ci --ignore-scripts --no-audit --no-fund` inside that copy. The Skill has one maintained English instruction set: `SKILL.md`, its references, and Agent metadata. Request studies in Chinese or English directly; the instruction language does not determine the study language, and no entry-file replacement is needed.

When distributing the Skill, retain its scripts, templates, and dependency lockfile. Leave out `node_modules`, caches, and research outputs. Preparing materials does not require installing or starting the project being studied.

### 2. Give your Agent a repository

Replace the example URL with a project you want to understand:

```text
Read skills/how-this-works/SKILL.md and use this Skill to study
https://github.com/github/gitignore.

Deliver an architecture-level study first: explain the purpose, main
responsibilities, and a representative usage scenario. Link explanations
to actual code or documentation, and identify areas not yet explored deeply.

Keep the study under ./studies/gitignore and use ./how-this-works-site
as the shared project library. Build the learning website and tell me
how to open it. Leave historical research for later.
```

Make your request in English or Chinese, or explicitly specify the language of the study. The Agent writes directly in that language; it does not need to generate Chinese first or produce two language versions of every project.

### 3. Open the generated website

A successful web build automatically adds the project to the chosen library. With the paths above, run this from the repository root:

```sh
python3 -m http.server 8790 --bind 127.0.0.1 --directory how-this-works-site
```

Open [http://127.0.0.1:8790/](http://127.0.0.1:8790/) in your browser. Use the same site directory when studying more projects to extend the library.

The **English / 中文** button switches only fixed interface text such as navigation, hints, and labels, preserving your reading position. Project explanations, historical prose, and source materials stay in their original language.

## Understand the architecture, then choose how deep to go

An architecture study is often enough to start learning and asking your Agent further questions. Provide the study directory, generated `agent/` index, and Skill, then describe what you want to investigate. For example:

```text
Continue the existing study and preserve its architecture. Investigate
the state recovery mechanism: who writes the state, what is read during
recovery, and how are failures or conflicts handled?
Follow the implementation, add the explanations and evidence to the
relevant responsibilities, and rebuild the website.
```

Or add history independently:

```text
Continue the existing study with the history of its key responsibilities.
Use commits and before/after versions to explain important approaches
that were introduced, revised, or removed, linking them to current responsibilities.
Distinguish the author's stated reasons from research inferences.
State the historical scope and rebuild the website.
```

If you need a complete study, ask the Agent to fill explanation-assignment gaps for all materials within scope. That is broader than a targeted deep dive. The scripts still have only two delivery targets: `architecture` and `complete`. Deep dives and history describe research approaches, not additional command modes.

Further research can reuse existing units, evidence, and reading records. Opening a webpage does not automatically send your reading position to an Agent; describe the question you want to explore.

Scripts handle material collection, indexing, version and reference checks, coverage statistics, and web builds. The Agent reads, judges, and explains. Complete coverage or valid references do not guarantee correct explanations; the site retains research boundaries and access to original evidence.

## Further reading

- **Maintain a collection over time:** choose the ranking basis, scope and Top N for each run. Add new projects, review existing ones incrementally, and retain earlier studies and selection records. Scripts build the site with collapsible domain and direction navigation. See [Collections and recurring updates](skills/how-this-works/references/collection.md). This does not automatically schedule work or publish a website.
- [Current project commands: prepare, read, edit, and build](skills/how-this-works/references/material-supply.md)
- [Research input contract](skills/how-this-works/references/current-model.md)
- [Historical research commands](skills/how-this-works/references/commands.md)
- [Writing for new readers](skills/how-this-works/references/reader-friendly.md)

Screenshots show actual locally generated learning pages. How This Works provides independent project studies, not upstream endorsements. Before publishing generated pages, check the original materials' licensing and attribution requirements.
