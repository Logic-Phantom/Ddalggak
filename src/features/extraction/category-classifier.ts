import { CATEGORY_INFO } from '@/domain/categories';
import type { Category, ConfidenceLevel, FieldType } from '@/domain/models';

export interface CategoryCandidate {
  category: Category;
  score: number;
  confidence: ConfidenceLevel;
  /** Matched keywords/domains, shown as "왜 이렇게 분류했나요?" evidence. */
  reasons: string[];
}

export interface ClassifyInput {
  text: string;
  domain?: string | null;
  mimeType?: string | null;
  /** Field types already extracted with their roles, e.g. "amount:vat", "coupon-code". */
  fieldSignals?: string[];
}

const KEYWORDS: Partial<Record<Category, RegExp[]>> = {
  place: [/맛집/, /식당/, /카페/, /메뉴/, /영업\s*시간/, /브레이크\s*타임/, /길\s*찾기/, /지도/, /위치/, /주차/, /\brestaurant\b/i, /\bcafe\b/i],
  shopping: [/상품/, /장바구니/, /구매하기/, /품절/, /최저가/, /무료\s*배송/, /배송/, /주문/, /옵션/, /판매가/, /\bfree shipping\b/i, /\badd to cart\b/i],
  receipt: [/영수증/, /합\s*계/, /부가세/, /공급\s*가액/, /승인\s*번호/, /카드\s*번호/, /사업자\s*(등록)?\s*번호/, /가맹점/, /결제\s*금액/, /거래\s*일시/, /\breceipt\b/i, /\bsubtotal\b/i],
  coupon: [/쿠폰/, /교환권/, /기프티콘/, /모바일\s*상품권/, /유효\s*기간/, /사용\s*기한/, /프로모션\s*코드/, /할인\s*코드/, /\bcoupon\b/i, /\bvoucher\b/i, /\bpromo\s*code\b/i],
  reservation: [/예약/, /체크인/, /체크아웃/, /입실/, /퇴실/, /예약자/, /인원/, /booking/i, /\breservation\b/i, /\bcheck-?in\b/i],
  event: [/행사/, /전시/, /공연/, /축제/, /박람회/, /세미나/, /모집/, /참가/, /신청/, /일시/, /\bconcert\b/i, /\bfestival\b/i, /\bexhibition\b/i],
  ticket: [/티켓/, /입장권/, /승차권/, /탑승권/, /좌석/, /게이트/, /예매/, /관람/, /\btickets?\b/i, /\bboarding pass\b/i],
  warranty: [/보증서/, /품질\s*보증/, /보증\s*기간/, /무상\s*(수리|A\/S)/, /제품\s*등록/, /시리얼/, /S\/N/, /모델명/],
  document: [/안내문/, /공지/, /신청서/, /증명서/, /계약서/, /고지서/, /청구서/],
};

/** Domain hints are strong but still only suggestions (e.g. a map link may be a shop, not a place). */
const DOMAINS: [RegExp, Category][] = [
  [/(^|\.)map\.naver\.com$|(^|\.)map\.kakao\.com$|(^|\.)place\.map\.kakao\.com$|(^|\.)maps\.app\.goo\.gl$|(^|\.)maps\.google\.[a-z.]+$|(^|\.)catchtable\.co\.kr$|(^|\.)diningcode\.com$|(^|\.)siksinhot\.com$/, 'place'],
  [/(^|\.)coupang\.com$|(^|\.)smartstore\.naver\.com$|(^|\.)brand\.naver\.com$|(^|\.)11st\.co\.kr$|(^|\.)gmarket\.co\.kr$|(^|\.)auction\.co\.kr$|(^|\.)musinsa\.com$|(^|\.)kurly\.com$|(^|\.)ssg\.com$|(^|\.)29cm\.co\.kr$|(^|\.)ohou\.se$|(^|\.)a-bly\.com$|(^|\.)zigzag\.kr$|(^|\.)amazon\.[a-z.]+$|(^|\.)aliexpress\.com$/, 'shopping'],
  [/(^|\.)yanolja\.com$|(^|\.)yeogi\.com$|(^|\.)goodchoice\.kr$|(^|\.)airbnb\.[a-z.]+$|(^|\.)booking\.com$|(^|\.)agoda\.com$|(^|\.)tablenote\.co\.kr$/, 'reservation'],
  [/(^|\.)ticket\.interpark\.com$|(^|\.)tickets\.interpark\.com$|(^|\.)ticket\.yes24\.com$|(^|\.)ticket\.melon\.com$|(^|\.)letskorail\.com$|(^|\.)srail\.or\.kr$/, 'ticket'],
  [/(^|\.)festa\.io$|(^|\.)onoffmix\.com$|(^|\.)eventus\.io$/, 'event'],
];

