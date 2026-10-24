import type { ExtractedField, ReminderType } from '@/domain/models';
import { addDays, hasTime, pad2, parseLocal } from '@/utils/dates';

/** iOS keeps at most 64 pending local notifications per app; stay below it. */
export const MAX_SCHEDULED_REMINDERS = 60;

export type ReminderCheck =
  | { ok: true; triggerAt: string }
  | { ok: false; reason: 'unconfirmed' | 'invalid-date' | 'past' | 'limit' };

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
}

/**
 * The single gate for creating a reminder: only confirmed dates, only in the future,
 * and never above the platform's pending-notification budget.
 */
export function checkReminder(req: ReminderRequest): ReminderCheck {
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
  limit: '예약된 알림이 너무 많아요. 지난 알림을 정리한 뒤 다시 시도해 주세요.',
};
