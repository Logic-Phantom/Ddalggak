/**
 * Backup (export/import) and "delete all". File system, DB and notifications are mocked; the
 * attachment bytes are a few synthetic PNG-header bytes, not real user files.
 */
import type { ItemDetail } from '@/domain/models';
import { buildArchive, selectAttachmentsForExport, validateArchive, type Archive, type ArchiveItem } from '@/features/export-import/archive-format';
import { buildFullArchive, importFromFile } from '@/features/export-import/export-service';
import { planImport } from '@/features/export-import/import-plan';
import { deleteAllData } from '@/features/items/item-service';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const PNG_B64 = PNG.toString('base64');
const PNG_SHA = 'a'.repeat(64);

const mockTx = { calls: 0, fail: false };
jest.mock('@/infrastructure/database/database', () => ({
  getDb: jest.fn(async () => ({
    withTransactionAsync: async (fn: () => Promise<void>) => {
      mockTx.calls++;
      if (mockTx.fail) throw new Error('constraint failed');
      await fn();
    },
  })),
  wipeAllTables: jest.fn(async () => {}),
}));

const mockFiles = { text: '', written: [] as string[] };
jest.mock('@/infrastructure/file-storage/app-files', () => ({
  readText: jest.fn(async () => mockFiles.text),
  writeCacheText: jest.fn(async () => 'file:///cache/x.json'),
  writeAttachmentBase64: jest.fn(async (itemId: string, name: string) => {
    const uri = `file:///app/attachments/${itemId}/${name}`;
    mockFiles.written.push(uri);
    return uri;
  }),
  sha256File: jest.fn(async () => 'a'.repeat(64)),
  readBase64: jest.fn(async () => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]).toString('base64')),
  readFileHead: jest.fn(async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  fileSize: jest.fn(() => 12),
  fileExists: jest.fn(() => true),
  deleteItemFiles: jest.fn(),
  deleteAllAppFiles: jest.fn(),
  deleteFile: jest.fn(),
  listAttachmentFolders: jest.fn(() => []),
}));

jest.mock('@/features/items/item-repository', () => ({
  allItemIds: jest.fn(async () => []),
  getItem: jest.fn(),
  insertItemRows: jest.fn(async () => {}),
  setTagsRows: jest.fn(async () => {}),
  getField: jest.fn(),
}));
jest.mock('@/features/reminders/reminder-repository', () => ({ insertReminder: jest.fn(async () => {}) }));
jest.mock('@/infrastructure/notifications/local-notifications', () => ({ cancelAll: jest.fn(async () => {}), cancel: jest.fn(async () => {}) }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => {}) }));

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('@/infrastructure/file-storage/app-files') as Record<string, jest.Mock>;
const repo = require('@/features/items/item-repository') as Record<string, jest.Mock>;
const remRepo = require('@/features/reminders/reminder-repository') as Record<string, jest.Mock>;
const database = require('@/infrastructure/database/database') as Record<string, jest.Mock>;
const notifications = require('@/infrastructure/notifications/local-notifications') as Record<string, jest.Mock>;
/* eslint-enable @typescript-eslint/no-require-imports */

function archiveItem(over: Partial<ArchiveItem> = {}): ArchiveItem {
  return {
    id: 'i1',
    title: '콘서트 티켓',
    category: 'ticket',
    status: 'active',
    sourceType: 'shared-image',
    sourceUrl: null,
    domain: null,
    displayText: null,
    ocrText: null,
    userNote: null,
    tags: ['공연'],
    needsReview: false,
    pinned: false,
    capturedAt: '2026-10-24T00:00:00.000Z',
    createdAt: '2026-10-24T00:00:00.000Z',
    updatedAt: '2026-10-24T00:00:00.000Z',
    fields: [{ id: 'f1', fieldType: 'date', valueText: '2026.11.15', normalizedValue: '2026-11-15', role: 'event', confidence: 'medium', method: 'ocr', evidenceText: null, requiresConfirmation: true, userConfirmed: true, userEditedAt: null, createdAt: '' }],
    reminders: [{ id: 'r1', title: '행사일', scheduledAt: '2026-11-14T09:00', timezoneId: 'Asia/Seoul', reminderType: 'event', sourceFieldId: 'f1', targetDate: '2026-11-15', daysBefore: 1, enabled: true, completedAt: null, createdAt: '', updatedAt: '' }],
    attachments: [{ id: 'a1', originalName: 'ticket.png', mimeType: 'image/png', sizeBytes: PNG.length, sha256: PNG_SHA, createdAt: '', data: PNG_B64 }],
    ...over,
  };
}

function archiveOf(...items: ArchiveItem[]): Archive {
  return JSON.parse(JSON.stringify(buildArchive(items, new Date(2026, 9, 25), true)));
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockTx.calls = 0;
  mockTx.fail = false;
  mockFiles.written = [];
  repo.allItemIds.mockResolvedValue([]);
  fs.sha256File.mockResolvedValue(PNG_SHA);
});

