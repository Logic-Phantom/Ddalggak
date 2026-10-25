/**
 * OCR provider contract + capture pipeline (quick save / review) with storage and DB mocked.
 * The OCR texts below are hand-written fixtures, not real engine output: these tests check the
 * wiring and policies, not recognition accuracy (that needs a device, see docs/TESTING.md).
 */
import { DEFAULT_SETTINGS, type AppSettings, type ExtractedField, type ItemDetail } from '@/domain/models';
import { analyzeAttachments, captureItem, summarizeOcr } from '@/features/capture/capture-service';
import type { CaptureInput } from '@/features/incoming-share/types';
import { canTransition, keepsReminders } from '@/features/items/item-lifecycle';
import type { OcrProvider } from '@/features/ocr/contracts';
import { createMlKitProvider } from '@/features/ocr/mlkit-provider';
import { failureReason, runOcr, setOcrProvider } from '@/features/ocr/ocr-service';
import { unavailableOcrProvider } from '@/features/ocr/unavailable-provider';

jest.mock('../../modules/ddalggak-ocr', () => ({ DdalggakOcr: null }));

const PNG_HEAD = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

jest.mock('@/infrastructure/file-storage/app-files', () => ({
  importFile: jest.fn(async (_src: string, itemId: string, name: string) => ({ uri: `file:///app/attachments/${itemId}/${name}`, size: 1000 })),
  readFileHead: jest.fn(async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  fileSize: jest.fn(() => 1000),
  fileExists: jest.fn(() => true),
  deleteFile: jest.fn(),
  deleteItemFiles: jest.fn(),
}));

jest.mock('@/features/items/item-repository', () => ({
  insertItem: jest.fn(async () => {}),
  getItem: jest.fn(),
  replaceAutomaticFields: jest.fn(async () => {}),
  updateItem: jest.fn(async () => {}),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const files = require('@/infrastructure/file-storage/app-files') as Record<string, jest.Mock>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const repo = require('@/features/items/item-repository') as Record<string, jest.Mock>;

const now = new Date(2026, 9, 24, 10, 0);
const settings: AppSettings = { ...DEFAULT_SETTINGS };
const image: CaptureInput = { kind: 'file', uri: 'content://media/1', mimeType: 'image/png', name: 'coupon.png', size: 1000, sourceType: 'shared-image' };
const pdf: CaptureInput = { kind: 'file', uri: 'content://docs/1', mimeType: 'application/pdf', name: 'ticket.pdf', size: 1000, sourceType: 'shared-document' };

function fakeProvider(text: string | Error, opts: { pdf?: boolean } = {}): OcrProvider & { recognize: jest.Mock; recognizeDocument?: jest.Mock } {
  const run = jest.fn(async () => {
    if (text instanceof Error) throw text;
    return { text, lines: text.split('\n').map((t) => ({ text: t })), engine: 'fake', durationMs: 1 };
  });
  return { id: 'fake', isAvailable: async () => true, recognize: run, ...(opts.pdf ? { recognizeDocument: run } : {}) };
}

function inserted() {
  return repo.insertItem.mock.calls.at(-1)![0] as { item: ItemDetail; fields: ExtractedField[]; attachments: unknown[] };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  files.readFileHead.mockResolvedValue(PNG_HEAD);
  setOcrProvider(null);
});

describe('OCR provider contract', () => {
  it('returns done / empty and never fakes text', async () => {
    setOcrProvider(fakeProvider('유효기간 2026.12.31까지'));
    expect((await runOcr('file:///a.png', 'image/png')).status).toBe('done');
    setOcrProvider(fakeProvider('   \n '));
    expect((await runOcr('file:///a.png', 'image/png')).status).toBe('empty');
  });

  it('turns engine errors into a reason instead of throwing', async () => {
    setOcrProvider(fakeProvider(Object.assign(new Error('x'), { code: 'ERR_OCR_MEMORY' })));
    expect(await runOcr('file:///a.png', 'image/png')).toEqual({ status: 'failed', reason: 'memory' });
    expect(failureReason({ code: 'ERR_OCR_PDF_PROTECTED' })).toBe('pdf-protected');
    expect(failureReason({ code: 'ERR_OCR_DECODE' })).toBe('file');
    expect(failureReason(new Error('anything'))).toBe('engine');
  });

  it('times out instead of hanging the capture', async () => {
    setOcrProvider({ id: 'slow', isAvailable: async () => true, recognize: () => new Promise(() => {}) });
    expect(await runOcr('file:///a.png', 'image/png', 10)).toEqual({ status: 'failed', reason: 'timeout' });
  });

  it('rejects unsupported inputs and reports a missing engine honestly', async () => {
    setOcrProvider(fakeProvider('x'));
    expect((await runOcr('file:///a.txt', 'text/plain')).status).toBe('unsupported-type');
    expect((await runOcr('file:///a.pdf', 'application/pdf')).status).toBe('unsupported-type'); // engine without PDF support
    setOcrProvider(unavailableOcrProvider);
    expect((await runOcr('file:///a.png', 'image/png')).status).toBe('unavailable');
  });

  it('uses the document path for PDFs when the engine supports it', async () => {
    const p = fakeProvider('예매번호: T-2026-1234', { pdf: true });
    setOcrProvider(p);
    expect((await runOcr('file:///a.pdf', 'application/pdf')).status).toBe('done');
    expect(p.recognizeDocument).toHaveBeenCalledWith('file:///a.pdf', expect.objectContaining({ maxPages: 3 }));
  });

  it('falls back to unavailable when the native module is not in the build', async () => {
    expect(createMlKitProvider(null)).toBeNull();
    const native = {
      isAvailable: () => true,
      recognizeImage: jest.fn(async () => ({ text: 'A', lines: [{ text: 'A', box: null }], engine: 'mlkit', engineVersion: '1', durationMs: 3, pageCount: 1, pagesRead: 1 })),
      recognizePdf: jest.fn(),
    };
    const p = createMlKitProvider(native)!;
    const r = await p.recognize('file:///a.png', { languageHints: ['ko'] });
    expect(r.lines[0]).toEqual({ text: 'A', box: undefined });
    expect(native.recognizeImage).toHaveBeenCalledWith('file:///a.png', expect.any(Number));
  });

  it('summarizes several files', () => {
    expect(summarizeOcr([])).toEqual({ ocr: 'not-needed' });
    expect(summarizeOcr([{ status: 'done', result: { text: 'a', lines: [], engine: 'f', durationMs: 1 } }, { status: 'failed', reason: 'file' }])).toEqual({ ocr: 'partial' });
    expect(summarizeOcr([{ status: 'failed', reason: 'pdf-protected' }])).toEqual({ ocr: 'failed', reason: 'pdf-protected' });
    expect(summarizeOcr([{ status: 'unavailable' }])).toEqual({ ocr: 'unavailable' });
  });
});

describe('capture → OCR → extraction', () => {
  it('feeds OCR text into the Korean rules as unconfirmed candidates (no auto-confirm)', async () => {
    setOcrProvider(fakeProvider('딸깍카페 아메리카노 교환권\n쿠폰번호: 9988-7766-5544\n유효기간 2026.12.31까지\n결제금액 4,500원'));
    const out = await captureItem([image], settings, 'review', now);
    expect(out.ocr).toBe('done');
    const { item, fields } = inserted();
    expect(item.status).toBe('draft');
    const date = fields.find((f) => f.fieldType === 'date')!;
    expect(date).toMatchObject({ normalizedValue: '2026-12-31', role: 'expiry', method: 'ocr', userConfirmed: false });
    expect(date.confidence).not.toBe('high');
    expect(fields.find((f) => f.fieldType === 'coupon-code')?.valueText).toBe('9988-7766-5544');
    expect(fields.find((f) => f.fieldType === 'amount')?.normalizedValue).toBe('4500 KRW');
    expect(fields.every((f) => !f.userConfirmed)).toBe(true);
    expect(item.title).not.toContain('9988-7766-5544');
    expect(item.ocrText).toContain('유효기간');
  });

  it('never turns OTP/password lines from OCR into codes', async () => {
    setOcrProvider(fakeProvider('[딸깍] 인증번호 482913 를 입력하세요\n비밀번호: 1234abcd'));
    await captureItem([image], settings, 'review', now);
    const codes = inserted().fields.filter((f) => ['coupon-code', 'order-number', 'reservation-number', 'ticket-number'].includes(f.fieldType));
    expect(codes).toEqual([]);
  });

  it('respects "OCR 원문 저장" off', async () => {
    setOcrProvider(fakeProvider('유효기간 2026.12.31까지'));
    await captureItem([image], { ...settings, storeOcrText: false }, 'review', now);
    expect(inserted().item.ocrText).toBeNull();
    expect(inserted().fields.some((f) => f.method === 'ocr')).toBe(true);
  });

  it('keeps the original and the typed text when OCR fails', async () => {
    setOcrProvider(fakeProvider(Object.assign(new Error('boom'), { code: 'ERR_OCR_ENGINE' })));
    const typed: CaptureInput = { kind: 'text', text: '메모: 다음 주 반납', sourceType: 'manual' };
    const out = await captureItem([typed, image], settings, 'review', now);
    expect(out).toMatchObject({ ocr: 'failed', ocrReason: 'engine' });
    const { item, attachments } = inserted();
    expect(item.displayText).toBe('메모: 다음 주 반납');
    expect(attachments).toHaveLength(1);
    expect(files.deleteItemFiles).not.toHaveBeenCalled();
  });

  it('does not run OCR when the user turned it off', async () => {
    const p = fakeProvider('x');
    setOcrProvider(p);
    const out = await captureItem([image], { ...settings, ocrEnabled: false }, 'review', now);
    expect(out.ocr).toBe('disabled');
    expect(p.recognize).not.toHaveBeenCalled();
  });

  it('OCRs PDFs through the document path', async () => {
    files.readFileHead.mockResolvedValueOnce(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]));
    setOcrProvider(fakeProvider('공연일 2026년 11월 15일 19:00\n예매번호: T-2026-1234', { pdf: true }));
    const out = await captureItem([pdf], settings, 'review', now);
    expect(out.ocr).toBe('done');
    expect(inserted().fields.find((f) => f.fieldType === 'date')?.normalizedValue).toBe('2026-11-15T19:00');
  });
});

describe('quick save (임시 저장)', () => {
  it('saves text as a pending item with unconfirmed candidates only', async () => {
    const out = await captureItem([{ kind: 'text', text: '11월 2일 저녁 7시 예약, 예약번호 R1234', sourceType: 'manual' }], settings, 'quick', now);
    expect(out.ocr).toBe('not-needed');
    const { item, fields } = inserted();
    expect(item).toMatchObject({ status: 'pending', needsReview: true });
    expect(fields.some((f) => f.fieldType === 'date')).toBe(true);
    expect(fields.every((f) => !f.userConfirmed)).toBe(true);
  });

  it('keeps the image and defers OCR when originals are kept', async () => {
    const p = fakeProvider('x');
    setOcrProvider(p);
    const out = await captureItem([image], settings, 'quick', now);
    expect(out.ocr).toBe('deferred');
    expect(p.recognize).not.toHaveBeenCalled();
    expect(inserted().attachments).toHaveLength(1);
  });

  it('runs OCR right away when originals are not kept (the copy is deleted)', async () => {
    const p = fakeProvider('유효기간 2026.12.31까지');
    setOcrProvider(p);
    const out = await captureItem([image], { ...settings, retainAttachments: false }, 'quick', now);
    expect(out.ocr).toBe('done');
    expect(p.recognize).toHaveBeenCalledTimes(1);
    expect(inserted().attachments).toHaveLength(0);
    expect(files.deleteFile).toHaveBeenCalled();
  });

  it('a second tap on the same capture does not create a second item', async () => {
    let release!: () => void;
    repo.insertItem.mockImplementationOnce(() => new Promise<void>((r) => (release = r)));
    const input: CaptureInput[] = [{ kind: 'text', text: '쿠폰 9988', sourceType: 'manual' }];
    const first = captureItem(input, settings, 'quick', now);
    await expect(captureItem(input, settings, 'quick', now)).rejects.toMatchObject({ code: 'validation' });
    await new Promise((r) => setTimeout(r, 0));
    release();
    await first;
    expect(repo.insertItem).toHaveBeenCalledTimes(1);
    // Afterwards the same content can be saved again on purpose (different captures are never merged).
    await captureItem(input, settings, 'quick', now);
    expect(repo.insertItem).toHaveBeenCalledTimes(2);
  });

  it('removes copied files when the DB write fails (no orphan files)', async () => {
    repo.insertItem.mockRejectedValueOnce(new Error('disk full'));
    await expect(captureItem([image], settings, 'quick', now)).rejects.toMatchObject({ code: 'storage-failed' });
    expect(files.deleteItemFiles).toHaveBeenCalledTimes(1);
  });

  it('is a separate status that never keeps reminders and can only become active', () => {
    expect(canTransition('draft', 'pending')).toBe(true);
    expect(canTransition('pending', 'active')).toBe(true);
    expect(canTransition('pending', 'archived')).toBe(false);
    expect(canTransition('pending', 'completed')).toBe(false);
    expect(keepsReminders('pending')).toBe(false);
  });
});

describe('later OCR (이미지 글자 읽기 / 다시 시도)', () => {
  const base: ItemDetail = {
    id: 'i1',
    title: '이미지 메모',
    category: 'other',
    status: 'pending',
    sourceType: 'shared-image',
    sourceUrl: null,
    domain: null,
    displayText: null,
    ocrText: null,
    userNote: null,
    tags: [],
    needsReview: true,
    pinned: false,
    capturedAt: now.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    schemaVersion: 1,
    fields: [],
    reminders: [],
    attachments: [{ id: 'a1', itemId: 'i1', localUri: 'file:///app/a.png', originalName: null, mimeType: 'image/png', sizeBytes: 1, width: null, height: null, storageMode: 'retained', createdAt: '' }],
  };
  const userDate: ExtractedField = {
    id: 'f-user',
    itemId: 'i1',
    fieldType: 'date',
    valueText: '2026.12.30',
    normalizedValue: '2026-12-30',
    role: 'expiry',
    confidence: 'high',
    method: 'manual',
    evidenceText: null,
    requiresConfirmation: false,
    userConfirmed: true,
    userEditedAt: '2026-10-24',
    createdAt: '',
  };

  it('adds OCR candidates without touching what the user confirmed or typed', async () => {
    repo.getItem.mockResolvedValue({ ...base, fields: [userDate] });
    setOcrProvider(fakeProvider('유효기간 2026.12.31까지\n결제금액 4,500원'));
    const r = await analyzeAttachments('i1', settings);
    expect(r.ocr).toBe('done');
    const fresh = repo.replaceAutomaticFields.mock.calls[0][1] as ExtractedField[];
    expect(fresh.some((f) => f.id === 'f-user')).toBe(false);
    expect(fresh.find((f) => f.fieldType === 'date')).toMatchObject({ normalizedValue: '2026-12-31', userConfirmed: false, method: 'ocr' });
    expect(repo.updateItem).toHaveBeenCalledWith('i1', expect.objectContaining({ ocrText: expect.stringContaining('유효기간') }));
  });

  it('does not store OCR text when the setting is off, and reports a missing file', async () => {
    repo.getItem.mockResolvedValue(base);
    setOcrProvider(fakeProvider('유효기간 2026.12.31까지'));
    await analyzeAttachments('i1', { ...settings, storeOcrText: false });
    expect(repo.updateItem.mock.calls[0][1]).not.toHaveProperty('ocrText');

    files.fileExists.mockReturnValueOnce(false);
    expect(await analyzeAttachments('i1', settings)).toMatchObject({ ocr: 'failed', reason: 'file', added: 0 });
  });
});
