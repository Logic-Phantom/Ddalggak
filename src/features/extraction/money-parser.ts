import type { ConfidenceLevel, MoneyRole } from '@/domain/models';

import { linesWithOffsets } from '../ocr/text-normalizer';

export type Currency = 'KRW' | 'USD' | 'EUR' | 'JPY';

/** Minor units per major unit. Amounts are stored as integers in minor units (no floating point). */
export const CURRENCY_DECIMALS: Record<Currency, number> = { KRW: 0, JPY: 0, USD: 2, EUR: 2 };

export interface MoneyCandidate {
  raw: string;
  /** Integer amount in minor units (원, cents). Negative for discounts written with a minus sign. */
  minor: number;
  currency: Currency;
  role: MoneyRole;
  confidence: ConfidenceLevel;
  evidence: string;
}

const ROLE_RULES: [RegExp, MoneyRole][] = [
  [/(공급\s*가액|공급가)/, 'supply'],
  [/(부가세|부가가치세|VAT|세액)/i, 'vat'],
  [/(할인|쿠폰\s*사용|적립금\s*사용|포인트\s*사용)/, 'discount'],
  [/(결제\s*금액|받을\s*금액|승인\s*금액|실\s*결제|최종\s*결제|카드\s*결제)/, 'paid'],
  [/(합\s*계|총\s*액|총\s*금액|총\s*결제|TOTAL)/i, 'total'],
  [/(정가|판매가|가격|금액|단가|상품\s*금액)/, 'price'],
];

// Loose on purpose: "10,00원" (OCR-damaged grouping) is still found, then flagged by toMinor().
const GROUPED = String.raw`(?<![\d,])\d[\d,]*\d`;
const PLAIN = String.raw`(?<![\d,])\d`;

/** Parses "12,000" / "12000" / "10.99" into minor units; null when the grouping looks broken. */
export function toMinor(numberText: string, currency: Currency): { minor: number; wellFormed: boolean } | null {
  const decimals = CURRENCY_DECIMALS[currency];
  const [intPart, frac = ''] = numberText.split('.');
  const wellFormed = /^\d{1,3}(,\d{3})*$/.test(intPart) || /^\d+$/.test(intPart);
  const digits = intPart.replace(/,/g, '');
  if (!/^\d+$/.test(digits)) return null;
  if (frac && (decimals === 0 || frac.length > decimals)) return null;
  const minor = Number(digits) * 10 ** decimals + (frac ? Number(frac.padEnd(decimals, '0')) : 0);
  if (!Number.isSafeInteger(minor)) return null;
  return { minor, wellFormed };
}

/** "15000 KRW" → "15,000원", "1099 USD" → "$10.99" */
export function formatMoney(minor: number, currency: Currency): string {
  const decimals = CURRENCY_DECIMALS[currency];
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const major = Math.floor(abs / 10 ** decimals);
  const grouped = major.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (currency === 'KRW') return `${sign}${grouped}원`;
  if (currency === 'JPY') return `${sign}¥${grouped}`;
  const frac = (abs % 10 ** decimals).toString().padStart(decimals, '0');
  return `${sign}${currency === 'USD' ? '$' : '€'}${grouped}.${frac}`;
}

export function parseNormalizedMoney(value: string): { minor: number; currency: Currency } | null {
  const m = /^(-?\d+) (KRW|USD|EUR|JPY)$/.exec(value);
  return m ? { minor: Number(m[1]), currency: m[2] as Currency } : null;
}

function roleFor(before: string, negative: boolean): MoneyRole {
  for (const [re, role] of ROLE_RULES) if (re.test(before)) return role;
  return negative ? 'discount' : 'unknown';
}

/** Finds money amounts per line; the label before the number decides its role (합계/부가세/할인...). */
export function parseMoney(text: string): MoneyCandidate[] {
  const out: MoneyCandidate[] = [];
  for (const { line } of linesWithOffsets(text)) {
    const taken: [number, number][] = [];
    const found: { start: number; end: number; num: string; currency: Currency; negative: boolean; scale?: number }[] = [];
    const add = (start: number, end: number, num: string, currency: Currency, negative: boolean, scale?: number) => {
      if (taken.some(([a, b]) => start < b && end > a)) return;
      taken.push([start, end]);
      found.push({ start, end, num, currency, negative, scale });
    };
    let m: RegExpExecArray | null;

    // 3만원 / 1.5만 원
    const man = /(-)?\s*(\d+(?:\.\d)?)\s*만\s*원/g;
    while ((m = man.exec(line))) add(m.index, m.index + m[0].length, m[2], 'KRW', !!m[1], 10_000);
    // ₩12,000 / KRW 12000 (optionally followed by 원)
    const krwPrefix = new RegExp(String.raw`(-)?\s*(?:₩|￦|KRW)\s*(${GROUPED}|${PLAIN})(?:\s*원)?`, 'g');
    while ((m = krwPrefix.exec(line))) add(m.index, m.index + m[0].length, m[2], 'KRW', !!m[1]);
    // 12,000원
    const krwSuffix = new RegExp(String.raw`(-)?\s*(${GROUPED}|${PLAIN})\s*원`, 'g');
    while ((m = krwSuffix.exec(line))) add(m.index, m.index + m[0].length, m[2], 'KRW', !!m[1]);
    // $10.99 / US$ 1,200.50
    const usdPrefix = new RegExp(String.raw`(-)?\s*(?:US)?\$\s*((?:${GROUPED}|${PLAIN})(?:\.\d{1,2})?)`, 'g');
    while ((m = usdPrefix.exec(line))) add(m.index, m.index + m[0].length, m[2], 'USD', !!m[1]);
    // 10.99 USD / 20 EUR / 1,000 JPY
    const codeSuffix = new RegExp(String.raw`(-)?\s*((?:${GROUPED}|${PLAIN})(?:\.\d{1,2})?)\s*(USD|EUR|JPY)\b`, 'g');
    while ((m = codeSuffix.exec(line))) add(m.index, m.index + m[0].length, m[2], m[3] as Currency, !!m[1]);

    found.sort((a, b) => a.start - b.start);
    let prevEnd = 0;
    for (const f of found) {
      const before = line.slice(prevEnd, f.start);
      prevEnd = f.end;
      let minor: number;
      let wellFormed = true;
      if (f.scale) {
        minor = Math.round(Number(f.num) * f.scale);
      } else {
        const parsed = toMinor(f.num, f.currency);
        if (!parsed) continue;
        minor = parsed.minor;
        wellFormed = parsed.wellFormed;
      }
      if (minor === 0) continue;
      const role = roleFor(before, f.negative);
      out.push({
        raw: line.slice(f.start, f.end).trim(),
        minor: f.negative ? -minor : minor,
        currency: f.currency,
        role,
        confidence: wellFormed ? (role === 'unknown' ? 'medium' : 'high') : 'low',
        evidence: line.trim(),
      });
    }
  }
  return out;
}
