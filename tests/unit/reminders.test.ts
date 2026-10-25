/**
 * Reminder service against an in-memory "OS scheduler" and in-memory repositories. Proves the
 * DB/OS bookkeeping (no duplicates, cancel-before-reschedule, honest states). Real delivery on a
 * phone is a device test (docs/TESTING.md).
 */
import type { ExtractedField, ItemStatus, Reminder } from '@/domain/models';
import { checkReminder, deliveryState, MAX_SCHEDULED_REMINDERS, notificationBody, planForFieldChange } from '@/features/reminders/reminder-policy';
import { createReminder, reconcileNotifications, rescheduleReminder, syncRemindersForField } from '@/features/reminders/reminder-service';
import * as webNotifications from '@/infrastructure/notifications/local-notifications.web';

const mockOs = {
  permission: 'granted' as 'granted' | 'denied' | 'undetermined' | 'unavailable',
  scheduled: new Map<string, { at: string; title: string; body: string }>(),
  failNext: false,
  seq: 0,
};

jest.mock('@/infrastructure/notifications/local-notifications', () => ({
  getPermission: jest.fn(async () => mockOs.permission),
  requestPermission: jest.fn(async () => (mockOs.permission === 'undetermined' ? 'granted' : mockOs.permission)),
  scheduleAt: jest.fn(async (at: string, title: string, body: string) => {
    if (mockOs.failNext) {
      mockOs.failNext = false;
      throw new Error('alarm manager refused');
    }
    const id = `n${++mockOs.seq}`;
    mockOs.scheduled.set(id, { at, title, body });
    return id;
  }),
  cancel: jest.fn(async (id: string) => {
    mockOs.scheduled.delete(id);
  }),
  scheduledIds: jest.fn(async () => [...mockOs.scheduled.keys()]),
}));

const mockDb = {
  reminders: new Map<string, Reminder>(),
  items: new Map<string, { status: ItemStatus; title: string }>(),
  fields: new Map<string, ExtractedField>(),
};

jest.mock('@/features/reminders/reminder-repository', () => ({
  insertReminder: jest.fn(async (r: Reminder) => void mockDb.reminders.set(r.id, { ...r })),
  getReminder: jest.fn(async (id: string) => (mockDb.reminders.has(id) ? { ...mockDb.reminders.get(id)! } : null)),
  updateReminder: jest.fn(async (id: string, patch: Partial<Reminder>) => {
    const r = mockDb.reminders.get(id)!;
    mockDb.reminders.set(id, { ...r, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) });
  }),
  deleteReminderRow: jest.fn(async (id: string) => void mockDb.reminders.delete(id)),
  remindersForField: jest.fn(async (fieldId: string) => [...mockDb.reminders.values()].filter((r) => r.sourceFieldId === fieldId).map((r) => ({ ...r }))),
  countActiveReminders: jest.fn(async (now: string, excludeId?: string) => [...mockDb.reminders.values()].filter((r) => r.enabled && r.scheduledAt > now && r.id !== excludeId).length),
  getItemStatus: jest.fn(async (id: string) => mockDb.items.get(id) ?? null),
  allEnabledReminders: jest.fn(async () =>
    [...mockDb.reminders.values()].filter((r) => r.enabled).map((r) => ({ ...r, itemTitle: mockDb.items.get(r.itemId)!.title, itemStatus: mockDb.items.get(r.itemId)!.status })),
  ),
}));

jest.mock('@/features/items/item-repository', () => ({
  getField: jest.fn(async (id: string) => mockDb.fields.get(id) ?? null),
}));

const now = new Date(2026, 9, 24, 10, 0);

function dateField(over: Partial<ExtractedField> = {}): ExtractedField {
  return {
    id: 'f1',
    itemId: 'i1',
    fieldType: 'date',
    valueText: '2026.11.15',
    normalizedValue: '2026-11-15',
    role: 'event',
    confidence: 'medium',
    method: 'ocr',
    evidenceText: null,
    requiresConfirmation: true,
    userConfirmed: true,
    userEditedAt: null,
    createdAt: '',
    ...over,
  };
}

const input = { itemId: 'i1', itemTitle: '딸깍 콘서트', targetDate: '2026-11-15', daysBefore: 1, defaultHour: 9, confirmed: true, reminderType: 'event' as const, label: '행사일', sourceFieldId: 'f1' };

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockOs.permission = 'granted';
  mockOs.scheduled.clear();
  mockOs.failNext = false;
  mockDb.reminders.clear();
  mockDb.items.clear();
  mockDb.fields.clear();
  mockDb.items.set('i1', { status: 'active', title: '딸깍 콘서트' });
  mockDb.fields.set('f1', dateField());
});

