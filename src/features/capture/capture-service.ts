import { AppError, logError, type AppErrorCode } from '@/domain/errors';
import { ITEM_SCHEMA_VERSION, type AppSettings, type Attachment, type ExtractedField, type ItemStatus, type SourceType } from '@/domain/models';
import { deleteFile, deleteItemFiles, fileExists, fileSize, importFile, readFileHead } from '@/infrastructure/file-storage/app-files';
import { newId } from '@/utils/id';

import { dedupeFields, extractFields, mergeReanalysis } from '../extraction/field-extraction-service';
import { normalizeUrl } from '../extraction/url-utils';
import { checkFile, isImageMime, sanitizeFileName } from '../incoming-share/mime-validation';
import type { CaptureInput } from '../incoming-share/types';
import { getItem, insertItem, replaceAutomaticFields, updateItem } from '../items/item-repository';
import type { OcrFailureReason, OcrOutcome } from '../ocr/contracts';
import { isOcrAvailable, runOcr } from '../ocr/ocr-service';

/**
 * not-needed: no image/PDF · done/partial/empty: the engine ran · deferred: quick save skipped OCR
 * (run it later from review) · disabled: turned off in settings · unavailable: no engine in this build.
 */
export type OcrSummary = 'not-needed' | 'done' | 'partial' | 'empty' | 'unavailable' | 'failed' | 'unsupported' | 'disabled' | 'deferred';

export interface CaptureOutcome {
  itemId: string;
  ocr: OcrSummary;
  ocrReason?: OcrFailureReason;
  /** Files that could not be imported (the rest of the capture still succeeded). */
  skipped: AppErrorCode[];
}

export type CaptureMode = 'review' | 'quick';

function primarySource(inputs: CaptureInput[]): SourceType {
  return inputs.find((i) => i.kind === 'file')?.sourceType ?? inputs.find((i) => i.kind === 'url')?.sourceType ?? inputs[0]?.sourceType ?? 'manual';
}

export function isOcrCandidate(mimeType: string): boolean {
  return isImageMime(mimeType) || mimeType === 'application/pdf';
}

/** Combines per-file outcomes into one message key for the review screen. */
export function summarizeOcr(outcomes: OcrOutcome[]): { ocr: OcrSummary; reason?: OcrFailureReason } {
  if (!outcomes.length) return { ocr: 'not-needed' };
  const done = outcomes.filter((o) => o.status === 'done').length;
  const failed = outcomes.find((o): o is Extract<OcrOutcome, { status: 'failed' }> => o.status === 'failed');
  if (done) return { ocr: done === outcomes.length ? 'done' : 'partial' };
  if (failed) return { ocr: 'failed', reason: failed.reason };
  if (outcomes.some((o) => o.status === 'empty')) return { ocr: 'empty' };
  if (outcomes.some((o) => o.status === 'unavailable')) return { ocr: 'unavailable' };
  return { ocr: 'unsupported' };
}

/** Identifies one capture so a double tap (or a re-delivered share) cannot create two items at once. */
export function captureFingerprint(inputs: CaptureInput[]): string {
  return inputs.map((i) => (i.kind === 'text' ? `t:${i.text}` : i.kind === 'url' ? `u:${i.url}|${i.text ?? ''}` : `f:${i.uri}`)).join('\n');
}

const inFlight = new Set<string>();

/**
 * Turns one capture (share, paste, or picker) into an item:
 * copy files into app storage → validate real type → local OCR → rule extraction → insert.
 * - mode 'review' (저장하기): saves a `draft` for the review screen.
 * - mode 'quick' (임시 저장): saves a `pending` item. OCR is skipped when the original is kept
 *   (it can run later from review); without kept originals it runs now, since the copy is deleted.
 * Nothing is confirmed and no reminder is created here. Network is never used.
 */
export async function captureItem(inputs: CaptureInput[], settings: AppSettings, mode: CaptureMode = 'review', now = new Date()): Promise<CaptureOutcome> {
  if (!inputs.length) throw new AppError('share-empty');
  const key = captureFingerprint(inputs);
  if (inFlight.has(key)) throw new AppError('validation', '이미 저장하고 있어요. 잠시만 기다려 주세요.');
  inFlight.add(key);
  try {
    return await capture(inputs, settings, mode, now);
  } finally {
    inFlight.delete(key);
  }
}

/** Backwards-compatible name for the review flow. */
export function createDraft(inputs: CaptureInput[], settings: AppSettings, now = new Date()): Promise<CaptureOutcome> {
  return captureItem(inputs, settings, 'review', now);
}

