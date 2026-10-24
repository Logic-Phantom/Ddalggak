import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import { MAX_ITEMS_PER_SHARE, mimeFromName } from '../incoming-share/mime-validation';
import type { CaptureInput } from '../incoming-share/types';

/**
 * User-initiated pickers. The system photo picker does not need the full photo-library permission
 * on recent Android/iOS versions; the app never scans the library on its own.
 */
export async function pickImages(): Promise<CaptureInput[]> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: 5,
    quality: 1,
    exif: false,
  });
  if (res.canceled) return [];
  return res.assets.slice(0, MAX_ITEMS_PER_SHARE).map((a) => ({
    kind: 'file' as const,
    uri: a.uri,
    mimeType: a.mimeType ?? mimeFromName(a.fileName) ?? 'image/jpeg',
    name: a.fileName ?? null,
    size: a.fileSize ?? null,
    sourceType: 'manual' as const,
  }));
}

export async function pickDocuments(): Promise<CaptureInput[]> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], multiple: true, copyToCacheDirectory: true });
  if (res.canceled) return [];
  return res.assets.slice(0, MAX_ITEMS_PER_SHARE).map((a) => ({
    kind: 'file' as const,
    uri: a.uri,
    mimeType: a.mimeType ?? mimeFromName(a.name) ?? 'application/octet-stream',
    name: a.name ?? null,
    size: a.size ?? null,
    sourceType: 'manual' as const,
  }));
}

/** Opens the document picker for a JSON export file (import flow). */
export async function pickJsonFile(): Promise<{ uri: string; size: number | null } | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], multiple: false, copyToCacheDirectory: true });
  if (res.canceled || !res.assets[0]) return null;
  return { uri: res.assets[0].uri, size: res.assets[0].size ?? null };
}
