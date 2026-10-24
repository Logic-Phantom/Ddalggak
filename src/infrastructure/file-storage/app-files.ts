import { Directory, File, Paths } from 'expo-file-system';
import * as LegacyFS from 'expo-file-system/legacy';

import { AppError } from '@/domain/errors';

/**
 * App-private file storage (native). Shared/picked files are copied here because OS share URIs
 * (content://, iOS app-group temp files) can disappear once the share session ends.
 */
const ROOT = 'ddalggak';

function dir(...parts: string[]): Directory {
  const d = new Directory(Paths.document, ROOT, ...parts);
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
}

/** Copies a shared/picked file into app storage. `fileName` must already be sanitized. */
export async function importFile(sourceUri: string, itemId: string, fileName: string): Promise<{ uri: string; size: number | null }> {
  const target = new File(dir('attachments', itemId), fileName);
  try {
    if (target.exists) target.delete();
    await new File(sourceUri).copy(target);
    return { uri: target.uri, size: target.size ?? null };
  } catch (first) {
    // Some providers (MediaStore, other apps' FileProviders) only open via ContentResolver streams;
    // the legacy copy reads content:// that way. Try it once before giving up.
    try {
      await LegacyFS.copyAsync({ from: sourceUri, to: target.uri });
      return { uri: target.uri, size: target.size ?? null };
    } catch (e) {
      throw new AppError('file-access-lost', undefined, e ?? first);
    }
  }
}

/** Reads up to `maxBytes` of a local file (header checks only). */
export async function readFileHead(uri: string, maxBytes = 64): Promise<Uint8Array | null> {
  try {
    const bytes = await new File(uri).bytes();
    return bytes.subarray(0, Math.min(bytes.length, maxBytes));
  } catch {
    return null;
  }
}

export function fileSize(uri: string): number | null {
  try {
    return new File(uri).size ?? null;
  } catch {
    return null;
  }
}

export function fileExists(uri: string): boolean {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

export function deleteFile(uri: string): void {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // best effort
  }
}

export function deleteItemFiles(itemId: string): void {
  const d = new Directory(Paths.document, ROOT, 'attachments', itemId);
  if (d.exists) d.delete();
}

export function deleteAllAppFiles(): void {
  const d = new Directory(Paths.document, ROOT);
  if (d.exists) d.delete();
}

/** Item ids that have a folder on disk (used by reconciliation to find orphans). */
export function listAttachmentFolders(): string[] {
  const d = new Directory(Paths.document, ROOT, 'attachments');
  if (!d.exists) return [];
  return d.list().filter((e) => e instanceof Directory).map((e) => e.name);
}

export function appStorageBytes(): number {
  const root = new Directory(Paths.document, ROOT);
  if (!root.exists) return 0;
  return root.size ?? 0;
}

/** Writes a text file to the cache directory (export) and returns its URI. */
export function writeCacheText(fileName: string, content: string): string {
  const f = new File(Paths.cache, fileName);
  if (f.exists) f.delete();
  f.create();
  f.write(content);
  return f.uri;
}

export async function readText(uri: string): Promise<string> {
  return new File(uri).text();
}
