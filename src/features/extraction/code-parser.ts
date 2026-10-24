import type { ConfidenceLevel, FieldType } from '@/domain/models';

import { linesWithOffsets } from '../ocr/text-normalizer';

export interface LabeledCandidate {
  fieldType: FieldType;
  value: string;
  raw: string;
  confidence: ConfidenceLevel;
  evidence: string;
}

/**
 * Labels that must never be extracted: one-time codes and secrets. Even if a user shares a
 * screenshot that contains one, it is not copied into a field (it stays only in OCR text).
 */
const NEVER_EXTRACT = /(인증\s*번호|인증\s*코드|OTP|비밀\s*번호|비번|PIN|보안\s*코드|CVC|CVV)/i;

const CODE = String.raw`([A-Za-z0-9][A-Za-z0-9\-]{3,29})`;

const CODE_RULES: [RegExp, FieldType][] = [
  [new RegExp(String.raw`(쿠폰\s*(?:번호|코드)|프로모션\s*코드|할인\s*코드|교환\s*번호|상품권\s*번호|바코드\s*번호)\s*[:：]?\s*${CODE}`, 'g'), 'coupon-code'],
  [new RegExp(String.raw`(주문\s*번호|Order\s*(?:No\.?|Number|#))\s*[:：#]?\s*${CODE}`, 'gi'), 'order-number'],
  [new RegExp(String.raw`(예약\s*번호|예약\s*코드|예약\s*확인\s*번호|Booking\s*(?:No\.?|ID|Number)|Confirmation\s*(?:No\.?|Number))\s*[:：#]?\s*${CODE}`, 'gi'), 'reservation-number'],
  [new RegExp(String.raw`(티켓\s*번호|예매\s*번호|승차권\s*번호)\s*[:：#]?\s*${CODE}`, 'g'), 'ticket-number'],
];

/** Coupon / order / reservation / ticket numbers that follow an explicit label. */
export function parseCodes(text: string): LabeledCandidate[] {
  const out: LabeledCandidate[] = [];
  for (const { line } of linesWithOffsets(text)) {
    if (NEVER_EXTRACT.test(line)) continue;
    for (const [re, fieldType] of CODE_RULES) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(line))) {
        const value = m[2];
        // A real code has at least one digit; this avoids catching words after the label.
        if (!/\d/.test(value)) continue;
        out.push({ fieldType, value, raw: m[0], confidence: 'medium', evidence: line.trim() });
      }
    }
  }
  return out;
}

/** Korean phone numbers with explicit separators (bare digit runs are too often order numbers). */
export function parsePhones(text: string): LabeledCandidate[] {
  const out: LabeledCandidate[] = [];
  for (const { line } of linesWithOffsets(text)) {
    if (NEVER_EXTRACT.test(line)) continue;
    const re = /(?<![\d-])(0\d{1,2}[-.)\s]\d{3,4}[-.\s]\d{4}|1[5-9]\d{2}-\d{4})(?![\d-])/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      const value = m[1].replace(/[.)\s]/g, '-');
      out.push({ fieldType: 'phone', value, raw: m[1], confidence: 'medium', evidence: line.trim() });
    }
  }
  return out;
}

const REGION = '(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충청|충북|충남|전라|전북|전남|경상|경북|경남|제주)';

/** Road-name addresses ("서울 마포구 양화로 12"). Heuristic only — always needs confirmation. */
export function parseAddresses(text: string): LabeledCandidate[] {
  const out: LabeledCandidate[] = [];
  const re = new RegExp(String.raw`(${REGION}[가-힣]*\s+(?:[가-힣]+(?:시|군|구)\s+){1,2}[가-힣0-9\s]{0,20}?(?:로|길)\s*\d+(?:-\d+)?(?:\s*\d+층)?)`, 'g');
  for (const { line } of linesWithOffsets(text)) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) out.push({ fieldType: 'address', value: m[1].trim(), raw: m[1], confidence: 'low', evidence: line.trim() });
  }
  return out;
}

/** "상호: 딸깍상회" / "가맹점명 딸깍상회" */
export function parseMerchants(text: string): LabeledCandidate[] {
  const out: LabeledCandidate[] = [];
  for (const { line } of linesWithOffsets(text)) {
    const m = /^(?:상\s*호\s*명?|가맹점\s*명?|매장\s*명|판매자|업체\s*명)\s*[:：]?\s*(.{2,40})$/.exec(line.trim());
    if (m) out.push({ fieldType: 'merchant', value: m[1].trim(), raw: line.trim(), confidence: 'medium', evidence: line.trim() });
  }
  return out;
}
