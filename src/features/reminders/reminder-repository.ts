import type { InboxItem, ItemStatus, Reminder } from '@/domain/models';
import { getDb } from '@/infrastructure/database/database';

import { toReminder } from '../items/item-repository';

type ReminderRow = Parameters<typeof toReminder>[0];

export async function insertReminder(r: Reminder): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO reminders (id, item_id, title, scheduled_at, timezone_id, reminder_type, notification_id, source_field_id, target_date, days_before, enabled, completed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    r.id, r.itemId, r.title, r.scheduledAt, r.timezoneId, r.reminderType, r.notificationId, r.sourceFieldId, r.targetDate, r.daysBefore,
    r.enabled ? 1 : 0, r.completedAt, r.createdAt, r.updatedAt,
  );
}

export async function getReminder(id: string): Promise<Reminder | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<ReminderRow>('SELECT * FROM reminders WHERE id = ?', id);
  return row ? toReminder(row) : null;
}

export interface ReminderPatch {
  notificationId?: string | null;
  enabled?: boolean;
  completedAt?: string | null;
  scheduledAt?: string;
  targetDate?: string | null;
  timezoneId?: string;
}

const PATCH_COLUMNS: Record<keyof ReminderPatch, string> = {
  notificationId: 'notification_id',
  enabled: 'enabled',
  completedAt: 'completed_at',
  scheduledAt: 'scheduled_at',
  targetDate: 'target_date',
  timezoneId: 'timezone_id',
};

export async function updateReminder(id: string, patch: ReminderPatch): Promise<void> {
  const keys = (Object.keys(patch) as (keyof ReminderPatch)[]).filter((k) => patch[k] !== undefined);
  if (!keys.length) return;
  const db = await getDb();
  const values = keys.map((k) => {
    const v = patch[k];
    return typeof v === 'boolean' ? (v ? 1 : 0) : (v ?? null);
  });
  await db.runAsync(`UPDATE reminders SET ${keys.map((k) => `${PATCH_COLUMNS[k]} = ?`).join(', ')}, updated_at = ? WHERE id = ?`, ...values, new Date().toISOString(), id);
}

export async function deleteReminderRow(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM reminders WHERE id = ?', id);
}

export async function remindersForItem(itemId: string): Promise<Reminder[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ReminderRow>('SELECT * FROM reminders WHERE item_id = ? ORDER BY scheduled_at', itemId);
  return rows.map(toReminder);
}

export async function remindersForField(fieldId: string): Promise<Reminder[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ReminderRow>('SELECT * FROM reminders WHERE source_field_id = ?', fieldId);
  return rows.map(toReminder);
}

/** The field is being deleted: its reminders stay (the user made them) but lose the link. */
export async function unlinkField(fieldId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE reminders SET source_field_id = NULL WHERE source_field_id = ?', fieldId);
}

/** Enabled reminders in the future, optionally not counting one (when it is being replaced). */
export async function countActiveReminders(nowLocal: string, excludeId?: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM reminders WHERE enabled = 1 AND scheduled_at > ? AND id != ?', nowLocal, excludeId ?? '');
  return row?.n ?? 0;
}

export async function getItemStatus(itemId: string): Promise<{ status: ItemStatus; title: string } | null> {
  const db = await getDb();
  return db.getFirstAsync<{ status: ItemStatus; title: string }>('SELECT status, title FROM items WHERE id = ?', itemId);
}

export async function upcomingReminders(nowLocal: string): Promise<{ reminder: Reminder; item: Pick<InboxItem, 'id' | 'title' | 'category'> }[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ReminderRow & { item_title: string; item_category: string }>(
    `SELECT r.*, i.title AS item_title, i.category AS item_category FROM reminders r JOIN items i ON i.id = r.item_id
     WHERE r.enabled = 1 AND r.scheduled_at > ? AND i.status = 'active' ORDER BY r.scheduled_at ASC LIMIT 200`,
    nowLocal,
  );
  return rows.map((r) => ({ reminder: toReminder(r), item: { id: r.item_id, title: r.item_title, category: r.item_category as InboxItem['category'] } }));
}

/** Enabled reminders with their item's title/status (reconciliation). */
export async function allEnabledReminders(): Promise<(Reminder & { itemTitle: string; itemStatus: ItemStatus })[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ReminderRow & { item_title: string; item_status: ItemStatus }>(
    'SELECT r.*, i.title AS item_title, i.status AS item_status FROM reminders r JOIN items i ON i.id = r.item_id WHERE r.enabled = 1',
  );
  return rows.map((r) => ({ ...toReminder(r), itemTitle: r.item_title, itemStatus: r.item_status }));
}
