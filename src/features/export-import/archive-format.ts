import { CATEGORIES, type Category, type ExtractedField, type InboxItem, type ItemStatus, type Reminder } from '@/domain/models';
import { parseLocal } from '@/utils/dates';

export const ARCHIVE_FORMAT = 'ddalggak-export';
export const ARCHIVE_SCHEMA_VERSION = 1;
export const MAX_IMPORT_ITEMS = 5000;
export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

export interface ArchiveItem extends Omit<InboxItem, 'schemaVersion'> {
  fields: Omit<ExtractedField, 'itemId'>[];
  /** Reminders are exported for reference; on import they are recreated as disabled (no OS schedule). */
  reminders: Omit<Reminder, 'itemId' | 'notificationId'>[];
}

/**
 * Versioned JSON export. Attachments (images/PDFs) are not embedded in v1; the archive says so,
 * so a restore never pretends files came back.
 */
export interface ArchiveV1 {
  format: typeof ARCHIVE_FORMAT;
  schemaVersion: 1;
  exportedAt: string;
  attachmentsIncluded: false;
  items: ArchiveItem[];
}

const STATUSES: ItemStatus[] = ['draft', 'active', 'completed', 'archived'];

function isStr(v: unknown, max = 100_000): v is string {
  return typeof v === 'string' && v.length <= max;
}
function isOptStr(v: unknown, max = 100_000): v is string | null {
  return v === null || isStr(v, max);
}

/** Validates an untrusted archive. Returns every problem found (empty = valid). */
export function validateArchive(data: unknown): string[] {
  const errors: string[] = [];
  if (typeof data !== 'object' || data === null) return ['JSON 객체가 아니에요.'];
  const a = data as Record<string, unknown>;
  if (a.format !== ARCHIVE_FORMAT) errors.push('킵온 내보내기 파일이 아니에요.');
  if (a.schemaVersion !== ARCHIVE_SCHEMA_VERSION) errors.push(`지원하지 않는 버전이에요 (${String(a.schemaVersion)}).`);
  if (!Array.isArray(a.items)) return [...errors, '항목 목록이 없어요.'];
  if (a.items.length > MAX_IMPORT_ITEMS) errors.push(`항목이 너무 많아요 (최대 ${MAX_IMPORT_ITEMS}개).`);
  const ids = new Set<string>();
  a.items.slice(0, MAX_IMPORT_ITEMS).forEach((raw, i) => {
    const it = raw as Record<string, unknown>;
    const at = `${i + 1}번째 항목`;
    if (!isStr(it?.id, 64) || !it.id) return errors.push(`${at}: id가 올바르지 않아요.`);
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
  });
  return errors;
}

export function buildArchive(items: ArchiveItem[], now = new Date()): ArchiveV1 {
  return { format: ARCHIVE_FORMAT, schemaVersion: 1, exportedAt: now.toISOString(), attachmentsIncluded: false, items };
}
