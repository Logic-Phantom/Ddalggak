import { AppError, logError, type AppErrorCode } from '@/domain/errors';
import { ITEM_SCHEMA_VERSION, type AppSettings, type Attachment, type ExtractedField, type SourceType } from '@/domain/models';
import { deleteFile, deleteItemFiles, fileSize, importFile, readFileHead } from '@/infrastructure/file-storage/app-files';
import { newId } from '@/utils/id';

import { extractFields } from '../extraction/field-extraction-service';
import { normalizeUrl } from '../extraction/url-utils';
import { checkFile, sanitizeFileName } from '../incoming-share/mime-validation';
import type { CaptureInput } from '../incoming-share/types';
import { insertItem } from '../items/item-repository';
import { runOcr } from '../ocr/ocr-service';

export type OcrSummary = 'not-needed' | 'done' | 'unavailable' | 'failed' | 'pdf-not-supported';

export interface CaptureOutcome {
  itemId: string;
  ocr: OcrSummary;
  /** Files that could not be imported (the rest of the capture still succeeded). */
  skipped: AppErrorCode[];
}

function primarySource(inputs: CaptureInput[]): SourceType {
  return inputs.find((i) => i.kind === 'file')?.sourceType ?? inputs.find((i) => i.kind === 'url')?.sourceType ?? inputs[0]?.sourceType ?? 'manual';
}

/**
 * Turns one capture (share, paste, or picker) into a draft item:
 * copy files into app storage → validate real type → local OCR (if available) → rule extraction.
 * Nothing is confirmed; the review screen does that. Network is never used.
 */
export async function createDraft(inputs: CaptureInput[], settings: AppSettings, now = new Date()): Promise<CaptureOutcome> {
  if (!inputs.length) throw new AppError('share-empty');
  const itemId = newId('i');
  const nowIso = now.toISOString();
  const texts: string[] = [];
  let url: string | null = null;
  const attachments: Attachment[] = [];
  const skipped: AppErrorCode[] = [];
  const ocrTexts: string[] = [];
  const ocrStates: OcrSummary[] = [];
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

    const ocr = await runOcr(stored.uri, check.mimeType);
    if (ocr.status === 'done') {
      ocrTexts.push(ocr.result.text);
      ocrStates.push('done');
    } else ocrStates.push(ocr.status === 'unsupported-type' ? 'pdf-not-supported' : ocr.status);

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
  const ocr: OcrSummary = ocrStates.includes('done') ? 'done' : ocrStates.includes('failed') ? 'failed' : ocrStates.includes('unavailable') ? 'unavailable' : ocrStates.length ? 'pdf-not-supported' : 'not-needed';

  await insertItem({
    item: {
      id: itemId,
      title,
      category: categories[0].category,
      status: 'draft',
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

  return { itemId, ocr, skipped };
}

export const OCR_SUMMARY_TEXT: Record<OcrSummary, string | null> = {
  'not-needed': null,
  done: '이미지에서 글자를 읽었어요. 추출된 값은 꼭 확인해 주세요.',
  unavailable: '이 버전에서는 아직 이미지 글자 인식(OCR)을 지원하지 않아요. 제목과 날짜를 직접 입력해 주세요.',
  failed: '이미지에서 글자를 읽지 못했어요. 직접 입력하거나 나중에 다시 시도해 주세요.',
  'pdf-not-supported': 'PDF 글자 인식은 아직 지원하지 않아요. 필요한 정보를 직접 입력해 주세요.',
};
