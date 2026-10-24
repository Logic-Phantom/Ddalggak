import type { Attachment, Category, ExtractedField, InboxItem, ItemDetail, ItemStatus, Reminder } from '@/domain/models';
import { getDb } from '@/infrastructure/database/database';
import { newId } from '@/utils/id';

/**
 * SQLite access for items and their children. Every query uses parameter binding —
 * user text (including OCR output) is never concatenated into SQL.
 */

interface ItemRow {
  id: string;
  title: string;
  category: string;
  status: string;
  source_type: string;
  source_url: string | null;
  domain: string | null;
  display_text: string | null;
  ocr_text: string | null;
  user_note: string | null;
  needs_review: number;
  pinned: number;
  captured_at: string;
  created_at: string;
  updated_at: string;
  schema_version: number;
}

interface FieldRow {
  id: string;
  item_id: string;
  field_type: string;
  value_text: string;
  normalized_value: string | null;
  role: string | null;
  confidence: string;
  method: string;
  evidence_text: string | null;
  requires_confirmation: number;
  user_confirmed: number;
  user_edited_at: string | null;
  created_at: string;
}

interface AttachmentRow {
  id: string;
  item_id: string;
  local_uri: string;
  original_name: string | null;
  mime_type: string;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  storage_mode: string;
  created_at: string;
}

interface ReminderRow {
  id: string;
  item_id: string;
  title: string;
  scheduled_at: string;
  timezone_id: string;
  reminder_type: string;
  notification_id: string | null;
  enabled: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

function toItem(r: ItemRow, tags: string[]): InboxItem {
  return {
    id: r.id,
    title: r.title,
    category: r.category as Category,
    status: r.status as ItemStatus,
    sourceType: r.source_type as InboxItem['sourceType'],
    sourceUrl: r.source_url,
    domain: r.domain,
    displayText: r.display_text,
    ocrText: r.ocr_text,
    userNote: r.user_note,
    tags,
    needsReview: !!r.needs_review,
    pinned: !!r.pinned,
    capturedAt: r.captured_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    schemaVersion: r.schema_version,
  };
}

function toField(r: FieldRow): ExtractedField {
  return {
    id: r.id,
    itemId: r.item_id,
    fieldType: r.field_type as ExtractedField['fieldType'],
    valueText: r.value_text,
    normalizedValue: r.normalized_value,
    role: r.role,
    confidence: r.confidence as ExtractedField['confidence'],
    method: r.method as ExtractedField['method'],
    evidenceText: r.evidence_text,
    requiresConfirmation: !!r.requires_confirmation,
    userConfirmed: !!r.user_confirmed,
    userEditedAt: r.user_edited_at,
    createdAt: r.created_at,
  };
}

function toAttachment(r: AttachmentRow): Attachment {
  return {
    id: r.id,
    itemId: r.item_id,
    localUri: r.local_uri,
    originalName: r.original_name,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    width: r.width,
    height: r.height,
    storageMode: r.storage_mode as Attachment['storageMode'],
    createdAt: r.created_at,
  };
}

export function toReminder(r: ReminderRow): Reminder {
  return {
    id: r.id,
    itemId: r.item_id,
    title: r.title,
    scheduledAt: r.scheduled_at,
    timezoneId: r.timezone_id,
    reminderType: r.reminder_type as Reminder['reminderType'],
    notificationId: r.notification_id,
    enabled: !!r.enabled,
    completedAt: r.completed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function tagsFor(ids: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!ids.length) return out;
  const db = await getDb();
  const rows = await db.getAllAsync<{ item_id: string; name: string }>(
    `SELECT it.item_id, t.name FROM item_tags it JOIN tags t ON t.id = it.tag_id WHERE it.item_id IN (${ids.map(() => '?').join(',')}) ORDER BY t.name`,
    ...ids,
  );
  for (const r of rows) out.set(r.item_id, [...(out.get(r.item_id) ?? []), r.name]);
  return out;
}

async function withTags(rows: ItemRow[]): Promise<InboxItem[]> {
  const tags = await tagsFor(rows.map((r) => r.id));
  return rows.map((r) => toItem(r, tags.get(r.id) ?? []));
}

// ---- items ----

export interface NewItem {
  item: Omit<InboxItem, 'tags'>;
  urlKey: string | null;
  fields: ExtractedField[];
  attachments: Attachment[];
}

export async function insertItem(data: NewItem): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(() => insertItemRows(data));
}

/** Same as insertItem but without its own transaction (for callers that batch several items). */
export async function insertItemRows({ item, urlKey, fields, attachments }: NewItem): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO items (id, title, category, status, source_type, source_url, url_key, domain, display_text, ocr_text, user_note, needs_review, pinned, captured_at, created_at, updated_at, schema_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    item.id, item.title, item.category, item.status, item.sourceType, item.sourceUrl, urlKey, item.domain, item.displayText, item.ocrText, item.userNote,
    item.needsReview ? 1 : 0, item.pinned ? 1 : 0, item.capturedAt, item.createdAt, item.updatedAt, item.schemaVersion,
  );
  for (const f of fields) await insertFieldRow(f);
  for (const a of attachments) {
    await db.runAsync(
      'INSERT INTO attachments (id, item_id, local_uri, original_name, mime_type, size_bytes, width, height, storage_mode, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      a.id, a.itemId, a.localUri, a.originalName, a.mimeType, a.sizeBytes, a.width, a.height, a.storageMode, a.createdAt,
    );
  }
}

