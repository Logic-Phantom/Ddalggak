/**
 * Local calendar helpers. Values are wall-clock strings without offsets:
 * date-only `YYYY-MM-DD`, date-time `YYYY-MM-DDTHH:mm`. They are interpreted in the device time zone.
 */

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function isValidYmd(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1) return false;
  return d <= daysInMonth(y, m);
}

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function ymd(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** Adds days in local calendar terms (DST-safe: works on y/m/d, not milliseconds). */
export function addDays(dateYmd: string, days: number): string {
  const [y, m, d] = dateYmd.split('-').map(Number);
  return toYmd(new Date(y, m - 1, d + days));
}

/** Parses `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm` into a local Date; null when invalid. */
export function parseLocal(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (!isValidYmd(y, mo, d)) return null;
  const h = m[4] != null ? Number(m[4]) : 0;
  const mi = m[5] != null ? Number(m[5]) : 0;
  if (h > 23 || mi > 59) return null;
  return new Date(y, mo - 1, d, h, mi, 0, 0);
}

/**
 * Parses what a user types into a date field: "2026-10-31", "2026.10.31", "2026/10/31 18:00".
 * Returns the normalized local value or null (no guessing of missing years here).
 */
export function parseUserDateInput(input: string): string | null {
  const m = /^\s*(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})\s*일?\s*(?:(\d{1,2})\s*[:시]\s*(\d{2})?\s*분?)?\s*$/.exec(input);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (!isValidYmd(y, mo, d)) return null;
  if (m[4] == null) return ymd(y, mo, d);
  const h = Number(m[4]);
  const mi = m[5] != null ? Number(m[5]) : 0;
  if (h > 23 || mi > 59) return null;
  return `${ymd(y, mo, d)}T${pad2(h)}:${pad2(mi)}`;
}

/** "2026-10-31T18:00" → "2026-10-31 18:00" (editable form). */
export function toInputValue(value: string | null | undefined): string {
  return value ? value.replace('T', ' ') : '';
}

export function hasTime(value: string): boolean {
  return /T\d{2}:\d{2}$/.test(value);
}

/** Whole calendar days from `from` to `to` (both local dates). */
export function diffDays(fromYmd: string, toYmdValue: string): number {
  const a = parseLocal(fromYmd.slice(0, 10));
  const b = parseLocal(toYmdValue.slice(0, 10));
  if (!a || !b) return NaN;
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86_400_000);
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** "2026.10.31 (토)" / "2026.10.31 (토) 18:00" */
export function formatLocal(value: string | null | undefined): string {
  if (!value) return '';
  const d = parseLocal(value);
  if (!d) return value;
  const base = `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())} (${WEEKDAYS[d.getDay()]})`;
  return hasTime(value) ? `${base} ${pad2(d.getHours())}:${pad2(d.getMinutes())}` : base;
}

/** "D-3", "D-day", "2일 지남" relative to today. */
export function dDayLabel(value: string, today: Date = new Date()): string {
  const n = diffDays(toYmd(today), value);
  if (Number.isNaN(n)) return '';
  if (n === 0) return 'D-day';
  if (n > 0) return `D-${n}`;
  return `${-n}일 지남`;
}

export function formatIsoDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
}

export function formatBytes(n: number | null | undefined): string {
  if (n == null) return '알 수 없음';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
