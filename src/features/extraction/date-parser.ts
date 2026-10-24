import type { ConfidenceLevel, DateRole } from '@/domain/models';
import { addDays, isValidYmd, pad2, toYmd, ymd } from '@/utils/dates';

import { linesWithOffsets } from '../ocr/text-normalizer';

export interface DateCandidate {
  /** Exact matched text (date plus attached time, if any). */
  raw: string;
  /** `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm` (local wall clock). */
  value: string;
  role: DateRole;
  yearInferred: boolean;
  /** Two readings are plausible (e.g. "03/04"). */
  ambiguous: boolean;
  /** Relative to the capture day ("내일", "D-7") — may not match when the message was written. */
  relative: boolean;
  confidence: ConfidenceLevel;
  /** The source line, used as evidence in the review UI. */
  evidence: string;
}

export interface DateParseOptions {
  today: Date;
}

const WEEKDAY_CHARS = '일월화수목금토';

// Keyword → role, checked against the text between the previous date (or line start) and this one.
// Order matters: more specific meanings first.
const ROLE_RULES: [RegExp, DateRole][] = [
  [/(반품|교환(?!권)|환불)/, 'return-deadline'],
  [/(보증\s*기간|품질\s*보증|보증\s*만료|무상\s*(수리|A\/S))/, 'warranty-end'],
  [/(유효\s*기간|유효기한|만료|사용\s*기한|사용\s*기간|사용\s*가능\s*기간|기한|valid\s+(?:until|thru|through)|expir(?:es|y|ation)|\bexp\b)/i, 'expiry'],
  [/(예약|체크인|체크아웃|입실|퇴실|이용\s*일|탑승|출발|도착\s*시각|reservation|booking|check-?in|check-?out|departure)/i, 'reservation'],
  [/(주문|order\s*date)/i, 'order'],
  [/(구매|구입|결제|거래\s*일시|거래일|승인\s*일시)/, 'purchase'],
  [/(배송|도착\s*예정|수령)/, 'delivery'],
  [/(발행|발급|작성일)/, 'issue'],
  [/(행사|일시|공연|전시|모임|개최|일정|축제|세미나|concert|event|show|festival)/i, 'event'],
];

interface RawMatch {
  start: number;
  end: number;
  y: number | null;
  m: number;
  d: number;
  yearInferred: boolean;
  twoDigitYear: boolean;
  ambiguous: boolean;
  relative: boolean;
}

function overlaps(taken: [number, number][], s: number, e: number): boolean {
  return taken.some(([a, b]) => s < b && e > a);
}

/** Picks a year for a month/day without one: this year, or next year if that date is long past. */
function inferYear(m: number, d: number, today: Date): number {
  const y = today.getFullYear();
  const candidate = new Date(y, m - 1, d);
  const sixtyDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 60);
  return candidate < sixtyDaysAgo ? y + 1 : y;
}

