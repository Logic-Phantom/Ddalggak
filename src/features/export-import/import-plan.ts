import { ITEM_SCHEMA_VERSION, type ExtractedField, type InboxItem, type Reminder } from '@/domain/models';
import { newId } from '@/utils/id';

import { normalizeUrl } from '../extraction/url-utils';
import { sanitizeFileName } from '../incoming-share/mime-validation';
import type { Archive, ArchiveAttachment } from './archive-format';

export interface PlannedFile {
  attachmentId: string;
  /** Sanitized, generated name inside `attachments/<itemId>/` — never taken as a path from the file. */
  fileName: string;
  source: ArchiveAttachment & { data: string };
}

export interface PlannedItem {
  item: Omit<InboxItem, 'tags'>;
  urlKey: string | null;
  tags: string[];
  fields: ExtractedField[];
  reminders: Reminder[];
  files: PlannedFile[];
}

export interface ImportPlan {
  items: PlannedItem[];
  skippedExisting: number;
  /** Attachments the backup only lists (left out at export: too large, over budget, missing). */
  attachmentsNotInBackup: number;
  remindersOff: number;
}

/**
 * Turns a validated archive into rows to insert. Pure (no I/O) so the policy is testable:
 * - an item whose id already exists is skipped, never overwritten or merged;
 * - field/reminder/attachment ids are regenerated (they are primary keys and could collide),
 *   and reminder → field links follow the new ids;
 * - reminders come back switched off: the app does not re-schedule old notifications on its own;
 *   the user turns them back on per reminder, which re-checks date, confirmation and budget.
 */
export function planImport(archive: Archive, existingIds: ReadonlySet<string>, nowIso = new Date().toISOString()): ImportPlan {
  const plan: ImportPlan = { items: [], skippedExisting: 0, attachmentsNotInBackup: 0, remindersOff: 0 };
  for (const it of archive.items) {
    if (existingIds.has(it.id)) {
      plan.skippedExisting++;
      continue;
    }
    const { fields, reminders, tags, attachments, ...item } = it;
    const fieldIds = new Map<string, string>();
    const newFields = fields.map((f) => {
      const id = newId('f');
      fieldIds.set(f.id, id);
      return { ...f, id, itemId: it.id } as ExtractedField;
    });
    const newReminders = reminders.map(
      (r) =>
        ({
          ...r,
          id: newId('r'),
          itemId: it.id,
          notificationId: null,
          enabled: false,
          sourceFieldId: r.sourceFieldId ? (fieldIds.get(r.sourceFieldId) ?? null) : null,
          targetDate: r.targetDate ?? null,
          daysBefore: r.daysBefore ?? null,
          updatedAt: nowIso,
        }) as Reminder,
    );
    plan.remindersOff += newReminders.length;
    const files: PlannedFile[] = [];
    for (const a of attachments ?? []) {
      if (a.data == null) {
        plan.attachmentsNotInBackup++;
        continue;
      }
      const attachmentId = newId('a');
      files.push({ attachmentId, fileName: `${attachmentId}-${sanitizeFileName(a.originalName, 'file')}`, source: a as PlannedFile['source'] });
    }
    plan.items.push({
      item: { ...item, schemaVersion: ITEM_SCHEMA_VERSION },
      urlKey: item.sourceUrl ? normalizeUrl(item.sourceUrl) : null,
      tags,
      fields: newFields,
      reminders: newReminders,
      files,
    });
  }
  return plan;
}
