import type { ExtractedField } from '@/domain/models';
import { buildArchive, validateArchive } from '@/features/export-import/archive-format';
import { extractFields, mergeReanalysis, type FieldDraft } from '@/features/extraction/field-extraction-service';
import { canTransition, keepsReminders } from '@/features/items/item-lifecycle';
import { canUseFieldForReminder, checkReminder, MAX_SCHEDULED_REMINDERS } from '@/features/reminders/reminder-policy';

const now = new Date(2026, 9, 24, 10, 0);

describe('reminder policy', () => {
  const base = { daysBefore: 0, defaultHour: 9, confirmed: true, activeCount: 0, now };

  it('never schedules from an unconfirmed date', () => {
    expect(checkReminder({ ...base, targetDate: '2026-10-31', confirmed: false })).toEqual({ ok: false, reason: 'unconfirmed' });
  });

  it('uses the default hour for date-only values and the exact time otherwise', () => {
    expect(checkReminder({ ...base, targetDate: '2026-10-31' })).toEqual({ ok: true, triggerAt: '2026-10-31T09:00' });
    expect(checkReminder({ ...base, targetDate: '2026-10-31T18:30' })).toEqual({ ok: true, triggerAt: '2026-10-31T18:30' });
    expect(checkReminder({ ...base, targetDate: '2026-10-31T18:30', daysBefore: 1 })).toEqual({ ok: true, triggerAt: '2026-10-30T09:00' });
  });

  it('crosses month and year boundaries in calendar days', () => {
    expect(checkReminder({ ...base, targetDate: '2027-01-01', daysBefore: 3 })).toEqual({ ok: true, triggerAt: '2026-12-29T09:00' });
    expect(checkReminder({ ...base, targetDate: '2028-03-01', daysBefore: 1 })).toEqual({ ok: true, triggerAt: '2028-02-29T09:00' });
  });

  it('refuses past triggers, invalid dates and the platform limit', () => {
    expect(checkReminder({ ...base, targetDate: '2026-10-24' })).toEqual({ ok: false, reason: 'past' });
    expect(checkReminder({ ...base, targetDate: '2026-10-25', daysBefore: 2 })).toEqual({ ok: false, reason: 'past' });
    expect(checkReminder({ ...base, targetDate: '2026-02-30' })).toEqual({ ok: false, reason: 'invalid-date' });
    expect(checkReminder({ ...base, targetDate: '2026-11-01', activeCount: MAX_SCHEDULED_REMINDERS })).toEqual({ ok: false, reason: 'limit' });
  });

  it('only confirmed date fields can seed a reminder', () => {
    expect(canUseFieldForReminder({ fieldType: 'date', userConfirmed: false, normalizedValue: '2026-10-31' })).toBe(false);
    expect(canUseFieldForReminder({ fieldType: 'date', userConfirmed: true, normalizedValue: '2026-10-31' })).toBe(true);
    expect(canUseFieldForReminder({ fieldType: 'amount', userConfirmed: true, normalizedValue: '1000 KRW' })).toBe(false);
  });
});

describe('item lifecycle', () => {
  it('allows only defined transitions', () => {
    expect(canTransition('draft', 'active')).toBe(true);
    expect(canTransition('draft', 'archived')).toBe(false);
    expect(canTransition('active', 'completed')).toBe(true);
    expect(canTransition('archived', 'active')).toBe(true);
    expect(canTransition('archived', 'completed')).toBe(false);
    expect(keepsReminders('active')).toBe(true);
    expect(keepsReminders('archived')).toBe(false);
  });
});

