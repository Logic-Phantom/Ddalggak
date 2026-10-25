import * as Sharing from 'expo-sharing';

import { AppError, logError } from '@/domain/errors';
import type { Attachment, ItemDetail } from '@/domain/models';
import { getDb } from '@/infrastructure/database/database';
import { deleteItemFiles, fileExists, fileSize, readBase64, readFileHead, readText, sha256File, writeAttachmentBase64, writeCacheText } from '@/infrastructure/file-storage/app-files';
import { toYmd } from '@/utils/dates';

import { checkFile } from '../incoming-share/mime-validation';
import { allItemIds, getItem, insertItemRows, setTagsRows } from '../items/item-repository';
import { insertReminder } from '../reminders/reminder-repository';
import { buildArchive, MAX_IMPORT_BYTES, selectAttachmentsForExport, validateArchive, type Archive, type ArchiveAttachment, type ArchiveItem, type ExcludedReason } from './archive-format';
import { planImport, type PlannedItem } from './import-plan';

async function exportableItems(): Promise<ItemDetail[]> {
  const out: ItemDetail[] = [];
  for (const id of await allItemIds()) {
    const d = await getItem(id);
    // Drafts are an open review screen, not saved data.
    if (d && d.status !== 'draft') out.push(d);
  }
  return out;
}

function candidates(items: ItemDetail[]) {
  return items.flatMap((d) => d.attachments.map((a) => ({ id: a.id, sizeBytes: fileExists(a.localUri) ? (fileSize(a.localUri) ?? a.sizeBytes) : null, exists: fileExists(a.localUri) })));
}

export interface ExportPlan {
  items: number;
  attachments: number;
  includedAttachments: number;
  includedBytes: number;
  excluded: Record<ExcludedReason, number>;
}

function countExcluded(excluded: Map<string, ExcludedReason>): Record<ExcludedReason, number> {
  const out: Record<ExcludedReason, number> = { 'too-large': 0, budget: 0, missing: 0 };
  for (const r of excluded.values()) out[r]++;
  return out;
}

/** What a backup with attachments would contain — shown to the user before saving. */
export async function planExport(): Promise<ExportPlan> {
  const items = await exportableItems();
  const list = candidates(items);
  const sel = selectAttachmentsForExport(list);
  return { items: items.length, attachments: list.length, includedAttachments: sel.included.size, includedBytes: sel.includedBytes, excluded: countExcluded(sel.excluded) };
}

/**
 * Builds the backup of every saved (non-draft) item. With `includeAttachments`, files are embedded
 * (base64 + SHA-256) up to the size budget; the rest stay listed with a reason, never silently dropped.
 */
export async function buildFullArchive(opts: { includeAttachments: boolean } = { includeAttachments: false }, now = new Date()): Promise<{ archive: Archive; plan: ExportPlan }> {
  const details = await exportableItems();
  const list = candidates(details);
  const sel = opts.includeAttachments ? selectAttachmentsForExport(list) : { included: new Set<string>(), excluded: new Map<string, ExcludedReason>(), includedBytes: 0 };
  const items: ArchiveItem[] = [];
  for (const d of details) {
    const { attachments, schemaVersion: _s, fields, reminders, ...rest } = d;
    const item: ArchiveItem = {
      ...rest,
      fields: fields.map(({ itemId: _i, ...f }) => f),
      reminders: reminders.map(({ itemId: _i, notificationId: _n, ...r }) => r),
    };
    if (opts.includeAttachments) item.attachments = await Promise.all(attachments.map((a) => toArchiveAttachment(a, sel)));
    items.push(item);
  }
  const embedded = items.flatMap((i) => i.attachments ?? []).filter((a) => a.data != null);
  const excluded = new Map(items.flatMap((i) => (i.attachments ?? []).filter((a) => a.excludedReason).map((a) => [a.id, a.excludedReason!] as const)));
  return {
    archive: buildArchive(items, now, opts.includeAttachments),
    plan: {
      items: items.length,
      attachments: list.length,
      includedAttachments: embedded.length,
      includedBytes: embedded.reduce((n, a) => n + a.sizeBytes, 0),
      excluded: countExcluded(excluded),
    },
  };
}

