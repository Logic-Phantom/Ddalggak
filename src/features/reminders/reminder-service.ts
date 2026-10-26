import { AppError, logError } from '@/domain/errors';
import type { Reminder, ReminderType } from '@/domain/models';
import * as notifications from '@/infrastructure/notifications/local-notifications';
import { deviceTimeZone, pad2 } from '@/utils/dates';
import { newId } from '@/utils/id';

import { allEnabledReminders, countActiveReminders, deleteReminderRow, getReminder, insertReminder, updateReminder } from './reminder-repository';
import { checkReminder, REMINDER_REASON_TEXT } from './reminder-policy';

export function nowLocal(now = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}T${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

export interface CreateReminderInput {
  itemId: string;
  itemTitle: string;
  targetDate: string;
  daysBefore: number;
  defaultHour: number;
  confirmed: boolean;
  reminderType: ReminderType;
  /** Short label shown in the notification body, e.g. "쿠폰 만료일". No codes/amounts. */
  label: string;
}

export type CreateReminderResult = { reminder: Reminder; scheduled: boolean; permission: notifications.PermissionState };

/**
 * Creates a reminder. Permission is requested here (the first time the user sets one).
 * If permission is denied the reminder is still saved and shown in the 알림 tab.
 */
export async function createReminder(input: CreateReminderInput, now = new Date()): Promise<CreateReminderResult> {
  const activeCount = await countActiveReminders(nowLocal(now));
  const check = checkReminder({ targetDate: input.targetDate, daysBefore: input.daysBefore, defaultHour: input.defaultHour, confirmed: input.confirmed, activeCount, now });
  if (!check.ok) throw new AppError(check.reason === 'limit' ? 'reminder-limit' : 'validation', REMINDER_REASON_TEXT[check.reason]);

  const permission = await notifications.requestPermission().catch(() => 'denied' as const);
  let notificationId: string | null = null;
  if (permission === 'granted') {
    try {
      const when = input.daysBefore > 0 ? `${input.daysBefore}일 전` : '오늘';
      notificationId = await notifications.scheduleAt(check.triggerAt, input.itemTitle.slice(0, 60), `${input.label} ${when}이에요.`, input.itemId);
    } catch (e) {
      logError('reminder.schedule', e);
    }
  }
  const ts = now.toISOString();
  const reminder: Reminder = {
    id: newId('r'),
    itemId: input.itemId,
    title: input.label,
    scheduledAt: check.triggerAt,
    timezoneId: deviceTimeZone(),
    reminderType: input.reminderType,
    notificationId,
    enabled: true,
    completedAt: null,
    createdAt: ts,
    updatedAt: ts,
  };
  await insertReminder(reminder);
  return { reminder, scheduled: notificationId != null, permission };
}

export async function deleteReminder(id: string): Promise<void> {
  const r = await getReminder(id);
  if (r?.notificationId) await notifications.cancel(r.notificationId);
  await deleteReminderRow(id);
}

/** Item archived/completed: stop notifications but keep the reminder rows (disabled). */
export async function disableRemindersFor(reminders: Reminder[]): Promise<void> {
  for (const r of reminders) {
    if (r.notificationId) await notifications.cancel(r.notificationId);
    await updateReminder(r.id, { enabled: false, notificationId: null });
  }
}

/**
 * Keeps OS schedule and DB in sync (app start): re-schedules enabled future reminders whose
 * notification is missing (e.g. after reinstall/restore) and cancels notifications without a row.
 */
export async function reconcileNotifications(now = new Date()): Promise<void> {
  try {
    if ((await notifications.getPermission()) !== 'granted') return;
    const scheduled = new Set(await notifications.scheduledIds());
    const reminders = await allEnabledReminders();
    const known = new Set<string>();
    const nowKey = nowLocal(now);
    for (const { reminder: r, itemTitle } of reminders) {
      if (r.notificationId && scheduled.has(r.notificationId)) {
        known.add(r.notificationId);
        continue;
      }
      if (r.scheduledAt <= nowKey) continue;
      const id = await notifications.scheduleAt(r.scheduledAt, itemTitle.slice(0, 60), `${r.title} 알림이에요.`, r.itemId).catch(() => null);
      await updateReminder(r.id, { notificationId: id });
      if (id) known.add(id);
    }
    for (const id of scheduled) if (!known.has(id)) await notifications.cancel(id);
  } catch (e) {
    logError('reminder.reconcile', e);
  }
}
