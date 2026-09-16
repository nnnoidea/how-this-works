CodeGraph reusable excerpts

Source: https://github.com/colbymchenry/codegraph
Snapshot: b9ca4b7981116909900368cc1686a1074cd4d4c1
License: MIT; complete notice in LICENSE.codegraph.

- identifier-segments.ts: src/search/identifier-segments.ts, constants and splitIdentifierSegments; implementation unchanged. Prose normalization and prompt gating omitted.
- ranges.ts: src/mcp/explore-dedup.ts, mergeRanges; implementation unchanged. Added a local structural type for ExploreLineRange.

The caller validates integer ranges before merging. Only within-request union is used by default. No session-memory assumptions, thresholds for withholding source, or automatic question interpretation are inherited.
