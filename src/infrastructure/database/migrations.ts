/**
 * Ordered schema migrations; index + 1 = `PRAGMA user_version`. Never edit a shipped migration —
 * append a new one. Schema notes: docs/DATA_MODEL.md.
 */
export const MIGRATIONS: string[] = [
  // v1
  `
  CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_url TEXT,
    url_key TEXT,
    domain TEXT,
    display_text TEXT,
    ocr_text TEXT,
    user_note TEXT,
    needs_review INTEGER NOT NULL DEFAULT 0,
    pinned INTEGER NOT NULL DEFAULT 0,
    captured_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    schema_version INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_items_status ON items(status, updated_at);
  CREATE INDEX IF NOT EXISTS idx_items_category ON items(category, status);
  CREATE INDEX IF NOT EXISTS idx_items_url_key ON items(url_key);
  CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY NOT NULL,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    local_uri TEXT NOT NULL,
    original_name TEXT,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER,
    width INTEGER,
    height INTEGER,
    storage_mode TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_attachments_item ON attachments(item_id);
  CREATE TABLE IF NOT EXISTS extracted_fields (
    id TEXT PRIMARY KEY NOT NULL,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    field_type TEXT NOT NULL,
    value_text TEXT NOT NULL,
    normalized_value TEXT,
    role TEXT,
    confidence TEXT NOT NULL,
    method TEXT NOT NULL,
    evidence_text TEXT,
    requires_confirmation INTEGER NOT NULL,
    user_confirmed INTEGER NOT NULL DEFAULT 0,
    user_edited_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_fields_item ON extracted_fields(item_id);
  CREATE INDEX IF NOT EXISTS idx_fields_date ON extracted_fields(field_type, normalized_value);
  CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY NOT NULL,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    timezone_id TEXT NOT NULL,
    reminder_type TEXT NOT NULL,
    notification_id TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    completed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_reminders_time ON reminders(enabled, scheduled_at);
  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS item_tags (
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, tag_id)
  );
  `,
  // v2 — reminders remember the confirmed date they were made from, so editing/unconfirming that
  // date can reschedule or switch off the OS notification. Existing rows keep NULL (unlinked).
  `
  ALTER TABLE reminders ADD COLUMN source_field_id TEXT;
  ALTER TABLE reminders ADD COLUMN target_date TEXT;
  ALTER TABLE reminders ADD COLUMN days_before INTEGER;
  CREATE INDEX IF NOT EXISTS idx_reminders_field ON reminders(source_field_id);
  `,
];
