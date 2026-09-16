// CodeGraph MIT excerpt; see ORIGIN.md and LICENSE.codegraph.
const MIN_SEGMENT_CHARS = 2;
const MAX_SEGMENT_CHARS = 32;
const MAX_SEGMENTS_PER_NAME = 12;

/**
 * Split a symbol or file name into lowercase word segments.
 *
 * Handles camelCase / PascalCase (inner lower→Upper), acronym runs
 * ("HTMLParser" → html/parser), snake_case / kebab-case / dotted file names
 * (non-alphanumerics separate), and keeps digits glued to their word
 * ("base64Encode" → base64/encode). Digit-only fragments are dropped.
 */
export function splitIdentifierSegments(name: string): string[] {
  if (!name) return [];
  const out = new Set<string>();
  for (const run of name.match(/[\p{L}\p{N}]+/gu) ?? []) {
    // Split before an Upper that follows lower/digit (camelCase hump), and
    // before the last Upper of an acronym run when a lowercase follows
    // ("HTMLParser" → HTML | Parser).
    const parts = run.split(/(?<=[\p{Ll}\p{N}])(?=\p{Lu})|(?<=\p{Lu})(?=\p{Lu}\p{Ll})/u);
    for (const part of parts) {
      if (out.size >= MAX_SEGMENTS_PER_NAME) return [...out];
      const seg = part.toLowerCase();
      if (seg.length < MIN_SEGMENT_CHARS || seg.length > MAX_SEGMENT_CHARS) continue;
      if (/^\p{N}+$/u.test(seg)) continue;
      out.add(seg);
    }
  }
  return [...out];
}