async function capture(inputs: CaptureInput[], settings: AppSettings, mode: CaptureMode, now: Date): Promise<CaptureOutcome> {
  const itemId = newId('i');
  const nowIso = now.toISOString();
  const texts: string[] = [];
  let url: string | null = null;
  const attachments: Attachment[] = [];
  const skipped: AppErrorCode[] = [];
  const ocrTexts: string[] = [];
  const outcomes: OcrOutcome[] = [];
  let deferredOcr = false;
  let disabledOcr = false;
  let firstMime: string | null = null;

  for (const input of inputs) {
    if (input.kind === 'text') texts.push(input.text);
    if (input.kind === 'url') {
      url = url ?? input.url;
      if (input.text) texts.push(input.text);
    }
    if (input.kind !== 'file') continue;

    if (input.size != null) {
      const pre = checkFile({ mimeType: input.mimeType, name: input.name, size: input.size });
      if (!pre.ok) {
        skipped.push(pre.code);
        continue;
      }
    }
    let stored: { uri: string; size: number | null };
    const fileName = `${newId('a')}-${sanitizeFileName(input.name, 'file')}`;
    try {
      stored = await importFile(input.uri, itemId, fileName);
    } catch (e) {
      logError('capture.import', e);
      skipped.push('file-access-lost');
      continue;
    }
    const head = await readFileHead(stored.uri);
    const size = stored.size ?? fileSize(stored.uri) ?? input.size;
    const check = checkFile({ mimeType: input.mimeType, name: input.name, size, head });
    if (!check.ok) {
      deleteFile(stored.uri);
      skipped.push(check.code);
      continue;
    }
    firstMime = firstMime ?? check.mimeType;

    if (isOcrCandidate(check.mimeType)) {
      if (!settings.ocrEnabled) disabledOcr = true;
      else if (mode === 'quick' && settings.retainAttachments) {
        if (await isOcrAvailable()) deferredOcr = true;
        else outcomes.push({ status: 'unavailable' });
      } else {
        const ocr = await runOcr(stored.uri, check.mimeType);
        outcomes.push(ocr);
        if (ocr.status === 'done') ocrTexts.push(ocr.result.text);
      }
    }

    if (settings.retainAttachments) {
      attachments.push({
        id: newId('a'),
        itemId,
        localUri: stored.uri,
        originalName: input.name ? sanitizeFileName(input.name) : null,
        mimeType: check.mimeType,
        sizeBytes: size ?? null,
        width: null,
        height: null,
        storageMode: 'retained',
        createdAt: nowIso,
      });
    } else {
      // "첨부 보관 안 함": the copy only existed for OCR.
      deleteFile(stored.uri);
    }
  }

  if (!texts.length && !url && !attachments.length && !ocrTexts.length) {
    deleteItemFiles(itemId);
    throw new AppError(skipped[0] ?? 'share-empty');
  }

  const sharedText = texts.join('\n\n').trim();
  const ocrText = ocrTexts.join('\n\n').trim();
  const shared = extractFields({ text: sharedText, url, method: 'shared-payload', mimeType: firstMime, today: now });
  const fromOcr = ocrText ? extractFields({ text: ocrText, method: 'ocr', mimeType: firstMime, today: now }) : null;
  const categories = fromOcr && (fromOcr.categories[0]?.score ?? 0) > (shared.categories[0]?.score ?? 0) ? fromOcr.categories : shared.categories;

  const fields: ExtractedField[] = [...shared.fields, ...(fromOcr?.fields ?? [])].map((f) => ({ ...f, id: newId('f'), itemId, createdAt: nowIso }));
  const title = shared.titleSuggestion || fromOcr?.titleSuggestion || (attachments.length ? '이미지 메모' : '새 항목');
  const summary = outcomes.length ? summarizeOcr(outcomes) : deferredOcr ? { ocr: 'deferred' as const } : disabledOcr ? { ocr: 'disabled' as const } : { ocr: 'not-needed' as const };
  const status: ItemStatus = mode === 'quick' ? 'pending' : 'draft';

  try {
    await insertItem({
      item: {
        id: itemId,
        title,
        category: categories[0].category,
        status,
        sourceType: primarySource(inputs),
        sourceUrl: shared.sourceUrl,
        domain: shared.domain,
        displayText: sharedText || null,
        ocrText: settings.storeOcrText && ocrText ? ocrText : null,
        userNote: null,
        needsReview: true,
        pinned: false,
        capturedAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
        schemaVersion: ITEM_SCHEMA_VERSION,
      },
      urlKey: shared.sourceUrl ? normalizeUrl(shared.sourceUrl) : null,
      fields,
      attachments,
    });
  } catch (e) {
    // The insert is one transaction, so nothing reached the DB; remove the copied files too.
    logError('capture.insert', e);
    deleteItemFiles(itemId);
    throw new AppError('storage-failed', '저장하지 못했어요. 기기 저장 공간을 확인한 뒤 다시 시도해 주세요. 원래 앱의 내용은 그대로예요.', e);
  }

  return { itemId, ocr: summary.ocr, ocrReason: summary.reason, skipped };
}

