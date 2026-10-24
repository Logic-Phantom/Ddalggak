import { findReturnPolicyPhrases, parseDates } from '@/features/extraction/date-parser';
import { normalizeText } from '@/features/ocr/text-normalizer';

// Saturday, 2026-10-24 (local).
const today = new Date(2026, 9, 24, 10, 0);
const parse = (t: string) => parseDates(normalizeText(t), { today });

describe('date parser — absolute dates', () => {
  it.each([
    ['2026년 10월 17일', '2026-10-17'],
    ['2026.10.17', '2026-10-17'],
    ['2026/10/17', '2026-10-17'],
    ['2026-10-17', '2026-10-17'],
    ['２０２６．１０．１７', '2026-10-17'], // full-width digits
  ])('%s → %s with high confidence', (input, value) => {
    const [d] = parse(input);
    expect(d.value).toBe(value);
    expect(d.yearInferred).toBe(false);
    expect(d.confidence).toBe('high');
  });

  it('reads two-digit years as medium confidence', () => {
    const [d] = parse('거래일시 26.10.17 13:05');
    expect(d.value).toBe('2026-10-17T13:05');
    expect(d.confidence).toBe('medium');
    expect(d.role).toBe('purchase');
  });

  it('rejects impossible dates (Feb 30, month 13) and accepts Feb 29 in leap years', () => {
    expect(parse('2026.02.30')).toHaveLength(0);
    expect(parse('2026.13.01')).toHaveLength(0);
    expect(parse('2028.02.29')[0].value).toBe('2028-02-29');
    expect(parse('2027.02.29')).toHaveLength(0);
  });
});

describe('date parser — missing year, ambiguity, relative', () => {
  it('infers the year for "10월 17일" with low confidence', () => {
    const [d] = parse('10월 17일');
    expect(d.value).toBe('2026-10-17');
    expect(d.yearInferred).toBe(true);
    expect(d.confidence).toBe('low');
  });

  it('raises inferred-year dates to medium when the written weekday matches', () => {
    expect(parse('10월 31일 (토)')[0].confidence).toBe('medium');
  });

  it('flags a mismatched weekday as ambiguous', () => {
    const [d] = parse('10월 31일 (월)');
    expect(d.ambiguous).toBe(true);
    expect(d.confidence).toBe('low');
  });

  it('rolls a long-past month/day into next year', () => {
    expect(parse('1.15까지')[0].value).toBe('2027-01-15');
  });

  it('marks "03/04" as ambiguous but "10.17" as not', () => {
    expect(parse('03/04')[0].ambiguous).toBe(true);
    expect(parse('10.17')[0].ambiguous).toBe(false);
  });

  it('does not read prices, ratings or versions as dates', () => {
    expect(parse('10.99 USD')).toHaveLength(0);
    expect(parse('평점 4.5점')).toHaveLength(0);
    expect(parse('할인율 10.5%')).toHaveLength(0);
  });

  it.each([
    ['오늘', '2026-10-24'],
    ['내일', '2026-10-25'],
    ['모레', '2026-10-26'],
    ['이번 주 금요일', '2026-10-23'],
    ['다음 주 월요일', '2026-10-26'],
    ['D-7', '2026-10-31'],
  ])('relative "%s" → %s (low confidence)', (input, value) => {
    const [d] = parse(input);
    expect(d.value).toBe(value);
    expect(d.relative).toBe(true);
    expect(d.confidence).toBe('low');
  });
});

describe('date parser — time and role', () => {
  it.each([
    ['2026.10.31 18:00', '2026-10-31T18:00'],
    ['2026년 10월 31일 오후 7시', '2026-10-31T19:00'],
    ['2026년 10월 31일 오전 10시 30분', '2026-10-31T10:30'],
    ['2026.10.31 (토) 19:30', '2026-10-31T19:30'],
    ['2026.10.31 오전 12시', '2026-10-31T00:00'],
    ['2026.10.31 오후 7시 반', '2026-10-31T19:30'],
  ])('%s → %s', (input, value) => {
    expect(parse(input)[0].value).toBe(value);
  });

  it('ignores invalid attached times', () => {
    expect(parse('2026.10.31 25:00')[0].value).toBe('2026-10-31');
  });

  it.each([
    ['유효기간 2026.10.31까지', 'expiry'],
    ['사용기한: 2026.12.31', 'expiry'],
    ['예약일 2026.11.02 18:00', 'reservation'],
    ['주문일 2026.10.01', 'order'],
    ['결제일 2026.10.01', 'purchase'],
    ['배송 예정 2026.10.03', 'delivery'],
    ['반품 마감 2026.10.20', 'return-deadline'],
    ['보증기간 2028.10.01', 'warranty-end'],
    ['발행일 2026.10.01', 'issue'],
    ['행사 일시 2026.11.07', 'event'],
    ['2026.11.07', 'unknown'],
  ])('%s → role %s', (input, role) => {
    expect(parse(input)[0].role).toBe(role);
  });

  it('uses the label nearest to the date ("교환권" is not a return policy)', () => {
    expect(parse('[모바일 교환권] 쿠폰번호: 1234 유효기간 2026.12.31까지')[0].role).toBe('expiry');
    expect(parse('교환/반품 마감 2026.10.20')[0].role).toBe('return-deadline');
  });

  it('distinguishes several dates on one line by their own labels', () => {
    const ds = parse('주문일 2026.10.01 / 배송 예정 2026.10.03');
    expect(ds.map((d) => d.role)).toEqual(['order', 'delivery']);
  });

  it('treats "~10.31" inside an expiry line as the expiry date', () => {
    const ds = parse('사용 가능 기간 2026.10.01 ~ 2026.10.31');
    expect(ds[1].role).toBe('expiry');
  });

  it('keeps the source line as evidence', () => {
    const [d] = parse('안내\n쿠폰 유효기간 2026.10.31까지');
    expect(d.evidence).toBe('쿠폰 유효기간 2026.10.31까지');
  });
});

describe('return policy phrases', () => {
  it('finds "7일 이내 반품" without turning it into a date', () => {
    expect(findReturnPolicyPhrases('수령 후 7일 이내 반품 가능')).toEqual([{ raw: '7일 이내 반품', days: 7 }]);
    expect(findReturnPolicyPhrases('교환/반품은 14일 이내')[0].days).toBe(14);
    expect(parse('수령 후 7일 이내 반품 가능')).toHaveLength(0);
  });
});
