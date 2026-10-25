import { CATEGORIES, type Category, type ExtractedField, type InboxItem, type ItemStatus, type Reminder } from '@/domain/models';
import { parseLocal } from '@/utils/dates';

import { ACCEPTED_FILE_MIME_TYPES, MAX_FILE_BYTES } from '../incoming-share/mime-validation';

export const ARCHIVE_FORMAT = 'ddalggak-export';
export const ARCHIVE_SCHEMA_VERSION = 2;
export const MAX_IMPORT_ITEMS = 5000;
/** Whole-file cap. A v2 backup carries at most MAX_EXPORT_ATTACHMENT_BYTES of files as base64 (×4/3). */
export const MAX_IMPORT_BYTES = 48 * 1024 * 1024;
/**
 * Total original-file bytes embedded in one backup. The whole JSON is parsed in memory on import,
 * so this stays well below what a phone's JS heap handles comfortably (docs/DECISIONS.md D-018).
 */
export const MAX_EXPORT_ATTACHMENT_BYTES = 30 * 1024 * 1024;

/** Ids become folder/file names on import: letters, digits, _ and - only (no paths). */
export const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

export type ExcludedReason = 'too-large' | 'budget' | 'missing';

export interface ArchiveAttachment {
  id: string;
  originalName: string | null;
  mimeType: string;
  sizeBytes: number;
  /** Lowercase hex SHA-256 of the original bytes (integrity check on import). */
  sha256: string | null;
  createdAt: string;
  /** Base64 file content; null when the file was left out (see excludedReason). */
  data: string | null;
  excludedReason?: ExcludedReason;
}

export interface ArchiveItem extends Omit<InboxItem, 'schemaVersion'> {
  fields: Omit<ExtractedField, 'itemId'>[];
  /** Reminders are exported for reference; on import they come back switched off (no OS schedule). */
  reminders: Omit<Reminder, 'itemId' | 'notificationId'>[];
  /** v2 only. */
  attachments?: ArchiveAttachment[];
}

/**
 * Versioned JSON backup.
 * - v1: data only (`attachmentsIncluded: false`).
 * - v2: same items + optional embedded attachments with size and SHA-256. Older v1 files still import.
 */
export interface Archive {
  format: typeof ARCHIVE_FORMAT;
  schemaVersion: 1 | 2;
  exportedAt: string;
  attachmentsIncluded: boolean;
  items: ArchiveItem[];
}
/** @deprecated name kept for older call sites. */
export type ArchiveV1 = Archive;

const STATUSES: ItemStatus[] = ['draft', 'pending', 'active', 'completed', 'archived'];

function isStr(v: unknown, max = 100_000): v is string {
  return typeof v === 'string' && v.length <= max;
}
function isOptStr(v: unknown, max = 100_000): v is string | null {
  return v === null || isStr(v, max);
}

/** Decoded byte length of a base64 string (without decoding it). */
export function base64ByteLength(b64: string): number {
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return (b64.length / 4) * 3 - pad;
}

function validateAttachments(list: unknown, at: string, errors: string[]): void {
  if (list === undefined) return;
  if (!Array.isArray(list)) {
    errors.push(`${at}: 첨부 목록 형식이 올바르지 않아요.`);
    return;
  }
  const seen = new Set<string>();
  for (const raw of list as Record<string, unknown>[]) {
    const ok =
      isStr(raw?.id, 64) &&
      SAFE_ID.test(raw.id) &&
      !seen.has(raw.id) &&
      isStr(raw.mimeType, 100) &&
      ACCEPTED_FILE_MIME_TYPES.includes(raw.mimeType) &&
      typeof raw.sizeBytes === 'number' &&
      Number.isInteger(raw.sizeBytes) &&
      raw.sizeBytes >= 0 &&
      raw.sizeBytes <= MAX_FILE_BYTES &&
      isOptStr(raw.originalName, 200) &&
      (raw.sha256 === null || (isStr(raw.sha256, 64) && SHA256.test(raw.sha256)));
    if (!ok) {
      errors.push(`${at}: 첨부 정보가 올바르지 않아요.`);
      return;
    }
    seen.add(raw.id as string);
    if (raw.data === null) continue;
    if (!isStr(raw.data, Math.ceil((MAX_FILE_BYTES * 4) / 3) + 4) || raw.data.length % 4 !== 0 || !BASE64.test(raw.data) || raw.sha256 === null) {
      errors.push(`${at}: 첨부 파일 내용이 손상됐어요.`);
      return;
    }
    if (base64ByteLength(raw.data) !== raw.sizeBytes) {
      errors.push(`${at}: 첨부 파일 크기가 맞지 않아요.`);
      return;
    }
  }
}