async function insertFieldRow(f: ExtractedField): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO extracted_fields (id, item_id, field_type, value_text, normalized_value, role, confidence, method, evidence_text, requires_confirmation, user_confirmed, user_edited_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    f.id, f.itemId, f.fieldType, f.valueText, f.normalizedValue, f.role, f.confidence, f.method, f.evidenceText,
    f.requiresConfirmation ? 1 : 0, f.userConfirmed ? 1 : 0, f.userEditedAt, f.createdAt,
  );
}

export async function getItem(id: string): Promise<ItemDetail | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<ItemRow>('SELECT * FROM items WHERE id = ?', id);
  if (!row) return null;
  const [fields, attachments, reminders, tags] = await Promise.all([
    db.getAllAsync<FieldRow>('SELECT * FROM extracted_fields WHERE item_id = ? ORDER BY created_at, rowid', id),
    db.getAllAsync<AttachmentRow>('SELECT * FROM attachments WHERE item_id = ? ORDER BY created_at, rowid', id),
    db.getAllAsync<ReminderRow>('SELECT * FROM reminders WHERE item_id = ? ORDER BY scheduled_at', id),
    tagsFor([id]),
  ]);
  return { ...toItem(row, tags.get(id) ?? []), fields: fields.map(toField), attachments: attachments.map(toAttachment), reminders: reminders.map(toReminder) };
}

export interface ListFilter {
  statuses?: ItemStatus[];
  category?: Category | null;
  needsReview?: boolean;
  tag?: string | null;
  limit?: number;
}

export async function listItems(filter: ListFilter = {}): Promise<InboxItem[]> {
  const db = await getDb();
  const where: string[] = [];
  const params: (string | number)[] = [];
  const statuses = filter.statuses ?? ['active'];
  where.push(`status IN (${statuses.map(() => '?').join(',')})`);
  params.push(...statuses);
  if (filter.category) {
    where.push('category = ?');
    params.push(filter.category);
  }
  if (filter.needsReview != null) {
    where.push('needs_review = ?');
    params.push(filter.needsReview ? 1 : 0);
  }
  if (filter.tag) {
    where.push('id IN (SELECT it.item_id FROM item_tags it JOIN tags t ON t.id = it.tag_id WHERE t.name = ?)');
    params.push(filter.tag);
  }
  params.push(filter.limit ?? 500);
  const rows = await db.getAllAsync<ItemRow>(`SELECT * FROM items WHERE ${where.join(' AND ')} ORDER BY pinned DESC, updated_at DESC LIMIT ?`, ...params);
  return withTags(rows);
}

