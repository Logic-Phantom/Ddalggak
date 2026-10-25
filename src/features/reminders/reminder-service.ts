import { AppError, logError } from '@/domain/errors';
import type { Reminder, ReminderType } from '@/domain/models';
import * as notifications from '@/infrastructure/notifications/local-notifications';
import { deviceTimeZone, pad2 } from '@/utils/dates';
import { newId } from '@/utils/id';

import { getField } from '../items/item-repository';
import {
  allEnabledReminders,
  countActiveReminders,
  deleteReminderRow,
  getItemStatus,
  getReminder,
  insertReminder,
  remindersForField,
  updateReminder,
} from './reminder-repository';
import { canUseFieldForReminder, checkReminder, MAX_SCHEDULED_REMINDERS, notificationBody, planForFieldChange, REMINDER_REASON_TEXT, type ReminderCheck } from './reminder-policy';

/**
 * The only place that talks to the OS scheduler for reminders. DB rows say what the user asked
 * for; `notificationId` says whether the OS currently holds a notification for it. Every path
 * cancels before re-scheduling, so repeated calls never stack duplicate notifications.
 */

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
  /** The confirmed date field this comes from (null when the user typed a date). */
  sourceFieldId?: string | null;
}

export interface ScheduleResult {
  scheduled: boolean;
  permission: notifications.PermissionState;
  /** Permission was granted but the OS refused/failed to schedule. */
  failed: boolean;
}

export type CreateReminderResult = ScheduleResult & { reminder: Reminder };

function rejectFor(check: Exclude<ReminderCheck, { ok: true }>): AppError {
  return new AppError(check.reason === 'limit' ? 'reminder-limit' : 'validation', REMINDER_REASON_TEXT[check.reason]);
}

/** Asks the OS to schedule. `ask` = may show the permission prompt (only on a user action). */
async function scheduleOs(triggerAt: string, itemTitle: string, body: string, itemId: string, ask: boolean): Promise<ScheduleResult & { id: string | null }> {
  const permission = await (ask ? notifications.requestPermission() : notifications.getPermission()).catch(() => 'denied' as const);
  if (permission !== 'granted') return { id: null, scheduled: false, failed: false, permission };
  try {
    const id = await notifications.scheduleAt(triggerAt, itemTitle.slice(0, 60), body, itemId);
    return { id, scheduled: true, failed: false, permission };
  } catch (e) {
    logError('reminder.schedule', e);
    return { id: null, scheduled: false, failed: true, permission };
  }
}

/**
 * Creates a reminder. Permission is requested here (the first time the user sets one).
 * If permission is denied or scheduling fails the row is still saved (shown in the 알림 tab with
 * its real state) — the UI never claims "예약됨" for it.
 */
