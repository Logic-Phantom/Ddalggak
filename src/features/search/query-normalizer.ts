/** Splits a search box query into at most 5 terms (all must match). */
export function splitTerms(query: string): string[] {
  return Array.from(
    new Set(
      query
        .normalize('NFKC')
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ).slice(0, 5);
}
