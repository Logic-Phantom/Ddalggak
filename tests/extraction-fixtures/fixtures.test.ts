import { extractFields } from '@/features/extraction/field-extraction-service';

import data from './fixtures.json';

type Pair = [string, string | null];
interface Case {
  id: string;
  kind: string;
  text: string;
  expect: { category?: string; dates?: Pair[]; amounts?: Pair[]; fields?: Pair[]; lowConfidence?: string[] };
}

const [y, m, d] = data.today.split('-').map(Number);
const today = new Date(y, m - 1, d, 10, 0);

/**
 * Synthetic text fixtures run through the same pipeline OCR text will use (method 'ocr' caps
 * confidence). These check the rules, not OCR accuracy — real OCR samples are tracked in docs/TESTING.md.
 */
describe.each(data.cases as Case[])('$id ($kind)', (c) => {
  const r = extractFields({ text: c.text, method: 'ocr', today });

  if (c.expect.category) {
    it(`suggests ${c.expect.category} first`, () => expect(r.categories[0].category).toBe(c.expect.category));
  }
  if (c.expect.dates) {
    it('finds dates with their meaning', () => {
      const dates = r.fields.filter((f) => f.fieldType === 'date').map((f) => [f.role, f.normalizedValue]);
      expect(dates).toEqual(c.expect.dates);
    });
  }
  if (c.expect.amounts) {
    it('finds amounts with their meaning', () => {
      const amounts = r.fields.filter((f) => f.fieldType === 'amount').map((f) => [f.role, f.normalizedValue]);
      expect(amounts).toEqual(c.expect.amounts);
    });
  }
  for (const [type, value] of c.expect.fields ?? []) {
    it(`finds ${type}${value ? ` = ${value}` : ''}`, () => {
      const hit = r.fields.find((f) => f.fieldType === type && (value == null || f.valueText === value));
      expect(hit).toBeDefined();
    });
  }
  for (const type of c.expect.lowConfidence ?? []) {
    it(`marks ${type} as low confidence`, () => {
      expect(r.fields.find((f) => f.fieldType === type)?.confidence).toBe('low');
    });
  }
  it('never auto-confirms anything', () => {
    expect(r.fields.every((f) => !f.userConfirmed)).toBe(true);
  });
});