/** Validates an untrusted archive. Returns every problem found (empty = valid). */
export function validateArchive(data: unknown): string[] {
  const errors: string[] = [];
  if (typeof data !== 'object' || data === null) return ['JSON 객체가 아니에요.'];
  const a = data as Record<string, unknown>;
  if (a.format !== ARCHIVE_FORMAT) errors.push('딸깍 내보내기 파일이 아니에요.');
  const version = a.schemaVersion;
  if (version !== 1 && version !== 2) errors.push(`지원하지 않는 버전이에요 (${String(version)}). 앱을 최신으로 업데이트해 주세요.`);
  if (!Array.isArray(a.items)) return [...errors, '항목 목록이 없어요.'];
  if (a.items.length > MAX_IMPORT_ITEMS) errors.push(`항목이 너무 많아요 (최대 ${MAX_IMPORT_ITEMS}개).`);
  const ids = new Set<string>();
  a.items.slice(0, MAX_IMPORT_ITEMS).forEach((raw, i) => {
    const it = raw as Record<string, unknown>;
    const at = `${i + 1}번째 항목`;
    if (!isStr(it?.id, 64) || !it.id) return errors.push(`${at}: id가 올바르지 않아요.`);
    // v2 ids name folders on disk, so they must be path-safe.
    if (version === 2 && !SAFE_ID.test(it.id)) return errors.push(`${at}: id에 쓸 수 없는 문자가 있어요.`);
    if (ids.has(it.id)) errors.push(`${at}: id가 중복돼요.`);
    ids.add(it.id);
    if (!isStr(it.title, 500)) errors.push(`${at}: 제목이 올바르지 않아요.`);
    if (!CATEGORIES.includes(it.category as Category)) errors.push(`${at}: 분류가 올바르지 않아요.`);
    if (!STATUSES.includes(it.status as ItemStatus)) errors.push(`${at}: 상태가 올바르지 않아요.`);
    if (!isOptStr(it.sourceUrl, 4000) || !isOptStr(it.userNote) || !isOptStr(it.displayText) || !isOptStr(it.ocrText)) errors.push(`${at}: 텍스트 필드가 올바르지 않아요.`);
    if (!Array.isArray(it.tags) || !it.tags.every((t) => isStr(t, 50))) errors.push(`${at}: 태그가 올바르지 않아요.`);
    if (!Array.isArray(it.fields)) errors.push(`${at}: 추출 항목 목록이 없어요.`);
    else
      for (const f of it.fields as Record<string, unknown>[]) {
        if (!isStr(f?.id, 64) || !isStr(f.fieldType, 40) || !isStr(f.valueText, 2000)) {
          errors.push(`${at}: 추출 항목 형식이 올바르지 않아요.`);
          break;
        }
        if (f.fieldType === 'date' && f.normalizedValue != null && (!isStr(f.normalizedValue, 40) || !parseLocal(f.normalizedValue))) {
          errors.push(`${at}: 잘못된 날짜(${String(f.normalizedValue)})가 있어요.`);
          break;
        }
      }
    if (!Array.isArray(it.reminders)) errors.push(`${at}: 알림 목록이 없어요.`);
    else
      for (const r of it.reminders as Record<string, unknown>[]) {
        if (!isStr(r?.id, 64) || !isStr(r.scheduledAt, 40) || !parseLocal(r.scheduledAt)) {
          errors.push(`${at}: 알림 날짜가 올바르지 않아요.`);
          break;
        }
      }
    if (version === 1 && it.attachments !== undefined) errors.push(`${at}: v1 파일에는 첨부가 있을 수 없어요.`);
    else validateAttachments(it.attachments, at, errors);
  });
  return errors;
}

export function buildArchive(items: ArchiveItem[], now = new Date(), attachmentsIncluded = false): Archive {
  return { format: ARCHIVE_FORMAT, schemaVersion: 2, exportedAt: now.toISOString(), attachmentsIncluded, items };
}

export interface AttachmentCandidate {
  id: string;
  sizeBytes: number | null;
  exists: boolean;
}

/**
 * Picks which files go into a backup, in item order, until the byte budget is used.
 * Everything left out is reported with a reason so the UI can say so before saving.
 */
export function selectAttachmentsForExport(list: AttachmentCandidate[], budget = MAX_EXPORT_ATTACHMENT_BYTES): { included: Set<string>; excluded: Map<string, ExcludedReason>; includedBytes: number } {
  const included = new Set<string>();
  const excluded = new Map<string, ExcludedReason>();
  let used = 0;
  for (const a of list) {
    if (!a.exists || a.sizeBytes == null) excluded.set(a.id, 'missing');
    else if (a.sizeBytes > MAX_FILE_BYTES) excluded.set(a.id, 'too-large');
    else if (used + a.sizeBytes > budget) excluded.set(a.id, 'budget');
    else {
      included.add(a.id);
      used += a.sizeBytes;
    }
  }
  return { included, excluded, includedBytes: used };
}