/** LIKE pattern with user text escaped (%, _ and \ are literal). */
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Text search over title, note, shared text, OCR text, URL, tags and extracted field values. */
export async function searchItems(terms: string[], filter: { statuses: ItemStatus[]; category?: Category | null }): Promise<InboxItem[]> {
  if (!terms.length) return [];
  const db = await getDb();
  const where: string[] = [`status IN (${filter.statuses.map(() => '?').join(',')})`];
  const params: (string | number)[] = [...filter.statuses];
  if (filter.category) {
    where.push('category = ?');
    params.push(filter.category);
  }
  for (const term of terms) {
    const p = likePattern(term);
    where.push(`(
      title LIKE ? ESCAPE '\\' OR IFNULL(user_note,'') LIKE ? ESCAPE '\\' OR IFNULL(display_text,'') LIKE ? ESCAPE '\\'
      OR IFNULL(ocr_text,'') LIKE ? ESCAPE '\\' OR IFNULL(source_url,'') LIKE ? ESCAPE '\\'
      OR id IN (SELECT item_id FROM extracted_fields WHERE value_text LIKE ? ESCAPE '\\')
      OR id IN (SELECT it.item_id FROM item_tags it JOIN tags t ON t.id = it.tag_id WHERE t.name LIKE ? ESCAPE '\\')
    )`);
    params.push(p, p, p, p, p, p, p);
  }
  const rows = await db.getAllAsync<ItemRow>(`SELECT * FROM items WHERE ${where.join(' AND ')} ORDER BY updated_at DESC LIMIT 200`, ...params);
  return withTags(rows);
}

export async function findByUrlKey(urlKey: string, excludeId?: string): Promise<InboxItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ItemRow>("SELECT * FROM items WHERE url_key = ? AND id != ? AND status != 'draft' ORDER BY created_at DESC LIMIT 5", urlKey, excludeId ?? '');
  return withTags(rows);
}

export interface ItemPatch {
  title?: string;
  category?: Category;
  status?: ItemStatus;
  userNote?: string | null;
  needsReview?: boolean;
  pinned?: boolean;
  ocrText?: string | null;
  displayText?: string | null;
}

const PATCH_COLUMNS: Record<keyof ItemPatch, string> = {
  title: 'title',
  category: 'category',
  status: 'status',
  userNote: 'user_note',
  needsReview: 'needs_review',
  pinned: 'pinned',
  ocrText: 'ocr_text',
  displayText: 'display_text',
};

export async function updateItem(id: string, patch: ItemPatch): Promise<void> {
  const keys = Object.keys(patch) as (keyof ItemPatch)[];
  if (!keys.length) return;
  const db = await getDb();
  const sets = keys.map((k) => `${PATCH_COLUMNS[k]} = ?`);
  const values = keys.map((k) => {
    const v = patch[k];
    return typeof v === 'boolean' ? (v ? 1 : 0) : (v ?? null);
  });
  await db.runAsync(`UPDATE items SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`, ...values, new Date().toISOString(), id);
}

/** Deletes the item row (children cascade). Returns what the caller must clean outside the DB. */
export async function deleteItemRow(id: string): Promise<{ attachmentUris: string[]; notificationIds: string[] }> {
  const db = await getDb();
  const atts = await db.getAllAsync<{ local_uri: string }>('SELECT local_uri FROM attachments WHERE item_id = ?', id);
  const rems = await db.getAllAsync<{ notification_id: string | null }>('SELECT notification_id FROM reminders WHERE item_id = ?', id);
  await db.runAsync('DELETE FROM items WHERE id = ?', id);
  return { attachmentUris: atts.map((a) => a.local_uri), notificationIds: rems.map((r) => r.notification_id).filter((x): x is string => !!x) };
}

export async function countByStatus(): Promise<Record<ItemStatus, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ status: ItemStatus; n: number }>('SELECT status, COUNT(*) AS n FROM items GROUP BY status');
  const out: Record<ItemStatus, number> = { draft: 0, active: 0, completed: 0, archived: 0 };
  for (const r of rows) out[r.status] = r.n;
  return out;
}

export async function listDraftIds(olderThanIso: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string }>("SELECT id FROM items WHERE status = 'draft' AND created_at < ?", olderThanIso);
  return rows.map((r) => r.id);
}

// ---- fields ----

export async function replaceAutomaticFields(itemId: string, fields: ExtractedField[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM extracted_fields WHERE item_id = ? AND user_confirmed = 0 AND user_edited_at IS NULL AND method != 'manual'", itemId);
    for (const f of fields) await insertFieldRow(f);
  });
}

export async function addField(f: ExtractedField): Promise<void> {
  await insertFieldRow(f);
}

