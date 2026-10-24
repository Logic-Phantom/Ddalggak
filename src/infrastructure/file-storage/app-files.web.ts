/**
 * Web development-preview implementation. expo-file-system has no web support, so picked files
 * keep their blob/data URI for the session only. The web target exists for UI QA, not release.
 */
export async function importFile(sourceUri: string, _itemId: string, _fileName: string): Promise<{ uri: string; size: number | null }> {
  return { uri: sourceUri, size: null };
}

export async function readFileHead(uri: string, maxBytes = 64): Promise<Uint8Array | null> {
  try {
    const res = await fetch(uri);
    const buf = new Uint8Array(await res.arrayBuffer());
    return buf.subarray(0, Math.min(buf.length, maxBytes));
  } catch {
    return null;
  }
}

export function fileSize(_uri: string): number | null {
  return null;
}

export function fileExists(_uri: string): boolean {
  return true;
}

export function deleteFile(_uri: string): void {}

export function deleteItemFiles(_itemId: string): void {}

export function deleteAllAppFiles(): void {}

export function listAttachmentFolders(): string[] {
  return [];
}

export function appStorageBytes(): number {
  return 0;
}

export function writeCacheText(fileName: string, content: string): string {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  return url;
}

export async function readText(uri: string): Promise<string> {
  const res = await fetch(uri);
  return res.text();
}
