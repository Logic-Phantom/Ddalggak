import type { InboxItem, Reminder } from '@/domain/models';
import { getDb } from '@/infrastructure/database/database';

import { toReminder } from '../items/item-repository';

export async function insertReminder(r: Reminder): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO reminders (id, item_id, title, scheduled_at, timezone_id, reminder_type, notification_id, enabled, completed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    r.id, r.itemId, r.title, r.scheduledAt, r.timezoneId, r.reminderType, r.notificationId, r.enabled ? 1 : 0, r.completedAt, r.createdAt, r.updatedAt,
  );
}

export async function getReminder(id: string): Promise<Reminder | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Parameters<typeof toReminder>[0]>('SELECT * FROM reminders WHERE id = ?', id);
  return row ? toReminder(row) : null;
}

export async function updateReminder(id: string, patch: { notificationId?: string | null; enabled?: boolean; completedAt?: string | null }): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const params: (string | number | null)[] = [];
  if (patch.notificationId !== undefined) {
    sets.push('notification_id = ?');
    params.push(patch.notificationId);
  }
  if (patch.enabled !== undefined) {
    sets.push('enabled = ?');
    params.push(patch.enabled ? 1 : 0);
  }
  if (patch.completedAt !== undefined) {
    sets.push('completed_at = ?');
    params.push(patch.completedAt);
  }
  if (!sets.length) return;
  await db.runAsync(`UPDATE reminders SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`, ...params, new Date().toISOString(), id);
}

export async function deleteReminderRow(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM reminders WHERE id = ?', id);
}

export async function remindersForItem(itemId: string): Promise<Reminder[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Parameters<typeof toReminder>[0]>('SELECT * FROM reminders WHERE item_id = ? ORDER BY scheduled_at', itemId);
  return rows.map(toReminder);
}

export async function countActiveReminders(nowLocal: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM reminders WHERE enabled = 1 AND scheduled_at > ?', nowLocal);
  return row?.n ?? 0;
}

export async function upcomingReminders(nowLocal: string): Promise<{ reminder: Reminder; item: Pick<InboxItem, 'id' | 'title' | 'category'> }[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Parameters<typeof toReminder>[0] & { item_title: string; item_category: string }>(
    `SELECT r.*, i.title AS item_title, i.category AS item_category FROM reminders r JOIN items i ON i.id = r.item_id
     WHERE r.enabled = 1 AND r.scheduled_at > ? AND i.status = 'active' ORDER BY r.scheduled_at ASC LIMIT 200`,
    nowLocal,
  );
  return rows.map((r) => ({ reminder: toReminder(r), item: { id: r.item_id, title: r.item_title, category: r.item_category as InboxItem['category'] } }));
}

export async function allEnabledReminders(): Promise<Reminder[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Parameters<typeof toReminder>[0]>('SELECT * FROM reminders WHERE enabled = 1');
  return rows.map(toReminder);
}