function findRawDates(line: string, today: Date): RawMatch[] {
  const taken: [number, number][] = [];
  const out: RawMatch[] = [];
  const push = (r: RawMatch) => {
    if (overlaps(taken, r.start, r.end)) return;
    taken.push([r.start, r.end]);
    out.push(r);
  };
  let m: RegExpExecArray | null;

  // 2026년 10월 17일
  const fullKo = /(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/g;
  while ((m = fullKo.exec(line))) push({ start: m.index, end: m.index + m[0].length, y: +m[1], m: +m[2], d: +m[3], yearInferred: false, twoDigitYear: false, ambiguous: false, relative: false });

  // 2026.10.17 / 2026-10-17 / 2026/10/17
  const fullNum = /(?<!\d)(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})(?!\d)\.?/g;
  while ((m = fullNum.exec(line))) push({ start: m.index, end: m.index + m[0].length, y: +m[1], m: +m[2], d: +m[3], yearInferred: false, twoDigitYear: false, ambiguous: false, relative: false });

  // 26.10.17 (two-digit year, common on receipts)
  const shortYear = /(?<![\d.])(\d{2})\.(\d{1,2})\.(\d{1,2})(?![\d.])/g;
  while ((m = shortYear.exec(line))) push({ start: m.index, end: m.index + m[0].length, y: 2000 + +m[1], m: +m[2], d: +m[3], yearInferred: false, twoDigitYear: true, ambiguous: false, relative: false });

  // 10월 17일
  const mdKo = /(?<!\d)(\d{1,2})\s*월\s*(\d{1,2})\s*일/g;
  while ((m = mdKo.exec(line))) push({ start: m.index, end: m.index + m[0].length, y: null, m: +m[1], d: +m[2], yearInferred: true, twoDigitYear: false, ambiguous: false, relative: false });

  // 10.17 / 10/17 — skipped when it looks like a decimal amount, rating, or version.
  const mdNum = /(?<![\d.\-/$₩:])(\d{1,2})([./])(\d{1,2})(?![\d.\-/:%])(?!\s*(?:USD|EUR|원|점|km|kg|g|ml|L|배|%))/g;
  while ((m = mdNum.exec(line))) {
    const a = +m[1];
    const b = +m[3];
    const slash = m[2] === '/';
    push({ start: m.index, end: m.index + m[0].length, y: null, m: a, d: b, yearInferred: true, twoDigitYear: false, ambiguous: slash && a <= 12 && b <= 12 && a !== b, relative: false });
  }

  // 오늘 / 내일 / 모레
  const rel = /(오늘|내일|모레)/g;
  while ((m = rel.exec(line))) {
    const offset = m[1] === '오늘' ? 0 : m[1] === '내일' ? 1 : 2;
    const [y, mo, d] = addDays(toYmd(today), offset).split('-').map(Number);
    push({ start: m.index, end: m.index + m[0].length, y, m: mo, d, yearInferred: false, twoDigitYear: false, ambiguous: false, relative: true });
  }

  // 이번 주 금요일 / 다음 주 월요일
  const week = /(이번|다음)\s*주\s*([월화수목금토일])요일/g;
  while ((m = week.exec(line))) {
    const target = WEEKDAY_CHARS.indexOf(m[2]);
    const mondayOffset = (today.getDay() + 6) % 7; // days since Monday
    const monday = addDays(toYmd(today), -mondayOffset);
    const dayIndex = (target + 6) % 7; // Monday = 0
    const date = addDays(monday, dayIndex + (m[1] === '다음' ? 7 : 0));
    const [y, mo, d] = date.split('-').map(Number);
    push({ start: m.index, end: m.index + m[0].length, y, m: mo, d, yearInferred: false, twoDigitYear: false, ambiguous: false, relative: true });
  }

  // D-7 (deadline countdown relative to the capture day)
  const dday = /(?<![A-Za-z])D\s*-\s*(\d{1,3})(?!\d)/g;
  while ((m = dday.exec(line))) {
    const [y, mo, d] = addDays(toYmd(today), +m[1]).split('-').map(Number);
    push({ start: m.index, end: m.index + m[0].length, y, m: mo, d, yearInferred: false, twoDigitYear: false, ambiguous: false, relative: true });
  }

  return out.sort((a, b) => a.start - b.start);
}

/** Time attached right after a date: "18:00", "오후 7시", "오전 10시 30분", "(토) 19:30". */
function attachedTime(rest: string): { hh: number; mm: number; length: number } | null {
  const m = /^\s*(?:\([월화수목금토일]\)\s*)?(?:[월화수목금토일]요일\s*)?(오전|오후|AM|PM|am|pm)?\s*(\d{1,2})\s*(?::\s*(\d{2})|시(?:\s*(\d{1,2})\s*분|\s*반)?)/.exec(rest);
  if (!m) return null;
  let hh = +m[2];
  const mm = m[3] != null ? +m[3] : m[4] != null ? +m[4] : /반$/.test(m[0]) ? 30 : 0;
  const meridiem = m[1]?.toLowerCase();
  if (meridiem === '오후' || meridiem === 'pm') {
    if (hh < 12) hh += 12;
  } else if ((meridiem === '오전' || meridiem === 'am') && hh === 12) {
    hh = 0;
  }
  if (hh > 23 || mm > 59) return null;
  return { hh, mm, length: m[0].length };
}