async function toArchiveAttachment(a: Attachment, sel: { included: Set<string>; excluded: Map<string, ExcludedReason> }): Promise<ArchiveAttachment> {
  const meta = { id: a.id, originalName: a.originalName, mimeType: a.mimeType, sizeBytes: a.sizeBytes ?? 0, createdAt: a.createdAt };
  if (!sel.included.has(a.id)) return { ...meta, sha256: null, data: null, excludedReason: sel.excluded.get(a.id) ?? 'missing' };
  try {
    const [data, sha256] = await Promise.all([readBase64(a.localUri), sha256File(a.localUri)]);
    return { ...meta, sizeBytes: fileSize(a.localUri) ?? meta.sizeBytes, sha256, data };
  } catch (e) {
    logError('export.attachment', e);
    return { ...meta, sha256: null, data: null, excludedReason: 'missing' };
  }
}

/** Writes the backup to a cache file and opens the OS share sheet (the user chooses where it goes). */
export async function exportToShareSheet(opts: { includeAttachments: boolean }): Promise<ExportPlan> {
  const { archive, plan } = await buildFullArchive(opts);
  const uri = await writeCacheText(`ddalggak-${opts.includeAttachments ? 'backup' : 'export'}-${toYmd(new Date())}.json`, JSON.stringify(archive));
  if (process.env.EXPO_OS !== 'web') {
    if (!(await Sharing.isAvailableAsync())) throw new AppError('unknown', '이 기기에서는 공유 시트를 열 수 없어요.');
    await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: '딸깍 데이터 내보내기' });
  }
  return plan;
}

export interface ImportReport {
  imported: number;
  skippedExisting: number;
  attachmentsRestored: number;
  /** Listed in the backup but not embedded (too large / over budget / missing at export). */
  attachmentsNotInBackup: number;
  remindersOff: number;
}

/**
 * Imports a v1/v2 backup. Order: validate everything → write files and verify SHA-256 + real type →
 * one DB transaction. Any failure removes the files written so far, so existing data is untouched
 * and nothing is half-imported. Existing item ids are skipped, never overwritten.
 */
export async function importFromFile(uri: string, size: number | null): Promise<ImportReport> {
  if (size != null && size > MAX_IMPORT_BYTES) throw new AppError('import-invalid', `가져올 파일이 너무 커요 (최대 ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)}MB).`);
  let data: unknown;
  try {
    data = JSON.parse(await readText(uri));
  } catch {
    throw new AppError('import-invalid');
  }
  const errors = validateArchive(data);
  if (errors.length) throw new AppError('import-invalid', `가져올 수 없어요: ${errors.slice(0, 3).join(' ')}`);
  const plan = planImport(data as Archive, new Set(await allItemIds()));

  const written = new Set<string>();
  let attachmentsRestored = 0;
  try {
    const rows: { p: PlannedItem; attachments: Attachment[] }[] = [];
    for (const [index, p] of plan.items.entries()) {
      const attachments: Attachment[] = [];
      for (const f of p.files) {
        written.add(p.item.id);
        const localUri = await writeAttachmentBase64(p.item.id, f.fileName, f.source.data);
        const digest = await sha256File(localUri);
        const check = checkFile({ mimeType: f.source.mimeType, name: f.source.originalName, size: fileSize(localUri), head: await readFileHead(localUri) });
        if (digest !== f.source.sha256 || !check.ok) throw new AppError('import-invalid', `가져올 수 없어요: ${index + 1}번째 새 항목의 첨부 파일이 손상됐어요. 기존 데이터는 바뀌지 않았어요.`);
        attachments.push({
          id: f.attachmentId,
          itemId: p.item.id,
          localUri,
          originalName: f.source.originalName,
          mimeType: check.mimeType,
          sizeBytes: f.source.sizeBytes,
          width: null,
          height: null,
          storageMode: 'retained',
          createdAt: f.source.createdAt,
        });
      }
      rows.push({ p, attachments });
    }
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      for (const { p, attachments } of rows) {
        await insertItemRows({ item: p.item, urlKey: p.urlKey, fields: p.fields, attachments });
        await setTagsRows(p.item.id, p.tags);
        for (const r of p.reminders) await insertReminder(r);
      }
    });
    attachmentsRestored = rows.reduce((n, r) => n + r.attachments.length, 0);
  } catch (e) {
    for (const id of written) deleteItemFiles(id);
    if (e instanceof AppError) throw e;
    logError('import', e);
    throw new AppError('import-invalid', '가져오는 중 문제가 생겨 아무것도 가져오지 않았어요. 기존 데이터는 그대로예요.', e);
  }
  return { imported: plan.items.length, skippedExisting: plan.skippedExisting, attachmentsRestored, attachmentsNotInBackup: plan.attachmentsNotInBackup, remindersOff: plan.remindersOff };
}
