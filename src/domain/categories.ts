import type { Category, DateRole, FieldType, MoneyRole } from './models';

export interface CategoryInfo {
  id: Category;
  label: string;
  /** Short label for chips and icon grids. */
  short: string;
  /** Ionicons name. */
  icon: string;
  /** Pastel tone name from design-system `categoryTones`. */
  tone: 'green' | 'orange' | 'blue' | 'purple' | 'pink' | 'teal' | 'yellow' | 'gray' | 'indigo';
}

export const CATEGORY_INFO: Record<Category, CategoryInfo> = {
  place: { id: 'place', label: '장소·식당', short: '장소', icon: 'location', tone: 'green' },
  shopping: { id: 'shopping', label: '쇼핑', short: '쇼핑', icon: 'bag-handle', tone: 'orange' },
  receipt: { id: 'receipt', label: '영수증', short: '영수증', icon: 'receipt', tone: 'teal' },
  coupon: { id: 'coupon', label: '쿠폰', short: '쿠폰', icon: 'pricetag', tone: 'purple' },
  reservation: { id: 'reservation', label: '예약', short: '예약', icon: 'calendar', tone: 'blue' },
  event: { id: 'event', label: '일정·행사', short: '일정', icon: 'megaphone', tone: 'pink' },
  ticket: { id: 'ticket', label: '티켓', short: '티켓', icon: 'ticket', tone: 'indigo' },
  warranty: { id: 'warranty', label: '보증서', short: '보증서', icon: 'shield-checkmark', tone: 'yellow' },
  document: { id: 'document', label: '문서', short: '문서', icon: 'document-text', tone: 'gray' },
  link: { id: 'link', label: '링크', short: '링크', icon: 'link', tone: 'indigo' },
  other: { id: 'other', label: '기타', short: '기타', icon: 'ellipsis-horizontal', tone: 'gray' },
};

/** Categories shown in the home icon grid and library tabs (the rest stay reachable via "기타"). */
export const PRIMARY_CATEGORIES: Category[] = ['place', 'shopping', 'coupon', 'reservation', 'event', 'receipt', 'ticket', 'warranty'];

export const DATE_ROLE_LABEL: Record<DateRole, string> = {
  expiry: '만료일',
  event: '행사일',
  reservation: '예약일',
  purchase: '구매일',
  order: '주문일',
  delivery: '배송 예정일',
  'return-deadline': '반품 마감',
  'warranty-end': '보증 만료일',
  issue: '발행일',
  start: '시작일',
  end: '종료일',
  unknown: '날짜',
};

export const MONEY_ROLE_LABEL: Record<MoneyRole, string> = {
  total: '합계',
  paid: '결제 금액',
  supply: '공급가액',
  vat: '부가세',
  discount: '할인',
  price: '가격',
  unknown: '금액',
};

export const FIELD_LABEL: Record<FieldType, string> = {
  title: '제목',
  url: '링크',
  domain: '도메인',
  date: '날짜',
  amount: '금액',
  merchant: '상호',
  address: '주소',
  phone: '전화번호',
  'coupon-code': '쿠폰 코드',
  'order-number': '주문번호',
  'reservation-number': '예약번호',
  'ticket-number': '티켓번호',
  'return-policy-text': '반품 조건 문구',
};

/** Fields that may be sensitive and are masked in lists/search results. */
export const SENSITIVE_FIELDS: ReadonlySet<FieldType> = new Set(['coupon-code', 'order-number', 'reservation-number', 'ticket-number', 'phone']);

export function fieldLabel(fieldType: FieldType, role: string | null): string {
  if (fieldType === 'date' && role) return DATE_ROLE_LABEL[role as DateRole] ?? FIELD_LABEL.date;
  if (fieldType === 'amount' && role) return MONEY_ROLE_LABEL[role as MoneyRole] ?? FIELD_LABEL.amount;
  return FIELD_LABEL[fieldType];
}

/** "AB12-CD34-EF56" → "AB12••••••••F56" — keeps enough to recognise, hides the rest. */
export function maskSensitive(value: string): string {
  if (value.length <= 4) return '••••';
  const head = value.slice(0, 2);
  const tail = value.slice(-2);
  return `${head}${'•'.repeat(Math.min(8, value.length - 4))}${tail}`;
}