describe('reminder policy', () => {
  it('blocks reminders on items that are not active (임시 저장·완료·보관)', () => {
    expect(checkReminder({ targetDate: '2026-11-15', daysBefore: 0, defaultHour: 9, confirmed: true, activeCount: 0, now, itemActive: false })).toEqual({ ok: false, reason: 'inactive-item' });
  });

  it('never puts codes or amounts into the notification body', () => {
    expect(notificationBody('쿠폰 만료일', 1)).toBe('쿠폰 만료일 1일 전이에요.');
    expect(notificationBody('행사일', 0)).toBe('행사일 오늘이에요.');
    expect(notificationBody('알림', null)).toBe('알림 알림이에요.');
  });

  it('describes delivery honestly', () => {
    const ctx = { scheduledIds: new Set(['n1']), permission: 'granted' as const, nowLocal: '2026-10-24T10:00' };
    const r = { enabled: true, scheduledAt: '2026-11-14T09:00', notificationId: 'n1' };
    expect(deliveryState(r, ctx)).toBe('scheduled');
    expect(deliveryState({ ...r, notificationId: 'gone' }, ctx)).toBe('missing');
    expect(deliveryState({ ...r, notificationId: null }, ctx)).toBe('failed');
    expect(deliveryState({ ...r, notificationId: null }, { ...ctx, permission: 'denied' })).toBe('denied');
    expect(deliveryState({ ...r, notificationId: null }, { ...ctx, permission: 'unavailable' })).toBe('unavailable');
    expect(deliveryState({ ...r, enabled: false }, ctx)).toBe('off');
    expect(deliveryState({ ...r, scheduledAt: '2026-10-01T09:00' }, ctx)).toBe('past');
  });

  it('plans moves and switch-offs when the source date changes, never shifting dates itself', () => {
    const r = { id: 'r1', enabled: true, scheduledAt: '2026-11-14T09:00', targetDate: '2026-11-15', daysBefore: 1 };
    const ctx = { defaultHour: 9, activeCount: 1, now, itemActive: true };
    expect(planForFieldChange(dateField(), [r], ctx)).toEqual([{ reminderId: 'r1', action: 'unchanged' }]);
    expect(planForFieldChange(dateField({ normalizedValue: '2026-11-20' }), [r], ctx)).toEqual([{ reminderId: 'r1', action: 'reschedule', triggerAt: '2026-11-19T09:00', targetDate: '2026-11-20' }]);
    expect(planForFieldChange(dateField({ userConfirmed: false }), [r], ctx)).toEqual([{ reminderId: 'r1', action: 'disable', reason: 'unconfirmed' }]);
    expect(planForFieldChange(dateField({ normalizedValue: '2026-10-24' }), [r], ctx)).toEqual([{ reminderId: 'r1', action: 'disable', reason: 'past' }]);
    // The reminder being moved does not count against the budget.
    expect(planForFieldChange(dateField({ normalizedValue: '2026-11-20' }), [r], { ...ctx, activeCount: MAX_SCHEDULED_REMINDERS })[0].action).toBe('reschedule');
  });
});

