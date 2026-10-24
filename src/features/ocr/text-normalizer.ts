/**
 * Normalizes OCR / shared text before rule-based extraction. The original text is kept separately
 * as evidence; this output is only used for matching.
 */
export function normalizeText(input: string): string {
  let t = input.replace(/\r\n?/g, '\n');
  // Full-width digits/letters/punctuation → ASCII (Korean receipts often use full-width forms).
  t = t.normalize('NFKC');
  // Dash and tilde variants used in ranges ("10.1 ～ 10.31").
  t = t.replace(/[〜～∼]/g, '~').replace(/[‐‑‒–—―−]/g, '-');
  // Common OCR confusions inside numbers ("2O26" → "2026", "1O.31" → "10.31", "1l:30" → "11:30").
  t = t
    .replace(/(?<=\d)[Oo](?=[\d.\-/:])|(?<=\d[.\-/:])[Oo](?=\d)/g, '0')
    .replace(/(?<=\d)[lI|](?=\d)/g, '1');
  // Collapse runs of spaces/tabs but keep line structure.
  t = t
    .split('\n')
    .map((line) => line.replace(/[ \t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
  return t.trim();
}

/** Splits into non-empty lines with their start offset in the normalized text. */
export function linesWithOffsets(text: string): { line: string; offset: number }[] {
  const out: { line: string; offset: number }[] = [];
  let offset = 0;
  for (const line of text.split('\n')) {
    if (line.trim()) out.push({ line, offset });
    offset += line.length + 1;
  }
  return out;
}