const FIELD_SIGNALS: [string, Category, number][] = [
  ['amount:vat', 'receipt', 2],
  ['amount:supply', 'receipt', 2],
  ['amount:total', 'receipt', 1],
  ['coupon-code', 'coupon', 3],
  ['date:expiry', 'coupon', 1],
  ['reservation-number', 'reservation', 3],
  ['date:reservation', 'reservation', 1],
  ['ticket-number', 'ticket', 3],
  ['order-number', 'shopping', 2],
  ['date:warranty-end', 'warranty', 2],
  ['address', 'place', 1],
  ['date:event', 'event', 1],
];

/**
 * Rule-based category suggestions, highest score first. The result is a candidate list —
 * the UI presents the top one as "~일 가능성이 높아요" and lets the user change it.
 */
export function classify(input: ClassifyInput): CategoryCandidate[] {
  const scores = new Map<Category, { score: number; reasons: string[] }>();
  const bump = (c: Category, n: number, reason: string) => {
    const cur = scores.get(c) ?? { score: 0, reasons: [] };
    cur.score += n;
    if (!cur.reasons.includes(reason)) cur.reasons.push(reason);
    scores.set(c, cur);
  };

  for (const [category, patterns] of Object.entries(KEYWORDS) as [Category, RegExp[]][]) {
    let hits = 0;
    for (const re of patterns) {
      const m = re.exec(input.text);
      if (m && hits < 4) {
        hits++;
        bump(category, 1, `"${m[0]}"`);
      }
    }
  }
  if (input.domain) {
    for (const [re, category] of DOMAINS) if (re.test(input.domain)) bump(category, 3, input.domain);
  }
  for (const signal of input.fieldSignals ?? []) {
    for (const [s, category, n] of FIELD_SIGNALS) if (s === signal) bump(category, n, `${signal} 항목`);
  }
  if (input.mimeType === 'application/pdf') bump('document', 1, 'PDF 문서');

  const ranked = Array.from(scores, ([category, v]) => ({ category, ...v })).sort((a, b) => b.score - a.score);
  if (!ranked.length) {
    const fallback: Category = input.domain ? 'link' : 'other';
    return [{ category: fallback, score: 0, confidence: 'unknown', reasons: [] }];
  }
  return ranked.map((r, i) => {
    const next = ranked[i + 1]?.score ?? 0;
    const margin = r.score - next;
    const confidence: ConfidenceLevel = r.score >= 4 && margin >= 2 ? 'high' : r.score >= 2 ? 'medium' : 'low';
    return { category: r.category, score: r.score, confidence, reasons: r.reasons };
  });
}

/** "쿠폰일 가능성이 높아요" — never phrased as a fact. */
export function categoryHint(c: CategoryCandidate): string {
  const label = CATEGORY_INFO[c.category].label;
  if (c.confidence === 'high') return `${label}일 가능성이 높아요`;
  if (c.confidence === 'medium' || c.confidence === 'low') return `${label}일 수도 있어요`;
  return '분류를 확신할 수 없어요';
}

export function fieldSignal(fieldType: FieldType, role: string | null): string {
  return role ? `${fieldType}:${role}` : fieldType;
}
