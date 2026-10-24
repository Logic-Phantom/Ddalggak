import { logError } from '@/domain/errors';

import { isImageMime } from '../incoming-share/mime-validation';
import type { OcrOutcome, OcrProvider } from './contracts';
import { unavailableOcrProvider } from './unavailable-provider';

let provider: OcrProvider = unavailableOcrProvider;

/** Swapped in once a native engine passes the POC; tests can inject a fake. */
export function setOcrProvider(p: OcrProvider): void {
  provider = p;
}

export function currentOcrProviderId(): string {
  return provider.id;
}

export async function isOcrAvailable(): Promise<boolean> {
  try {
    return await provider.isAvailable();
  } catch {
    return false;
  }
}

/** Runs OCR on a local image. PDFs are not rasterized in the MVP (documented limitation). */
export async function runOcr(uri: string, mimeType: string): Promise<OcrOutcome> {
  if (!isImageMime(mimeType)) return { status: 'unsupported-type' };
  if (!(await isOcrAvailable())) return { status: 'unavailable' };
  try {
    const result = await provider.recognize(uri, { languageHints: ['ko', 'en'] });
    return { status: 'done', result };
  } catch (e) {
    logError('ocr', e);
    return { status: 'failed' };
  }
}