/**
 * Runs OCR (again) on an item's kept image/PDF attachments — after a quick save, or as "다시 시도"
 * after a failure — and re-extracts candidates. Fields the user confirmed, edited or typed are
 * never replaced (mergeReanalysis). Nothing is confirmed and no reminder is created.
 */
export async function analyzeAttachments(itemId: string, settings: AppSettings): Promise<{ ocr: OcrSummary; reason?: OcrFailureReason; added: number }> {
  const item = await getItem(itemId);
  if (!item) throw new AppError('validation', '항목을 찾을 수 없어요.');
  const files = item.attachments.filter((a) => isOcrCandidate(a.mimeType));
  if (!files.length) return { ocr: 'not-needed', added: 0 };
  if (!settings.ocrEnabled) return { ocr: 'disabled', added: 0 };

  const outcomes: OcrOutcome[] = [];
  const texts: string[] = [];
  for (const a of files) {
    if (!fileExists(a.localUri)) {
      outcomes.push({ status: 'failed', reason: 'file' });
      continue;
    }
    const o = await runOcr(a.localUri, a.mimeType);
    outcomes.push(o);
    if (o.status === 'done') texts.push(o.result.text);
  }
  const summary = summarizeOcr(outcomes);
  const ocrText = texts.join('\n\n').trim();
  if (!ocrText) return { ...summary, added: 0 };

  // Relative dates ("내일") are anchored to the capture day, like the first analysis.
  const capturedAt = new Date(item.capturedAt);
  const mime = files[0].mimeType;
  const shared = extractFields({ text: item.displayText ?? '', url: item.sourceUrl, method: 'shared-payload', mimeType: mime, today: capturedAt });
  const fromOcr = extractFields({ text: ocrText, method: 'ocr', mimeType: mime, today: capturedAt });
  const merged = mergeReanalysis(item.fields, dedupeFields([...shared.fields, ...fromOcr.fields]));
  const kept = new Set<unknown>(item.fields);
  const nowIso = new Date().toISOString();
  const fresh: ExtractedField[] = merged.filter((f) => !kept.has(f)).map((f) => ({ ...f, id: newId('f'), itemId, createdAt: nowIso }));
  await replaceAutomaticFields(itemId, fresh);

  // The title is left alone: the review form owns it while open.
  await updateItem(itemId, { ...(settings.storeOcrText ? { ocrText } : {}), needsReview: true });
  return { ...summary, added: fresh.filter((f) => f.fieldType !== 'url').length };
}

const FAILURE_TEXT: Record<OcrFailureReason, string> = {
  memory: '이미지가 너무 커서 글자를 읽지 못했어요.',
  file: '저장된 파일을 열지 못했어요.',
  'pdf-protected': '암호가 걸린 PDF는 글자를 읽을 수 없어요.',
  'pdf-invalid': 'PDF 파일을 읽지 못했어요.',
  timeout: '글자 인식이 너무 오래 걸려 멈췄어요.',
  engine: '이미지에서 글자를 읽지 못했어요.',
};

export function ocrSummaryText(ocr: OcrSummary, reason?: OcrFailureReason): string | null {
  switch (ocr) {
    case 'not-needed':
      return null;
    case 'done':
      return '이미지에서 글자를 읽었어요. 찾은 값이 맞는지 확인해 주세요.';
    case 'partial':
      return '일부 파일만 읽었어요. 빠진 정보는 직접 넣거나 다시 시도해 주세요.';
    case 'empty':
      return '이미지에서 글자를 찾지 못했어요. 필요한 정보는 직접 넣어 주세요.';
    case 'failed':
      return `${FAILURE_TEXT[reason ?? 'engine']} 원본은 저장돼 있어요.`;
    case 'unavailable':
      return '이 기기에서는 글자 인식을 쓸 수 없어요. 필요한 정보는 직접 넣어 주세요.';
    case 'unsupported':
      return '이 파일 형식은 글자 인식을 지원하지 않아요.';
    case 'disabled':
      return '설정에서 글자 인식을 꺼 두었어요.';
    case 'deferred':
      return '임시 저장이라 아직 글자를 읽지 않았어요. ‘이미지 글자 읽기’를 눌러 주세요.';
  }
}

/** Whether a later "이미지 글자 읽기 / 다시 시도" makes sense for this summary. */
export function canRetryOcr(ocr: OcrSummary): boolean {
  return ocr === 'failed' || ocr === 'partial' || ocr === 'deferred';
}
