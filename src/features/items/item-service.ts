import { AppError, logError } from '@/domain/errors';
import type { Category, ItemStatus } from '@/domain/models';
import { wipeAllTables } from '@/infrastructure/database/database';
import { deleteAllAppFiles, deleteFile, deleteItemFiles, fileExists, listAttachmentFolders } from '@/infrastructure/file-storage/app-files';
import * as notifications from '@/infrastructure/notifications/local-notifications';

import { disableRemindersFor } from '../reminders/reminder-service';
import { allAttachments, allItemIds, deleteAttachmentRow, deleteItemRow, getItem, listDraftIds, setTags, updateItem } from './item-repository';
import { canTransition, keepsReminders } from './item-lifecycle';

export interface ReviewEdits {
  title: string;
  category: Category;
  userNote: string | null;
  tags: string[];
}

/** Draft → active after the user reviewed it. Field confirmations are saved as the user taps them. */
export async function confirmDraft(id: string, edits: ReviewEdits): Promise<void> {
  const item = await getItem(id);
  if (!item) throw new AppError('validation');
  const title = edits.title.trim();
  if (!title) throw new AppError('validation', '제목을 입력해 주세요.');
  const stillUnconfirmed = item.fields.some((f) => f.requiresConfirmation && !f.userConfirmed);
  await updateItem(id, {
    title,
    category: edits.category,
    userNote: edits.userNote?.trim() || null,
    status: item.status === 'draft' ? 'active' : item.status,
    needsReview: stillUnconfirmed,
  });
  await setTags(id, edits.tags);
}

export async function setStatus(id: string, to: ItemStatus): Promise<void> {
  const item = await getItem(id);
  if (!item) return;
  if (!canTransition(item.status, to)) throw new AppError('validation', '이 상태로 바꿀 수 없어요.');
  await updateItem(id, { status: to });
  if (!keepsReminders(to)) await disableRemindersFor(item.reminders.filter((r) => r.enabled));
}

/** Hard delete: DB rows (cascade), copied files and scheduled notifications — all or best effort. */
export async function deleteItem(id: string): Promise<void> {
  const { attachmentUris, notificationIds } = await deleteItemRow(id);
  for (const n of notificationIds) await notifications.cancel(n);
  for (const uri of attachmentUris) deleteFile(uri);
  deleteItemFiles(id);
}

export async function discardDraft(id: string): Promise<void> {
  const item = await getItem(id);
  if (item?.status === 'draft') await deleteItem(id);
}

export async function removeAttachment(attachmentId: string, uri: string): Promise<void> {
  await deleteAttachmentRow(attachmentId);
  deleteFile(uri);
}

export async function deleteAllData(): Promise<void> {
  await notifications.cancelAll();
  await wipeAllTables();
  deleteAllAppFiles();
}

export interface ReconcileReport {
  staleDraftsRemoved: number;
  orphanFoldersRemoved: number;
  missingAttachmentRows: number;
}

/**
 * Keeps DB and file storage consistent (app start): removes abandoned drafts (> 1 day),
 * attachment folders without an item, and attachment rows whose file disappeared.
 */
export async function reconcileStorage(now = new Date()): Promise<ReconcileReport> {
  const report: ReconcileReport = { staleDraftsRemoved: 0, orphanFoldersRemoved: 0, missingAttachmentRows: 0 };
  try {
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    for (const id of await listDraftIds(dayAgo)) {
      await deleteItem(id);
      report.staleDraftsRemoved++;
    }
    const ids = new Set(await allItemIds());
    for (const folder of listAttachmentFolders()) {
      if (!ids.has(folder)) {
        deleteItemFiles(folder);
        report.orphanFoldersRemoved++;
      }
    }
    for (const a of await allAttachments()) {
      if (!fileExists(a.localUri)) {
        await deleteAttachmentRow(a.id);
        report.missingAttachmentRows++;
      }
    }
  } catch (e) {
    logError('reconcile', e);
  }
  return report;
}
