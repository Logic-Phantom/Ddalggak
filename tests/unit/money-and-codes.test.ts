import { parseAddresses, parseCodes, parseMerchants, parsePhones } from '@/features/extraction/code-parser';
import { formatMoney, parseMoney, toMinor } from '@/features/extraction/money-parser';
import { normalizeText } from '@/features/ocr/text-normalizer';

describe('money parser', () => {
  it.each([
    ['1,000원', 1000, 'KRW'],
    ['₩10,000', 10000, 'KRW'],
    ['KRW 25000', 25000, 'KRW'],
    ['3만원', 30000, 'KRW'],
    ['1.5만 원', 15000, 'KRW'],
    ['10.99 USD', 1099, 'USD'],
    ['$1,200.5', 120050, 'USD'],
  ])('%s → %i %s', (input, minor, currency) => {
    const [m] = parseMoney(input);
    expect(m.minor).toBe(minor);
    expect(m.currency).toBe(currency);
  });

  it('does not double count "₩10,000원"', () => {
    expect(parseMoney('₩10,000원')).toHaveLength(1);
  });

  it('separates total, supply, VAT, discount and paid amounts on a receipt', () => {
    const text = normalizeText(['공급가액 9,091원', '부가세 909원', '합계 10,000원', '할인 -3,000원', '결제금액 7,000원'].join('\n'));
    const roles = parseMoney(text).map((m) => [m.role, m.minor]);
    expect(roles).toEqual([
      ['supply', 9091],
      ['vat', 909],
      ['total', 10000],
      ['discount', -3000],
      ['paid', 7000],
    ]);
  });

  it('treats a bare negative amount as a discount', () => {
    expect(parseMoney('-2,000원')[0].role).toBe('discount');
  });

  it('flags broken digit grouping as low confidence', () => {
    expect(toMinor('10,00', 'KRW')?.wellFormed).toBe(false);
    expect(parseMoney('합계 10,00원')[0].confidence).toBe('low');
  });

  it('formats minor units back without floating point drift', () => {
    expect(formatMoney(1099, 'USD')).toBe('$10.99');
    expect(formatMoney(15000, 'KRW')).toBe('15,000원');
    expect(formatMoney(-3000, 'KRW')).toBe('-3,000원');
  });
});

describe('labeled codes', () => {
  it('extracts coupon, order, reservation and ticket numbers by label', () => {
    const text = normalizeText(['쿠폰번호: AB12-CD34-EF56', '주문번호 20261017-0001234', '예약 번호 : R7788', '티켓번호 T-99812'].join('\n'));
    expect(parseCodes(text).map((c) => [c.fieldType, c.value])).toEqual([
      ['coupon-code', 'AB12-CD34-EF56'],
      ['order-number', '20261017-0001234'],
      ['reservation-number', 'R7788'],
      ['ticket-number', 'T-99812'],
    ]);
  });

  it('never extracts one-time codes or passwords', () => {
    expect(parseCodes('인증번호 482913 (쿠폰번호 아님)')).toHaveLength(0);
    expect(parseCodes('비밀번호: 1234abcd')).toHaveLength(0);
    expect(parsePhones('인증번호 010-1234-5678')).toHaveLength(0);
  });

  it('requires a digit in the code', () => {
    expect(parseCodes('쿠폰 코드 없음')).toHaveLength(0);
  });

  it('finds phone numbers only with separators', () => {
    expect(parsePhones('문의 02-123-4567, 1588-1234').map((p) => p.value)).toEqual(['02-123-4567', '1588-1234']);
    expect(parsePhones('주문번호 01012345678')).toHaveLength(0);
  });

  it('finds road-name addresses and labeled merchants', () => {
    expect(parseAddresses('주소: 서울 마포구 양화로 12 3층')[0].value).toBe('서울 마포구 양화로 12 3층');
    expect(parseMerchants('상호: 딸깍상회')[0].value).toBe('딸깍상회');
  });
});
