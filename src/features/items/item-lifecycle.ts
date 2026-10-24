import type { ItemStatus } from '@/domain/models';

/** Allowed status transitions. Deletion is not a status: it removes rows, files and notifications. */
const TRANSITIONS: Record<ItemStatus, ItemStatus[]> = {
  draft: ['active'],
  active: ['completed', 'archived'],
  completed: ['active', 'archived'],
  archived: ['active'],
};

export function canTransition(from: ItemStatus, to: ItemStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Reminders stay scheduled only while an item is active. */
export function keepsReminders(status: ItemStatus): boolean {
  return status === 'active';
}

export const STATUS_LABEL: Record<ItemStatus, string> = {
  draft: '검토 전',
  active: '보관함',
  completed: '완료',
  archived: '보관됨',
};
