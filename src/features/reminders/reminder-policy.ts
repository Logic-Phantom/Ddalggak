import type { ExtractedField, Reminder, ReminderType } from '@/domain/models';
import { addDays, hasTime, pad2, parseLocal } from '@/utils/dates';

/** iOS keeps at most 64 pending local notifications per app; stay below it. */
export const MAX_SCHEDULED_REMINDERS = 60;

export type ReminderCheck =
  | { ok: true; triggerAt: string }
  | { ok: false; reason: 'unconfirmed' | 'invalid-date' | 'past' | 'limit' | 'inactive-item' };

export interface ReminderRequest {
  /** `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm`. */
  targetDate: string;
  /** Days before the target (0 = on the day). */
  daysBefore: number;
  /** Hour used when the target has no time. */
  defaultHour: number;
  /** The date came from a field the user confirmed, or the user typed it. */
  confirmed: boolean;
  activeCount: number;
  now: Date;
  /** false when the item is not "진행 중" (임시 저장·완료·보관): no reminders there. */
  itemActive?: boolean;
}

/**
 * The single gate for creating a reminder: only confirmed dates, only in the future,
 * and never above the platform's pending-notification budget.
 */
export function checkReminder(req: ReminderRequest): ReminderCheck {
  if (req.itemActive === false) return { ok: false, reason: 'inactive-item' };
  if (!req.confirmed) return { ok: false, reason: 'unconfirmed' };
  const target = parseLocal(req.targetDate);
  if (!target) return { ok: false, reason: 'invalid-date' };
  const day = addDays(req.targetDate.slice(0, 10), -Math.max(0, Math.floor(req.daysBefore)));
  const time = hasTime(req.targetDate) && req.daysBefore === 0 ? req.targetDate.slice(11) : `${pad2(req.defaultHour)}:00`;
  const triggerAt = `${day}T${time}`;
  const trigger = parseLocal(triggerAt);
  if (!trigger) return { ok: false, reason: 'invalid-date' };
  if (trigger.getTime() <= req.now.getTime()) return { ok: false, reason: 'past' };
  if (req.activeCount >= MAX_SCHEDULED_REMINDERS) return { ok: false, reason: 'limit' };
  return { ok: true, triggerAt };
}

export function canUseFieldForReminder(f: Pick<ExtractedField, 'fieldType' | 'userConfirmed' | 'normalizedValue'>): boolean {
  return f.fieldType === 'date' && f.userConfirmed && !!f.normalizedValue && !!parseLocal(f.normalizedValue);
}

export function reminderTypeForRole(role: string | null): ReminderType {
  switch (role) {
    case 'expiry':
      return 'expiry';
    case 'event':
    case 'start':
      return 'event';
    case 'reservation':
      return 'reservation';
    case 'return-deadline':
      return 'return-check';
    case 'warranty-end':
      return 'warranty-check';
    default:
      return 'custom';
  }
}

export const REMINDER_REASON_TEXT: Record<Exclude<ReminderCheck, { ok: true }>['reason'], string> = {
  unconfirmed: '날짜를 먼저 확인해 주세요. 확인한 날짜로만 알림을 만들 수 있어요.',
  'invalid-date': '날짜 형식이 올바르지 않아요. 날짜를 수정해 주세요.',
  past: '이미 지난 시각이에요. 날짜나 알림 시점을 바꿔 주세요.',
  limit: `예약된 알림이 ${MAX_SCHEDULED_REMINDERS}개로 가득 찼어요. 지난 알림이나 필요 없는 알림을 지운 뒤 다시 시도해 주세요.`,
  'inactive-item': '진행 중인 항목에만 알림을 만들 수 있어요. 임시 저장한 항목은 먼저 정리해 주세요.',
};

/** Notification body: label and offset only — never codes, amounts or OCR text. */
export function notificationBody(label: string, daysBefore: number | null): string {
  if (daysBefore == null) return `${label} 알림이에요.`;
  return `${label} ${daysBefore > 0 ? `${daysBefore}일 전` : '오늘'}이에요.`;
}