export async function createReminder(input: CreateReminderInput, now = new Date()): Promise<CreateReminderResult> {
  const item = await getItemStatus(input.itemId);
  const activeCount = await countActiveReminders(nowLocal(now));
  const check = checkReminder({
    targetDate: input.targetDate,
    daysBefore: input.daysBefore,
    defaultHour: input.defaultHour,
    confirmed: input.confirmed,
    activeCount,
    now,
    itemActive: item?.status === 'active',
  });
  if (!check.ok) throw rejectFor(check);

  const os = await scheduleOs(check.triggerAt, input.itemTitle, notificationBody(input.label, input.daysBefore), input.itemId, true);
  const ts = now.toISOString();
  const reminder: Reminder = {
    id: newId('r'),
    itemId: input.itemId,
    title: input.label,
    scheduledAt: check.triggerAt,
    timezoneId: deviceTimeZone(),
    reminderType: input.reminderType,
    notificationId: os.id,
    sourceFieldId: input.sourceFieldId ?? null,
    targetDate: input.targetDate,
    daysBefore: input.daysBefore,
    enabled: true,
    completedAt: null,
    createdAt: ts,
    updatedAt: ts,
  };
  try {
    await insertReminder(reminder);
  } catch (e) {
    // Never leave an OS notification without its row.
    if (os.id) await notifications.cancel(os.id);
    throw e;
  }
  return { reminder, scheduled: os.scheduled, permission: os.permission, failed: os.failed };
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
 * "다시 예약" (enabled but not on the device) and "다시 켜기" (switched off by 완료/보관/복원).
 * Re-checks everything a new reminder would need: active item, still-confirmed source date,
 * future time and the scheduling budget. The stored time is kept — never moved to another day.
 */
export async function rescheduleReminder(id: string, now = new Date()): Promise<ScheduleResult> {
  const r = await getReminder(id);
  if (!r) throw new AppError('validation', '알림을 찾을 수 없어요.');
  const item = await getItemStatus(r.itemId);
  if (item?.status !== 'active') throw rejectFor({ ok: false, reason: 'inactive-item' });
  if (r.sourceFieldId) {
    const field = await getField(r.sourceFieldId);
    if (field && !canUseFieldForReminder(field)) throw rejectFor({ ok: false, reason: 'unconfirmed' });
  }
  if (r.scheduledAt <= nowLocal(now)) throw rejectFor({ ok: false, reason: 'past' });
  if (!r.enabled && (await countActiveReminders(nowLocal(now), r.id)) >= MAX_SCHEDULED_REMINDERS) throw rejectFor({ ok: false, reason: 'limit' });

  if (r.notificationId) await notifications.cancel(r.notificationId);
  const os = await scheduleOs(r.scheduledAt, item.title, notificationBody(r.title, r.daysBefore), r.itemId, true);
  await updateReminder(r.id, { enabled: true, notificationId: os.id });
  return { scheduled: os.scheduled, permission: os.permission, failed: os.failed };
}

export interface FieldSyncReport {
  rescheduled: number;
  disabled: number;
}

/**
 * A date field was edited, confirmed or unconfirmed: move or switch off the reminders made from it.
 * Uses the current permission without prompting (this is not a reminder action).
 */
export async function syncRemindersForField(fieldId: string, defaultHour: number, now = new Date()): Promise<FieldSyncReport> {
  const report: FieldSyncReport = { rescheduled: 0, disabled: 0 };
  const linked = await remindersForField(fieldId);
  if (!linked.some((r) => r.enabled)) return report;
  const field = await getField(fieldId);
  if (!field) return report;
  const item = await getItemStatus(field.itemId);
  const plans = planForFieldChange(field, linked, { defaultHour, activeCount: await countActiveReminders(nowLocal(now)), now, itemActive: item?.status === 'active' });
  for (const plan of plans) {
    const r = linked.find((x) => x.id === plan.reminderId)!;
    if (plan.action === 'unchanged') continue;
    if (r.notificationId) await notifications.cancel(r.notificationId);
    if (plan.action === 'disable') {
      await updateReminder(r.id, { enabled: false, notificationId: null });
      report.disabled++;
      continue;
    }
    const os = await scheduleOs(plan.triggerAt, item?.title ?? r.title, notificationBody(r.title, r.daysBefore), r.itemId, false);
    await updateReminder(r.id, { scheduledAt: plan.triggerAt, targetDate: plan.targetDate, notificationId: os.id, timezoneId: deviceTimeZone() });
    report.rescheduled++;
  }
  return report;
}

export function fieldSyncMessage(r: FieldSyncReport): string | null {
  const parts: string[] = [];
  if (r.rescheduled) parts.push(`이 날짜로 만든 알림 ${r.rescheduled}개를 바뀐 날짜로 다시 예약했어요.`);
  if (r.disabled) parts.push(`알림 ${r.disabled}개를 껐어요 (확인 해제·지난 날짜 등). 필요하면 상세에서 다시 만들어 주세요.`);
  return parts.length ? parts.join(' ') : null;
}

export interface ReconcileNotificationsReport {
  rescheduled: number;
  cancelledOrphans: number;
  disabledInactive: number;
}

/**
 * Keeps OS schedule and DB in sync (app start, 알림 tab): re-schedules enabled future reminders
 * whose notification is missing (reinstall/restore/OS cleanup), switches off reminders of items
 * that are no longer active, and cancels OS notifications without a row. Idempotent.
 * Times are local wall-clock values interpreted in the device's current time zone.
 */
export async function reconcileNotifications(now = new Date()): Promise<ReconcileNotificationsReport> {
  const report: ReconcileNotificationsReport = { rescheduled: 0, cancelledOrphans: 0, disabledInactive: 0 };
  try {
    const permission = await notifications.getPermission();
    const reminders = await allEnabledReminders();
    for (const r of reminders) {
      if (r.itemStatus !== 'active') {
        if (r.notificationId) await notifications.cancel(r.notificationId);
        await updateReminder(r.id, { enabled: false, notificationId: null });
        report.disabledInactive++;
      }
    }
    if (permission !== 'granted') return report;
    const scheduled = new Set(await notifications.scheduledIds());
    const known = new Set<string>();
    const nowKey = nowLocal(now);
    for (const r of reminders) {
      if (r.itemStatus !== 'active') continue;
      if (r.notificationId && scheduled.has(r.notificationId)) {
        known.add(r.notificationId);
        continue;
      }
      if (r.scheduledAt <= nowKey) continue;
      const id = await notifications.scheduleAt(r.scheduledAt, r.itemTitle.slice(0, 60), notificationBody(r.title, r.daysBefore), r.itemId).catch((e) => {
        logError('reminder.reconcile.schedule', e);
        return null;
      });
      await updateReminder(r.id, { notificationId: id });
      if (id) {
        known.add(id);
        report.rescheduled++;
      }
    }
    for (const id of scheduled) {
      if (!known.has(id)) {
        await notifications.cancel(id);
        report.cancelledOrphans++;
      }
    }
  } catch (e) {
    logError('reminder.reconcile', e);
  }
  return report;
}
