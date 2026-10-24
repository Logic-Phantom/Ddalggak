/**
 * Core domain types. Storage-agnostic: repositories map these to SQLite rows.
 * See docs/DATA_MODEL.md for the reasoning behind each field.
 */

export const CATEGORIES = ['place', 'shopping', 'receipt', 'coupon', 'reservation', 'event', 'ticket', 'warranty', 'document', 'link', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];

/** draft = captured but not reviewed yet. Deletion is a hard delete (rows + files + notifications). */
export type ItemStatus = 'draft' | 'active' | 'completed' | 'archived';

export type SourceType = 'shared-url' | 'shared-text' | 'shared-image' | 'shared-document' | 'manual' | 'paste';

export type ExtractionMethod = 'shared-payload' | 'regex-rule' | 'ocr' | 'manual';
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unknown';

/** What a date means. Never inferred from position alone ("last date in the document"). */
export type DateRole =
  | 'expiry'
  | 'event'
  | 'reservation'
  | 'purchase'
  | 'order'
  | 'delivery'
  | 'return-deadline'
  | 'warranty-end'
  | 'issue'
  | 'start'
  | 'end'
  | 'unknown';

export type MoneyRole = 'total' | 'paid' | 'supply' | 'vat' | 'discount' | 'price' | 'unknown';

export type FieldType =
  | 'title'
  | 'url'
  | 'domain'
  | 'date'
  | 'amount'
  | 'merchant'
  | 'address'
  | 'phone'
  | 'coupon-code'
  | 'order-number'
  | 'reservation-number'
  | 'ticket-number'
  | 'return-policy-text';

export interface ExtractedField {
  id: string;
  itemId: string;
  fieldType: FieldType;
  /** Human-readable value as shown to the user (e.g. "2026.10.31 18:00"). */
  valueText: string;
  /**
   * Machine value: dates as `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm` (local, no offset),
   * amounts as `<minor units> <ISO currency>` (e.g. "15000 KRW", "1099 USD").
   */
  normalizedValue: string | null;
  /** Extra meaning: DateRole for dates, MoneyRole for amounts. */
  role: string | null;
  confidence: ConfidenceLevel;
  method: ExtractionMethod;
  evidenceText: string | null;
  requiresConfirmation: boolean;
  userConfirmed: boolean;
  userEditedAt: string | null;
  createdAt: string;
}

export interface Attachment {
  id: string;
  itemId: string;
  localUri: string;
  originalName: string | null;
  mimeType: string;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  storageMode: 'temporary' | 'retained';
  createdAt: string;
}

export type ReminderType = 'expiry' | 'event' | 'reservation' | 'return-check' | 'warranty-check' | 'revisit' | 'custom';

export interface Reminder {
  id: string;
  itemId: string;
  title: string;
  /** Local wall-clock trigger time, `YYYY-MM-DDTHH:mm`. */
  scheduledAt: string;
  timezoneId: string;
  reminderType: ReminderType;
  notificationId: string | null;
  enabled: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InboxItem {
  id: string;
  title: string;
  category: Category;
  status: ItemStatus;
  sourceType: SourceType;
  sourceUrl: string | null;
  domain: string | null;
  displayText: string | null;
  ocrText: string | null;
  userNote: string | null;
  tags: string[];
  needsReview: boolean;
  pinned: boolean;
  capturedAt: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}

export interface ItemDetail extends InboxItem {
  fields: ExtractedField[];
  attachments: Attachment[];
  reminders: Reminder[];
}

export interface AppSettings {
  /** Keep the original image/PDF after capture. Off = only text/fields are stored. */
  retainAttachments: boolean;
  /** Store full OCR text (searchable) or only the extracted fields. */
  storeOcrText: boolean;
  /** Default reminder hour for date-only values (0–23). */
  defaultReminderHour: number;
  onboardingSeenAt: string | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  retainAttachments: true,
  storeOcrText: true,
  defaultReminderHour: 9,
  onboardingSeenAt: null,
};

export const ITEM_SCHEMA_VERSION = 1;
