import * as Sharing from 'expo-sharing';

import { AppError } from '@/domain/errors';
import type { ExtractedField, Reminder } from '@/domain/models';
import { ITEM_SCHEMA_VERSION } from '@/domain/models';
import { getDb } from '@/infrastructure/database/database';
import { readText, writeCacheText } from '@/infrastructure/file-storage/app-files';
import { toYmd } from '@/utils/dates';

import { normalizeUrl } from '../extraction/url-utils';
import { allItemIds, getItem, insertItemRows, setTagsRows } from '../items/item-repository';
import { insertReminder } from '../reminders/reminder-repository';
import { buildArchive, MAX_IMPORT_BYTES, validateArchive, type ArchiveItem, type ArchiveV1 } from './archive-format';

/** Builds the JSON archive of every non-draft item. Contains personal data — the UI warns first. */
export async function buildFullArchive(now = new Date()): Promise<ArchiveV1> {
  const items: ArchiveItem[] = [];
  for (const id of await allItemIds()) {
    const d = await getItem(id);
    if (!d || d.status === 'draft') continue;
    const { attachments: _a, schemaVersion: _s, fields, reminders, ...rest } = d;
    items.push({
      ...rest,
      fields: fields.map(({ itemId: _i, ...f }) => f),
      reminders: reminders.map(({ itemId: _i, notificationId: _n, ...r }) => r),
    });
  }
  return buildArchive(items, now);
}

/** Writes the archive to a cache file and opens the OS share sheet (user chooses where it goes). */
export async function exportToShareSheet(): Promise<number> {
  const archive = await buildFullArchive();
  const uri = writeCacheText(`ddalggak-export-${toYmd(new Date())}.json`, JSON.stringify(archive, null, 1));
  if (process.env.EXPO_OS !== 'web') {
    if (!(await Sharing.isAvailableAsync())) throw new AppError('unknown', '이 기기에서는 공유 시트를 열 수 없어요.');
    await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'KeepOn 데이터 내보내기' });
  }
  return archive.items.length;
}

export interface ImportReport {
  imported: number;
  skippedExisting: number;
}

/**
 * Imports an archive in one transaction: either every new item lands or none does.
 * Items whose id already exists are skipped. Reminders come back disabled (not scheduled).
 */
export async function importFromFile(uri: string, size: number | null): Promise<ImportReport> {
  if (size != null && size > MAX_IMPORT_BYTES) throw new AppError('import-invalid', '가져올 파일이 너무 커요 (최대 20MB).');
  let data: unknown;
  try {
    data = JSON.parse(await readText(uri));
  } catch {
    throw new AppError('import-invalid');
  }
  const errors = validateArchive(data);
  if (errors.length) throw new AppError('import-invalid', `가져올 수 없어요: ${errors.slice(0, 3).join(' ')}`);
  const archive = data as ArchiveV1;
  const existing = new Set(await allItemIds());
  const db = await getDb();
  const report: ImportReport = { imported: 0, skippedExisting: 0 };
  await db.withTransactionAsync(async () => {
    for (const it of archive.items) {
      if (existing.has(it.id)) {
        report.skippedExisting++;
        continue;
      }
      const { fields, reminders, tags, ...item } = it;
      await insertItemRows({
        item: { ...item, schemaVersion: ITEM_SCHEMA_VERSION },
        urlKey: item.sourceUrl ? normalizeUrl(item.sourceUrl) : null,
        fields: fields.map((f) => ({ ...f, itemId: it.id }) as ExtractedField),
        attachments: [],
      });
      await setTagsRows(it.id, tags);
      for (const r of reminders) await insertReminder({ ...r, itemId: it.id, notificationId: null, enabled: false } as Reminder);
      report.imported++;
    }
  });
  return report;
}
