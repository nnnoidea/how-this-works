// CodeGraph MIT excerpt; see ORIGIN.md and LICENSE.codegraph.
type ExploreLineRange = {start: number; end: number};
/** Sort + merge overlapping/adjacent spans into the smallest equivalent set. */
export function mergeRanges(ranges: ReadonlyArray<ExploreLineRange>): ExploreLineRange[] {
  const valid = ranges
    .filter((r) => Number.isFinite(r.start) && Number.isFinite(r.end) && r.end >= r.start && r.start >= 1)
    .map((r) => ({ start: Math.floor(r.start), end: Math.floor(r.end) }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const out: ExploreLineRange[] = [];
  for (const r of valid) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end + 1) last.end = Math.max(last.end, r.end);
    else out.push({ ...r });
  }
  return out;
}