describe('re-analysis never overwrites user edits', () => {
  const field = (over: Partial<ExtractedField>): ExtractedField => ({
    id: 'f',
    itemId: 'i',
    fieldType: 'date',
    valueText: '',
    normalizedValue: '2026-10-31',
    role: 'expiry',
    confidence: 'low',
    method: 'regex-rule',
    evidenceText: null,
    requiresConfirmation: true,
    userConfirmed: false,
    userEditedAt: null,
    createdAt: '',
    ...over,
  });

  it('keeps confirmed/edited/manual fields and replaces automatic ones', () => {
    const existing = [
      field({ id: 'auto', normalizedValue: '2026-10-30' }),
      field({ id: 'confirmed', normalizedValue: '2026-11-01', userConfirmed: true }),
      field({ id: 'edited', fieldType: 'amount', normalizedValue: '5000 KRW', role: 'total', userEditedAt: '2026-10-24' }),
      field({ id: 'manual', fieldType: 'merchant', normalizedValue: '딸깍상회', role: null, method: 'manual' }),
    ];
    const incoming: FieldDraft[] = [
      { ...field({ normalizedValue: '2026-11-01' }) }, // same as confirmed → dropped
      { ...field({ normalizedValue: '2026-12-01' }) }, // new → added
    ];
    const merged = mergeReanalysis(existing, incoming);
    expect(merged.map((f) => ('id' in f ? f.id : f.normalizedValue))).toEqual(['confirmed', 'edited', 'manual', 'f']);
    expect(merged.some((f) => f.normalizedValue === '2026-10-30')).toBe(false);
  });
});

describe('field extraction', () => {
  it('marks every inferred/unknown-role date as requiring confirmation', () => {
    const r = extractFields({ text: '10월 31일 모임', method: 'shared-payload', today: now });
    const d = r.fields.find((f) => f.fieldType === 'date');
    expect(d?.requiresConfirmation).toBe(true);
    expect(d?.userConfirmed).toBe(false);
  });

  it('caps OCR-derived confidence at medium', () => {
    const r = extractFields({ text: '유효기간 2026.10.31까지', method: 'ocr', today: now });
    expect(r.fields.find((f) => f.fieldType === 'date')?.confidence).toBe('medium');
  });

  it('masks codes inside the suggested title (titles appear in notifications)', () => {
    const r = extractFields({ text: '아이스 라떼 쿠폰번호: 9988-7766-5544 유효기간 2026.12.31까지', method: 'shared-payload', today: now });
    expect(r.titleSuggestion).not.toContain('9988-7766-5544');
    expect(r.fields.find((f) => f.fieldType === 'coupon-code')?.valueText).toBe('9988-7766-5544');
  });

  it('suggests a title and keeps the shared URL', () => {
    const r = extractFields({ text: '을지로 노가리 골목 https://map.naver.com/p/123', method: 'shared-payload', today: now });
    expect(r.titleSuggestion).toBe('을지로 노가리 골목');
    expect(r.sourceUrl).toBe('https://map.naver.com/p/123');
    expect(r.categories[0].category).toBe('place');
  });
});

describe('export archive', () => {
  it('accepts its own output', () => {
    const archive = buildArchive([
      {
        id: 'i1',
        title: '쿠폰',
        category: 'coupon',
        status: 'active',
        sourceType: 'manual',
        sourceUrl: null,
        domain: null,
        displayText: null,
        ocrText: null,
        userNote: null,
        tags: ['카페'],
        needsReview: false,
        pinned: false,
        capturedAt: '2026-10-24T00:00:00.000Z',
        createdAt: '2026-10-24T00:00:00.000Z',
        updatedAt: '2026-10-24T00:00:00.000Z',
        fields: [],
        reminders: [],
      },
    ]);
    expect(validateArchive(JSON.parse(JSON.stringify(archive)))).toEqual([]);
  });

  it('rejects foreign files, bad versions, duplicate ids and bad dates', () => {
    expect(validateArchive(null)).toHaveLength(1);
    expect(validateArchive({ format: 'other', schemaVersion: 1, items: [] })[0]).toContain('KeepOn');
    expect(validateArchive({ format: 'ddalggak-export', schemaVersion: 99, items: [] })[0]).toContain('버전');
    const bad = {
      format: 'ddalggak-export',
      schemaVersion: 1,
      items: [
        { id: 'a', title: 't', category: 'coupon', status: 'active', tags: [], fields: [{ id: 'f', fieldType: 'date', valueText: 'x', normalizedValue: '2026-02-30' }], reminders: [], sourceUrl: null, userNote: null, displayText: null, ocrText: null },
        { id: 'a', title: 't', category: 'nope', status: 'active', tags: [], fields: [], reminders: [], sourceUrl: null, userNote: null, displayText: null, ocrText: null },
      ],
    };
    const errors = validateArchive(bad);
    expect(errors.some((e) => e.includes('잘못된 날짜'))).toBe(true);
    expect(errors.some((e) => e.includes('중복'))).toBe(true);
    expect(errors.some((e) => e.includes('분류'))).toBe(true);
  });
});