describe('backup format v2', () => {
  it('accepts its own output and still accepts old v1 files', () => {
    expect(validateArchive(archiveOf(archiveItem()))).toEqual([]);
    const { attachments: _a, ...v1item } = archiveItem();
    expect(validateArchive({ format: 'ddalggak-export', schemaVersion: 1, exportedAt: '', attachmentsIncluded: false, items: [v1item] })).toEqual([]);
  });

  it('rejects path tricks, wrong types, corrupt base64 and size mismatches', () => {
    const errs = (it: ArchiveItem) => validateArchive(archiveOf(it));
    expect(errs(archiveItem({ id: '../../etc' }))[0]).toContain('쓸 수 없는 문자');
    const att = archiveItem().attachments![0];
    expect(errs(archiveItem({ attachments: [{ ...att, id: 'a/../b' }] }))[0]).toContain('첨부 정보');
    expect(errs(archiveItem({ attachments: [{ ...att, mimeType: 'text/html' }] }))[0]).toContain('첨부 정보');
    expect(errs(archiveItem({ attachments: [{ ...att, data: '@@@@' }] }))[0]).toContain('손상');
    expect(errs(archiveItem({ attachments: [{ ...att, sizeBytes: 999 }] }))[0]).toContain('크기');
    expect(errs(archiveItem({ attachments: [{ ...att, sha256: null }] }))[0]).toContain('손상');
    expect(validateArchive({ format: 'ddalggak-export', schemaVersion: 3, items: [] })[0]).toContain('버전');
    const v1WithFiles = { format: 'ddalggak-export', schemaVersion: 1, items: [archiveItem()] };
    expect(validateArchive(v1WithFiles).some((e) => e.includes('v1'))).toBe(true);
  });

  it('fills the attachment budget in order and says why the rest was left out', () => {
    const r = selectAttachmentsForExport(
      [
        { id: 'a', sizeBytes: 10, exists: true },
        { id: 'b', sizeBytes: 15, exists: true },
        { id: 'c', sizeBytes: 5, exists: true },
        { id: 'd', sizeBytes: null, exists: false },
        { id: 'e', sizeBytes: 30 * 1024 * 1024, exists: true },
      ],
      20,
    );
    expect([...r.included]).toEqual(['a', 'c']);
    expect(Object.fromEntries(r.excluded)).toEqual({ b: 'budget', d: 'missing', e: 'too-large' });
    expect(r.includedBytes).toBe(15);
  });
});

describe('import plan', () => {
  it('skips existing ids, re-keys children, keeps reminder links and switches reminders off', () => {
    const plan = planImport(archiveOf(archiveItem(), archiveItem({ id: 'i2', attachments: [{ ...archiveItem().attachments![0], data: null, sha256: null, excludedReason: 'budget' }] })), new Set(['i1']));
    expect(plan.skippedExisting).toBe(1);
    expect(plan.attachmentsNotInBackup).toBe(1);
    const p = plan.items[0];
    expect(p.item.id).toBe('i2');
    expect(p.fields[0].id).not.toBe('f1');
    expect(p.reminders[0]).toMatchObject({ enabled: false, notificationId: null, sourceFieldId: p.fields[0].id });
    expect(plan.remindersOff).toBe(1);
  });

  it('never uses a name from the file as a path', () => {
    const att = { ...archiveItem().attachments![0], originalName: '../../shared_prefs/evil.png' };
    const plan = planImport(archiveOf(archiveItem({ attachments: [att] })), new Set());
    expect(plan.items[0].files[0].fileName).toMatch(/^a[a-z0-9]+-evil\.png$/);
  });
});

