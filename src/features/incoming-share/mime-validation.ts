import type { AppErrorCode } from '@/domain/errors';

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_TEXT_LENGTH = 20_000;
export const MAX_ITEMS_PER_SHARE = 10;

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'] as const;
export const DOCUMENT_MIME_TYPES = ['application/pdf'] as const;
export const ACCEPTED_FILE_MIME_TYPES: readonly string[] = [...IMAGE_MIME_TYPES, ...DOCUMENT_MIME_TYPES];

const EXTENSION_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  txt: 'text/plain',
};

export function isImageMime(mime: string | null | undefined): boolean {
  return !!mime && (IMAGE_MIME_TYPES as readonly string[]).includes(mime.toLowerCase());
}

export function mimeFromName(name: string | null | undefined): string | null {
  const ext = name?.split('.').pop()?.toLowerCase();
  return (ext && EXTENSION_MIME[ext]) || null;
}

/** Detects the real type from the first bytes so a renamed file cannot pass as an image/PDF. */
export function sniffMime(head: Uint8Array): string | null {
  const b = head;
  const ascii = (from: number, to: number) => String.fromCharCode(...Array.from(b.subarray(from, to)));
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  if (b.length >= 5 && ascii(0, 5) === '%PDF-') return 'application/pdf';
  if (b.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (b.length >= 12 && ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12);
    if (['heic', 'heix', 'hevc', 'heim', 'heis'].includes(brand)) return 'image/heic';
    if (['mif1', 'msf1'].includes(brand)) return 'image/heif';
  }
  return null;
}

/** Keeps only a safe base name: no directories, no "..", no control characters. */
export function sanitizeFileName(name: string | null | undefined, fallback = 'file'): string {
  const base = (name ?? '').split(/[\\/]/).pop() ?? '';
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 80);
  return cleaned || fallback;
}

export type FileCheck = { ok: true; mimeType: string } | { ok: false; code: AppErrorCode };

/**
 * Validates a file before it is copied into app storage. `head` (first bytes) is optional because
 * some URIs cannot be read cheaply; when present it must agree with the declared type family.
 */
export function checkFile(input: { mimeType?: string | null; name?: string | null; size?: number | null; head?: Uint8Array | null }): FileCheck {
  if (input.size != null && input.size > MAX_FILE_BYTES) return { ok: false, code: 'file-too-large' };
  const declared = (input.mimeType?.toLowerCase() || mimeFromName(input.name)) ?? null;
  const sniffed = input.head ? sniffMime(input.head) : null;
  const mime = sniffed ?? declared;
  if (!mime || !ACCEPTED_FILE_MIME_TYPES.includes(mime)) return { ok: false, code: 'share-unsupported' };
  if (sniffed && declared && declared !== 'application/octet-stream') {
    const family = (m: string) => (m.startsWith('image/') ? 'image' : m);
    if (family(sniffed) !== family(declared)) return { ok: false, code: 'file-type-mismatch' };
  }
  return { ok: true, mimeType: mime };
}
