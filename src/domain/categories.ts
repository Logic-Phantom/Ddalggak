import type { Category, DateRole, FieldType, MoneyRole } from './models';

export interface CategoryInfo {
  id: Category;
  label: string;
  /** Ionicons name. */
  icon: string;
}

export const CATEGORY_INFO: Record<Category, CategoryInfo> = {
  place: { id: 'place', label: '장소·식당', icon: 'location-outline' },
  shopping: { id: 'shopping', label: '쇼핑', icon: 'bag-handle-outline' },
  receipt: { id: 'receipt', label: '영수증', icon: 'receipt-outline' },
  coupon: { id: 'coupon', label: '쿠폰', icon: 'pricetag-outline' },
  reservation: { id: 'reservation', label: '예약', icon: 'calendar-outline' },
  event: { id: 'event', label: '일정·행사', icon: 'megaphone-outline' },
  ticket: { id: 'ticket', label: '티켓', icon: 'ticket-outline' },
  warranty: { id: 'warranty', label: '보증서', icon: 'shield-checkmark-outline' },
  document: { id: 'document', label: '문서', icon: 'document-text-outline' },
  link: { id: 'link', label: '링크', icon: 'link-outline' },
  other: { id: 'other', label: '기타', icon: 'ellipsis-horizontal-circle-outline' },
};

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