describe('import (restore)', () => {
  it('restores items, tags, fields, reminders (off) and attachments in one transaction', async () => {
    mockFiles.text = JSON.stringify(archiveOf(archiveItem()));
    const r = await importFromFile('file:///picked.json', 100);
    expect(r).toEqual({ imported: 1, skippedExisting: 0, attachmentsRestored: 1, attachmentsNotInBackup: 0, remindersOff: 1 });
    expect(mockTx.calls).toBe(1);
    const row = repo.insertItemRows.mock.calls[0][0];
    expect(row.attachments[0]).toMatchObject({ itemId: 'i1', mimeType: 'image/png', sizeBytes: PNG.length });
    expect(row.attachments[0].localUri).toContain('/attachments/i1/');
    expect(repo.setTagsRows).toHaveBeenCalledWith('i1', ['공연']);
    expect(remRepo.insertReminder.mock.calls[0][0]).toMatchObject({ enabled: false, notificationId: null });
  });

  it('rejects a corrupted attachment before touching the DB and removes written files', async () => {
    mockFiles.text = JSON.stringify(archiveOf(archiveItem()));
    fs.sha256File.mockResolvedValueOnce('b'.repeat(64));
    await expect(importFromFile('file:///picked.json', 100)).rejects.toMatchObject({ code: 'import-invalid' });
    expect(mockTx.calls).toBe(0);
    expect(fs.deleteItemFiles).toHaveBeenCalledWith('i1');
  });

  it('rolls back files when the DB transaction fails, so nothing is half-imported', async () => {
    mockFiles.text = JSON.stringify(archiveOf(archiveItem()));
    mockTx.fail = true;
    await expect(importFromFile('file:///picked.json', 100)).rejects.toMatchObject({ code: 'import-invalid' });
    expect(fs.deleteItemFiles).toHaveBeenCalledWith('i1');
  });

  it('refuses broken JSON, oversize files and leaves existing items alone', async () => {
    mockFiles.text = '{not json';
    await expect(importFromFile('file:///x.json', 10)).rejects.toMatchObject({ code: 'import-invalid' });
    await expect(importFromFile('file:///x.json', 100 * 1024 * 1024)).rejects.toMatchObject({ code: 'import-invalid' });

    mockFiles.text = JSON.stringify(archiveOf(archiveItem()));
    repo.allItemIds.mockResolvedValue(['i1']);
    expect(await importFromFile('file:///x.json', 100)).toMatchObject({ imported: 0, skippedExisting: 1 });
    expect(fs.writeAttachmentBase64).not.toHaveBeenCalled();
  });

  it('imports an empty backup without errors', async () => {
    mockFiles.text = JSON.stringify(archiveOf());
    expect(await importFromFile('file:///x.json', 10)).toMatchObject({ imported: 0 });
  });
});

describe('export', () => {
  const detail = (over: Partial<ItemDetail> = {}): ItemDetail => {
    const { fields: _f, reminders: _r, attachments: _a, ...base } = archiveItem();
    return {
      ...base,
      schemaVersion: 1,
      fields: [],
      reminders: [],
      attachments: [{ id: 'a1', itemId: 'i1', localUri: 'file:///app/attachments/i1/x.png', originalName: 'x.png', mimeType: 'image/png', sizeBytes: 12, width: null, height: null, storageMode: 'retained', createdAt: '' }],
      ...over,
    };
  };

  it('embeds attachments with a hash, skips drafts, and lists files it could not include', async () => {
    repo.allItemIds.mockResolvedValue(['i1', 'd1', 'i3']);
    repo.getItem.mockImplementation(async (id: string) =>
      id === 'd1' ? detail({ id: 'd1', status: 'draft' }) : id === 'i3' ? detail({ id: 'i3', attachments: [{ ...detail().attachments[0], id: 'a3', localUri: 'file:///gone.png' }] }) : detail(),
    );
    fs.fileExists.mockImplementation((uri: string) => uri !== 'file:///gone.png');
    const { archive, plan } = await buildFullArchive({ includeAttachments: true });
    expect(archive.items.map((i) => i.id)).toEqual(['i1', 'i3']);
    expect(archive.items[0].attachments![0]).toMatchObject({ data: PNG_B64, sha256: PNG_SHA });
    expect(archive.items[1].attachments![0]).toMatchObject({ data: null, excludedReason: 'missing' });
    expect(plan).toMatchObject({ items: 2, attachments: 2, includedAttachments: 1, excluded: { missing: 1, budget: 0, 'too-large': 0 } });
    expect(validateArchive(JSON.parse(JSON.stringify(archive)))).toEqual([]);
  });

  it('data-only export carries no attachment content', async () => {
    repo.allItemIds.mockResolvedValue(['i1']);
    repo.getItem.mockResolvedValue(detail());
    const { archive } = await buildFullArchive({ includeAttachments: false });
    expect(archive.attachmentsIncluded).toBe(false);
    expect(archive.items[0].attachments).toBeUndefined();
    expect(fs.readBase64).not.toHaveBeenCalled();
  });
});

describe('delete all data', () => {
  it('cancels notifications, wipes tables, then removes the app folder', async () => {
    const order: string[] = [];
    notifications.cancelAll.mockImplementation(async () => void order.push('notifications'));
    database.wipeAllTables.mockImplementation(async () => void order.push('db'));
    fs.deleteAllAppFiles.mockImplementation(() => void order.push('files'));
    await deleteAllData();
    expect(order).toEqual(['notifications', 'db', 'files']);
  });

  it('keeps files when the DB wipe fails (data and files stay consistent)', async () => {
    database.wipeAllTables.mockRejectedValueOnce(new Error('locked'));
    await expect(deleteAllData()).rejects.toThrow();
    expect(fs.deleteAllAppFiles).not.toHaveBeenCalled();
  });
});