/** Weekday written next to the date, e.g. "10월 17일 (토)". Returns 0–6 (Sun–Sat) or null. */
function attachedWeekday(rest: string): number | null {
  const m = /^\s*\(?\s*([월화수목금토일])(?:요일)?\s*\)?/.exec(rest);
  return m ? WEEKDAY_CHARS.indexOf(m[1]) : null;
}

/** The label closest to the date wins ("교환권 … 유효기간 2026.12.31" → expiry). Ties keep rule order. */
function nearestRole(before: string): DateRole | null {
  let best: { pos: number; role: DateRole } | null = null;
  for (const [re, role] of ROLE_RULES) {
    const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    let m: RegExpExecArray | null;
    let last = -1;
    while ((m = global.exec(before))) last = m.index + m[0].length;
    if (last >= 0 && (!best || last > best.pos)) best = { pos: last, role };
  }
  return best?.role ?? null;
}

function roleFor(before: string, after: string): DateRole {
  const near = nearestRole(before);
  if (near) return near;
  const untilAfter = /^\s*(까지|이내)/.test(after);
  const tildeBefore = /~\s*$/.test(before);
  if (untilAfter || tildeBefore) return 'end';
  if (/^\s*~/.test(after) || /^\s*부터/.test(after)) return 'start';
  return 'unknown';
}

/**
 * Finds date candidates in normalized text. Every candidate keeps its source line as evidence;
 * nothing here decides which date is "the" deadline — the user confirms that in the review screen.
 */
export function parseDates(text: string, { today }: DateParseOptions): DateCandidate[] {
  const results: DateCandidate[] = [];
  for (const { line } of linesWithOffsets(text)) {
    const raws = findRawDates(line, today);
    let prevEnd = 0;
    for (const r of raws) {
      const year = r.y ?? inferYear(r.m, r.d, today);
      if (!isValidYmd(year, r.m, r.d)) {
        prevEnd = r.end;
        continue;
      }
      const rest = line.slice(r.end);
      const time = attachedTime(rest);
      const end = r.end + (time?.length ?? 0);
      const before = line.slice(prevEnd, r.start);
      const after = line.slice(end);
      let role = roleFor(before, after);
      // A range end ("~10.31") inside an expiry/event line inherits the line's meaning.
      if (role === 'end' || role === 'start') {
        const lineRole = nearestRole(line.slice(0, r.start));
        if (lineRole === 'expiry' && role === 'end') role = 'expiry';
      }
      const weekday = attachedWeekday(rest);
      const date = ymd(year, r.m, r.d);
      const weekdayMatches = weekday == null ? null : new Date(year, r.m - 1, r.d).getDay() === weekday;

      let confidence: ConfidenceLevel;
      if (r.relative || r.ambiguous) confidence = 'low';
      else if (r.yearInferred) confidence = weekdayMatches ? 'medium' : 'low';
      else if (r.twoDigitYear) confidence = 'medium';
      else confidence = 'high';
      if (weekdayMatches === false) confidence = 'low';

      results.push({
        raw: line.slice(r.start, end).trim(),
        value: time ? `${date}T${pad2(time.hh)}:${pad2(time.mm)}` : date,
        role,
        yearInferred: r.yearInferred,
        ambiguous: r.ambiguous || weekdayMatches === false,
        relative: r.relative,
        confidence,
        evidence: line.trim(),
      });
      prevEnd = end;
    }
  }
  return results;
}

/**
 * "구매 후 7일 이내 반품" style phrases. The deadline depends on a base date (purchase/receipt)
 * and seller policy, so it is returned as text only — never turned into a date automatically.
 */
export function findReturnPolicyPhrases(text: string): { raw: string; days: number }[] {
  const out: { raw: string; days: number }[] = [];
  const re = /(?:(반품|교환|환불)[^\n]{0,15}?(\d{1,3})\s*일\s*(?:이내|안에|내|까지))|(?:(\d{1,3})\s*일\s*(?:이내|안에|내)[^\n]{0,10}?(반품|교환|환불))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push({ raw: m[0].trim(), days: Number(m[2] ?? m[3]) });
  return out;
}