/**
 * What the app can honestly say about a reminder. Delivery itself is never guaranteed by the OS,
 * so "scheduled" only means the OS currently holds the notification.
 */
export type DeliveryState = 'scheduled' | 'missing' | 'denied' | 'unavailable' | 'not-asked' | 'failed' | 'off' | 'past';

export function deliveryState(
  r: Pick<Reminder, 'enabled' | 'scheduledAt' | 'notificationId'>,
  ctx: { scheduledIds: ReadonlySet<string>; permission: 'granted' | 'denied' | 'undetermined' | 'unavailable'; nowLocal: string },
): DeliveryState {
  if (!r.enabled) return 'off';
  if (r.scheduledAt <= ctx.nowLocal) return 'past';
  if (r.notificationId) return ctx.scheduledIds.has(r.notificationId) ? 'scheduled' : 'missing';
  if (ctx.permission === 'unavailable') return 'unavailable';
  if (ctx.permission === 'denied') return 'denied';
  if (ctx.permission === 'undetermined') return 'not-asked';
  return 'failed';
}

export const DELIVERY_TEXT: Record<DeliveryState, string> = {
  scheduled: '기기 알림 예약됨',
  missing: '기기 예약이 확인되지 않아요 — 다시 예약해 주세요',
  denied: '알림 권한이 꺼져 있어 앱 안에서만 보여요',
  unavailable: '이 실행 환경에서는 기기 알림을 쓸 수 없어요',
  'not-asked': '기기 알림이 아직 예약되지 않았어요',
  failed: '기기 알림 예약에 실패했어요 — 다시 시도해 주세요',
  off: '꺼짐',
  past: '지난 알림',
};

/** States where "다시 예약" can help. */
export function canRetryDelivery(s: DeliveryState): boolean {
  return s === 'missing' || s === 'failed' || s === 'not-asked' || s === 'denied';
}

export type FieldReminderPlan =
  | { reminderId: string; action: 'unchanged' }
  | { reminderId: string; action: 'reschedule'; triggerAt: string; targetDate: string }
  | { reminderId: string; action: 'disable'; reason: Exclude<ReminderCheck, { ok: true }>['reason'] };

/**
 * A confirmed date changed (edited, unconfirmed, re-confirmed): decide per linked reminder.
 * Unconfirmed/invalid dates switch the reminder off instead of keeping a stale notification;
 * the date is never shifted to "the next valid day" on the user's behalf.
 */
export function planForFieldChange(
  field: Pick<ExtractedField, 'fieldType' | 'userConfirmed' | 'normalizedValue'>,
  reminders: Pick<Reminder, 'id' | 'enabled' | 'scheduledAt' | 'targetDate' | 'daysBefore'>[],
  ctx: { defaultHour: number; activeCount: number; now: Date; itemActive: boolean },
): FieldReminderPlan[] {
  return reminders
    .filter((r) => r.enabled)
    .map((r) => {
      if (!canUseFieldForReminder(field)) return { reminderId: r.id, action: 'disable', reason: 'unconfirmed' } as const;
      const target = field.normalizedValue!;
      const check = checkReminder({
        targetDate: target,
        daysBefore: r.daysBefore ?? 0,
        defaultHour: ctx.defaultHour,
        confirmed: true,
        // This reminder is replaced, so it does not count against the budget.
        activeCount: Math.max(0, ctx.activeCount - 1),
        now: ctx.now,
        itemActive: ctx.itemActive,
      });
      if (!check.ok) return { reminderId: r.id, action: 'disable', reason: check.reason } as const;
      if (check.triggerAt === r.scheduledAt && target === r.targetDate) return { reminderId: r.id, action: 'unchanged' } as const;
      return { reminderId: r.id, action: 'reschedule', triggerAt: check.triggerAt, targetDate: target } as const;
    });
}
