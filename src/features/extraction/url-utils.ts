/**
 * URL helpers implemented with string parsing (no fetch, no WHATWG URL dependency).
 * Shared URLs are stored as-is for the user; normalized forms are only used for duplicate checks.
 */

const URL_RE = /https?:\/\/[^\s<>"'`{}|\\^]+/gi;
const TRAILING_PUNCT = /[.,;:!?'"」』》〉)\]}]+$/;

export interface ParsedUrl {
  scheme: string;
  host: string;
  port: string | null;
  path: string;
  query: string;
  hash: string;
}

export function parseUrl(input: string): ParsedUrl | null {
  const m = /^([a-z][a-z0-9+.-]*):\/\/(?:[^@/?#\s]*@)?(\[[^\]]+\]|[^:/?#\s]+)(?::(\d+))?([^?#\s]*)(\?[^#\s]*)?(#\S*)?$/i.exec(input.trim());
  if (!m) return null;
  return { scheme: m[1].toLowerCase(), host: m[2].toLowerCase(), port: m[3] ?? null, path: m[4] || '/', query: m[5] ?? '', hash: m[6] ?? '' };
}

/** Finds http(s) URLs in free text; strips trailing punctuation unless it balances a "(". */
export function extractUrls(text: string): string[] {
  const out: string[] = [];
  for (const match of text.match(URL_RE) ?? []) {
    let url = match;
    while (TRAILING_PUNCT.test(url)) {
      const last = url[url.length - 1];
      if (last === ')' && (url.match(/\(/g)?.length ?? 0) >= (url.match(/\)/g)?.length ?? 0)) break;
      url = url.slice(0, -1);
    }
    if (parseUrl(url) && !out.includes(url)) out.push(url);
  }
  return out;
}

export function isHttpUrl(input: string): boolean {
  const p = parseUrl(input);
  return !!p && (p.scheme === 'http' || p.scheme === 'https');
}

/** Only http(s) links are ever handed to the OS browser. */
export const isOpenableUrl = isHttpUrl;

export function domainOf(input: string): string | null {
  const p = parseUrl(input);
  if (!p) return null;
  return p.host.replace(/^www\./, '');
}

/** localhost / private ranges: shown with a warning and never auto-opened. */
export function isPrivateHost(input: string): boolean {
  const host = parseUrl(input)?.host;
  if (!host) return false;
  if (host === 'localhost' || host.endsWith('.local') || host === '[::1]') return true;
  const ip = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!ip) return false;
  const [a, b] = [Number(ip[1]), Number(ip[2])];
  return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
}

const TRACKING_PARAMS = /^(utm_[a-z]+|fbclid|gclid|igshid|mc_cid|mc_eid|_hsenc|_hsmi|si|ref_src)$/i;

/** Canonical form for duplicate detection: lower-case host, no default port/tracking params/fragment. */
export function normalizeUrl(input: string): string | null {
  const p = parseUrl(input);
  if (!p) return null;
  const defaultPort = (p.scheme === 'http' && p.port === '80') || (p.scheme === 'https' && p.port === '443');
  const port = p.port && !defaultPort ? `:${p.port}` : '';
  const host = p.host.replace(/^www\./, '');
  let path = p.path.replace(/\/{2,}/g, '/');
  if (path.length > 1) path = path.replace(/\/$/, '');
  const params = p.query
    .replace(/^\?/, '')
    .split('&')
    .filter((kv) => kv && !TRACKING_PARAMS.test(kv.split('=')[0]));
  const query = params.length ? `?${params.join('&')}` : '';
  return `${p.scheme}://${host}${port}${path}${query}`;
}

/** Text without its URLs (used to tell "URL only" shares from messages that contain a URL). */
export function stripUrls(text: string): string {
  return text.replace(URL_RE, '').replace(/[ \t]+/g, ' ').trim();
}