describe('reminder service (DB ↔ OS)', () => {
  it('refuses unconfirmed dates and pending items without touching the OS', async () => {
    await expect(createReminder({ ...input, confirmed: false }, now)).rejects.toMatchObject({ code: 'validation' });
    mockDb.items.set('i1', { status: 'pending', title: 'x' });
    await expect(createReminder(input, now)).rejects.toMatchObject({ code: 'validation' });
    expect(mockOs.scheduled.size).toBe(0);
    expect(mockDb.reminders.size).toBe(0);
  });

  it('schedules a confirmed date in the OS and links it to the field', async () => {
    const res = await createReminder(input, now);
    expect(res).toMatchObject({ scheduled: true, failed: false });
    expect(mockOs.scheduled.size).toBe(1);
    expect([...mockOs.scheduled.values()][0]).toMatchObject({ at: '2026-11-14T09:00', body: '행사일 1일 전이에요.' });
    expect(mockDb.reminders.get(res.reminder.id)).toMatchObject({ sourceFieldId: 'f1', targetDate: '2026-11-15', daysBefore: 1 });
  });

  it('saves but never claims "scheduled" when permission is denied or the OS fails', async () => {
    mockOs.permission = 'denied';
    const denied = await createReminder(input, now);
    expect(denied).toMatchObject({ scheduled: false, failed: false, permission: 'denied' });
    expect(mockDb.reminders.get(denied.reminder.id)!.notificationId).toBeNull();

    mockOs.permission = 'granted';
    mockOs.failNext = true;
    const failed = await createReminder({ ...input, sourceFieldId: null }, now);
    expect(failed).toMatchObject({ scheduled: false, failed: true });
    const ctx = { scheduledIds: new Set(mockOs.scheduled.keys()), permission: 'granted' as const, nowLocal: '2026-10-24T10:00' };
    expect(deliveryState(mockDb.reminders.get(failed.reminder.id)!, ctx)).toBe('failed');
  });

  it('works where notifications are unavailable (Expo Go / web) without crashing', async () => {
    mockOs.permission = 'unavailable';
    const res = await createReminder(input, now);
    expect(res).toMatchObject({ scheduled: false, permission: 'unavailable' });
    await expect(webNotifications.getPermission()).resolves.toBe('unavailable');
    await expect(webNotifications.cancel('x')).resolves.toBeUndefined();
    await expect(webNotifications.scheduledIds()).resolves.toEqual([]);
  });

  it('moves the OS notification when the date is edited, and switches it off when unconfirmed', async () => {
    await createReminder(input, now);
    mockDb.fields.set('f1', dateField({ normalizedValue: '2026-11-20', userEditedAt: '2026-10-24' }));
    expect(await syncRemindersForField('f1', 9, now)).toEqual({ rescheduled: 1, disabled: 0 });
    expect([...mockOs.scheduled.values()].map((n) => n.at)).toEqual(['2026-11-19T09:00']);

    // Repeating the sync does not stack notifications.
    await syncRemindersForField('f1', 9, now);
    expect(mockOs.scheduled.size).toBe(1);

    mockDb.fields.set('f1', dateField({ normalizedValue: '2026-11-20', userConfirmed: false }));
    expect(await syncRemindersForField('f1', 9, now)).toEqual({ rescheduled: 0, disabled: 1 });
    expect(mockOs.scheduled.size).toBe(0);
    expect([...mockDb.reminders.values()][0]).toMatchObject({ enabled: false, notificationId: null });
  });

  it('re-enables only on an active item with a still-confirmed date, keeping the stored time', async () => {
    const { reminder } = await createReminder(input, now);
    mockDb.reminders.set(reminder.id, { ...mockDb.reminders.get(reminder.id)!, enabled: false, notificationId: null });
    mockOs.scheduled.clear();

    mockDb.items.set('i1', { status: 'archived', title: '딸깍 콘서트' });
    await expect(rescheduleReminder(reminder.id, now)).rejects.toMatchObject({ code: 'validation' });

    mockDb.items.set('i1', { status: 'active', title: '딸깍 콘서트' });
    mockDb.fields.set('f1', dateField({ userConfirmed: false }));
    await expect(rescheduleReminder(reminder.id, now)).rejects.toMatchObject({ code: 'validation' });

    mockDb.fields.set('f1', dateField());
    expect(await rescheduleReminder(reminder.id, now)).toMatchObject({ scheduled: true });
    expect(mockDb.reminders.get(reminder.id)).toMatchObject({ enabled: true, scheduledAt: '2026-11-14T09:00' });
    expect(mockOs.scheduled.size).toBe(1);

    // Past reminders are not moved to another day.
    await expect(rescheduleReminder(reminder.id, new Date(2026, 10, 20))).rejects.toMatchObject({ code: 'validation' });
  });

  it('reconciles idempotently: restores lost notifications, cancels orphans, switches off inactive items', async () => {
    const a = await createReminder(input, now);
    mockDb.items.set('i2', { status: 'completed', title: '끝난 일' });
    mockDb.reminders.set('r-done', { ...a.reminder, id: 'r-done', itemId: 'i2', notificationId: 'n-old' });
    mockOs.scheduled.set('n-old', { at: '2026-11-01T09:00', title: '', body: '' });
    mockOs.scheduled.set('n-orphan', { at: '2026-11-02T09:00', title: '', body: '' });
    mockOs.scheduled.delete(a.reminder.notificationId!); // e.g. OS cleared it after a restore

    const first = await reconcileNotifications(now);
    expect(first).toEqual({ rescheduled: 1, cancelledOrphans: 1, disabledInactive: 1 });
    expect(mockOs.scheduled.size).toBe(1);
    expect(mockDb.reminders.get('r-done')).toMatchObject({ enabled: false, notificationId: null });

    expect(await reconcileNotifications(now)).toEqual({ rescheduled: 0, cancelledOrphans: 0, disabledInactive: 0 });
    expect(mockOs.scheduled.size).toBe(1);
  });
});
