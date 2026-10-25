import { DdalggakOcr, type DdalggakOcrNativeModule, type NativeOcrResult } from '../../../modules/ddalggak-ocr';
import type { OcrProvider, OcrResult } from './contracts';

/** Longest decoded side. ML Kit wants ≥16 px per character; 3072 keeps a 12 MP photo at ~2000 px. */
export const OCR_MAX_SIDE = 3072;

function toResult(r: NativeOcrResult): OcrResult {
  return {
    text: r.text ?? '',
    lines: (r.lines ?? []).map((l) => ({ text: l.text, box: l.box ?? undefined })),
    engine: r.engine,
    engineVersion: r.engineVersion,
    durationMs: r.durationMs,
    pageCount: r.pageCount,
    pagesRead: r.pagesRead,
  };
}

/**
 * Android ML Kit text recognition (bundled Korean model) via the local Expo module
 * `modules/ddalggak-ocr`. Returns null when the native module is not part of this build.
 */
export function createMlKitProvider(native: DdalggakOcrNativeModule | null = DdalggakOcr): OcrProvider | null {
  if (!native) return null;
  return {
    id: 'mlkit-korean',
    async isAvailable() {
      return native.isAvailable();
    },
    async recognize(imageUri) {
      return toResult(await native.recognizeImage(imageUri, OCR_MAX_SIDE));
    },
    async recognizeDocument(uri, { maxPages }) {
      return toResult(await native.recognizePdf(uri, maxPages, OCR_MAX_SIDE));
    },
  };
}
