import { logError } from '@/domain/errors';

import { isImageMime } from '../incoming-share/mime-validation';
import type { OcrFailureReason, OcrOutcome, OcrProvider } from './contracts';
import { createMlKitProvider } from './mlkit-provider';
import { unavailableOcrProvider } from './unavailable-provider';

/** PDFs are rasterized page by page; more pages cost memory and time for little extra value. */
export const MAX_PDF_OCR_PAGES = 3;
export const OCR_TIMEOUT_MS = 60_000;

let provider: OcrProvider | null = null;

/** Native engine when this build links it (Android), otherwise the honest "unavailable" provider. */
function current(): OcrProvider {
  if (!provider) provider = createMlKitProvider() ?? unavailableOcrProvider;
  return provider;
}

/** Tests inject a fake; null restores the default selection. */
export function setOcrProvider(p: OcrProvider | null): void {
  provider = p;
}

export function currentOcrProviderId(): string {
  return current().id;
}

export async function isOcrAvailable(): Promise<boolean> {
  try {
    return await current().isAvailable();
  } catch {
    return false;
  }
}

/** Maps native error codes (never messages: they could carry details) to a user-facing reason. */
export function failureReason(e: unknown): OcrFailureReason {
  const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '';
  if (code === 'timeout') return 'timeout';
  if (code.includes('MEMORY')) return 'memory';
  if (code.includes('PDF_PROTECTED')) return 'pdf-protected';
  if (code.includes('PDF_INVALID')) return 'pdf-invalid';
  if (code.includes('FILE') || code.includes('DECODE')) return 'file';
  return 'engine';
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error('OCR timed out'), { code: 'timeout' })), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * Runs on-device OCR on a local image, or on the first pages of a PDF when the engine supports it.
 * Never throws: every failure becomes an outcome so the original capture is always saved.
 */
export async function runOcr(uri: string, mimeType: string, timeoutMs = OCR_TIMEOUT_MS): Promise<OcrOutcome> {
  const isPdf = mimeType === 'application/pdf';
  if (!isImageMime(mimeType) && !isPdf) return { status: 'unsupported-type' };
  if (!(await isOcrAvailable())) return { status: 'unavailable' };
  const engine = current();
  if (isPdf && !engine.recognizeDocument) return { status: 'unsupported-type' };
  try {
    const languageHints = ['ko', 'en'];
    const result = await withTimeout(
      isPdf ? engine.recognizeDocument!(uri, { languageHints, maxPages: MAX_PDF_OCR_PAGES }) : engine.recognize(uri, { languageHints }),
      timeoutMs,
    );
    return result.text.trim() ? { status: 'done', result } : { status: 'empty', result };
  } catch (e) {
    logError('ocr', e);
    return { status: 'failed', reason: failureReason(e) };
  }
}