export async function updateField(id: string, patch: { valueText?: string; normalizedValue?: string | null; role?: string | null; userConfirmed?: boolean; edited?: boolean }): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const params: (string | number | null)[] = [];
  if (patch.valueText !== undefined) {
    sets.push('value_text = ?');
    params.push(patch.valueText);
  }
  if (patch.normalizedValue !== undefined) {
    sets.push('normalized_value = ?');
    params.push(patch.normalizedValue);
  }
  if (patch.role !== undefined) {
    sets.push('role = ?');
    params.push(patch.role);
  }
  if (patch.userConfirmed !== undefined) {
    sets.push('user_confirmed = ?');
    params.push(patch.userConfirmed ? 1 : 0);
  }
  if (patch.edited) {
    sets.push('user_edited_at = ?');
    params.push(new Date().toISOString());
  }
  if (!sets.length) return;
  await db.runAsync(`UPDATE extracted_fields SET ${sets.join(', ')} WHERE id = ?`, ...params, id);
}

export async function deleteField(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM extracted_fields WHERE id = ?', id);
}

/** Earliest upcoming date field per item (for inbox cards): confirmed first, then candidates. */
export async function upcomingDates(itemIds: string[], fromYmd: string): Promise<Map<string, ExtractedField>> {
  const out = new Map<string, ExtractedField>();
  if (!itemIds.length) return out;
  const db = await getDb();
  const rows = await db.getAllAsync<FieldRow>(
    `SELECT * FROM extracted_fields WHERE field_type = 'date' AND normalized_value >= ? AND item_id IN (${itemIds.map(() => '?').join(',')})
     ORDER BY user_confirmed DESC, normalized_value ASC`,
    fromYmd,
    ...itemIds,
  );
  for (const r of rows) if (!out.has(r.item_id)) out.set(r.item_id, toField(r));
  return out;
}

/** Confirmed date fields in a window (기한 tab), joined with their active items. */
export async function confirmedDatesBetween(fromYmd: string, toYmdExclusive: string): Promise<{ field: ExtractedField; item: InboxItem }[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<FieldRow & { item_title: string }>(
    `SELECT f.*, i.title AS item_title FROM extracted_fields f JOIN items i ON i.id = f.item_id
     WHERE f.field_type = 'date' AND f.user_confirmed = 1 AND i.status = 'active' AND f.normalized_value >= ? AND f.normalized_value < ?
     ORDER BY f.normalized_value ASC LIMIT 300`,
    fromYmd,
    toYmdExclusive,
  );
  const items = await db.getAllAsync<ItemRow>(`SELECT * FROM items WHERE id IN (${rows.map(() => '?').join(',') || "''"})`, ...rows.map((r) => r.item_id));
  const byId = new Map((await withTags(items)).map((i) => [i.id, i]));
  return rows.filter((r) => byId.has(r.item_id)).map((r) => ({ field: toField(r), item: byId.get(r.item_id)! }));
}

// ---- tags ----

export async function setTags(itemId: string, names: string[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(() => setTagsRows(itemId, names));
}

/** setTags without its own transaction. */
export async function setTagsRows(itemId: string, names: string[]): Promise<void> {
  const db = await getDb();
  const clean = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean))).slice(0, 20);
  await db.runAsync('DELETE FROM item_tags WHERE item_id = ?', itemId);
  for (const name of clean) {
    await db.runAsync('INSERT OR IGNORE INTO tags (id, name, created_at) VALUES (?, ?, ?)', newId('t'), name, new Date().toISOString());
    const tag = await db.getFirstAsync<{ id: string }>('SELECT id FROM tags WHERE name = ?', name);
    if (tag) await db.runAsync('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)', itemId, tag.id);
  }
  await db.runAsync('DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM item_tags)');
}

export async function allTags(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ name: string }>('SELECT name FROM tags ORDER BY name');
  return rows.map((r) => r.name);
}

// ---- attachments ----

export async function deleteAttachmentRow(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM attachments WHERE id = ?', id);
}

export async function allAttachments(): Promise<Attachment[]> {
  const db = await getDb();
  return (await db.getAllAsync<AttachmentRow>('SELECT * FROM attachments')).map(toAttachment);
}

export async function allItemIds(): Promise<string[]> {
  const db = await getDb();
  return (await db.getAllAsync<{ id: string }>('SELECT id FROM items')).map((r) => r.id);
}

export async function clearOcrTextEverywhere(): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE items SET ocr_text = NULL');
}
