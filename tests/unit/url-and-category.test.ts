import { categoryHint, classify } from '@/features/extraction/category-classifier';
import { domainOf, extractUrls, isOpenableUrl, isPrivateHost, normalizeUrl } from '@/features/extraction/url-utils';

describe('url utils', () => {
  it('extracts URLs from chat text and trims trailing punctuation', () => {
    expect(extractUrls('여기 가보자 https://example.com/a?b=1. 좋아!')).toEqual(['https://example.com/a?b=1']);
    expect(extractUrls('(https://example.com/wiki/A_(B))')).toEqual(['https://example.com/wiki/A_(B)']);
    expect(extractUrls('javascript:alert(1) ftp://x.y')).toEqual([]);
  });

  it('normalizes for duplicate detection', () => {
    expect(normalizeUrl('HTTPS://www.Example.com:443/path/?utm_source=kakao&id=3#top')).toBe('https://example.com/path?id=3');
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
    expect(normalizeUrl('https://example.com/a?fbclid=x')).toBe(normalizeUrl('https://example.com/a'));
  });

  it('only opens http(s) and flags private hosts', () => {
    expect(isOpenableUrl('https://a.com')).toBe(true);
    expect(isOpenableUrl('intent://x')).toBe(false);
    expect(isPrivateHost('http://192.168.0.1/admin')).toBe(true);
    expect(isPrivateHost('http://localhost:3000')).toBe(true);
    expect(isPrivateHost('https://a.com')).toBe(false);
  });

  it('derives the domain without www', () => {
    expect(domainOf('https://www.coupang.com/vp/products/1')).toBe('coupang.com');
  });
});

describe('category classifier', () => {
  it('suggests coupon for coupon wording + code', () => {
    const [top] = classify({ text: '모바일 교환권 쿠폰번호 1234 유효기간 2026.10.31', fieldSignals: ['coupon-code', 'date:expiry'] });
    expect(top.category).toBe('coupon');
    expect(top.confidence).toBe('high');
    expect(categoryHint(top)).toBe('쿠폰일 가능성이 높아요');
  });

  it('uses domains as hints', () => {
    expect(classify({ text: '', domain: 'map.naver.com' })[0].category).toBe('place');
    expect(classify({ text: '', domain: 'coupang.com' })[0].category).toBe('shopping');
  });

  it('suggests receipt from VAT/total signals', () => {
    expect(classify({ text: '영수증 합계 부가세', fieldSignals: ['amount:vat', 'amount:total'] })[0].category).toBe('receipt');
  });

  it('falls back to link/other with unknown confidence', () => {
    expect(classify({ text: 'ㅋㅋ', domain: 'blog.example.com' })[0]).toMatchObject({ category: 'link', confidence: 'unknown' });
    expect(classify({ text: 'ㅋㅋ' })[0]).toMatchObject({ category: 'other', confidence: 'unknown' });
    expect(categoryHint(classify({ text: '' })[0])).toBe('분류를 확신할 수 없어요');
  });
});
