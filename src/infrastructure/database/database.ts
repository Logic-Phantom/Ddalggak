import * as SQLite from 'expo-sqlite';

import { MIGRATIONS } from './migrations';

/**
 * Local store. Only text, fields and file URIs are stored — never image/PDF binaries.
 * The database file is NOT encrypted (see docs/THREAT_MODEL.md); it relies on the OS app sandbox.
 */
const DB_NAME = 'ddalggak.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  if (process.env.EXPO_OS !== 'web') await db.execAsync('PRAGMA journal_mode = WAL;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    // Each migration and its version bump commit together, so a crash never leaves a half-applied step.
    const next = version + 1;
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[next - 1]);
      await db.execAsync(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
}

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await migrate(db);
      return db;
    })();
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, JSON.stringify(value));
}

/** Wipes every local table (used by "전체 데이터 삭제"). Files and notifications are cleared by the caller. */
export async function wipeAllTables(): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM item_tags; DELETE FROM tags; DELETE FROM reminders; DELETE FROM extracted_fields; DELETE FROM attachments; DELETE FROM items; DELETE FROM kv;');
  });
}
