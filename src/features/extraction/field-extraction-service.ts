import { maskSensitive, SENSITIVE_FIELDS } from '@/domain/categories';
import type { ConfidenceLevel, ExtractedField, ExtractionMethod } from '@/domain/models';
import { formatLocal } from '@/utils/dates';

import { normalizeText } from '../ocr/text-normalizer';
import { classify, fieldSignal, type CategoryCandidate } from './category-classifier';
import { parseAddresses, parseCodes, parseMerchants, parsePhones } from './code-parser';
import { findReturnPolicyPhrases, parseDates } from './date-parser';
import { formatMoney, parseMoney } from './money-parser';
import { domainOf, extractUrls, stripUrls } from './url-utils';

/** A field before it is attached to a stored item. */
export type FieldDraft = Omit<ExtractedField, 'id' | 'itemId' | 'createdAt'>;

export interface ExtractionInput {
  /** Text shared/pasted by the user or produced by OCR. */
  text: string;
  /** URL shared explicitly (iOS/Android share of a link). */
  url?: string | null;
  method: Exclude<ExtractionMethod, 'manual'>;
  mimeType?: string | null;
  today?: Date;
}

export interface ExtractionResult {
  titleSuggestion: string;
  normalizedText: string;
  sourceUrl: string | null;
  domain: string | null;
  categories: CategoryCandidate[];
  fields: FieldDraft[];
}

/** OCR can misread digits, so OCR-derived values never start as "high". */
function cap(confidence: ConfidenceLevel, method: ExtractionInput['method']): ConfidenceLevel {
  return method === 'ocr' && confidence === 'high' ? 'medium' : confidence;
}

function draft(partial: Pick<FieldDraft, 'fieldType' | 'valueText' | 'normalizedValue' | 'role' | 'confidence' | 'method' | 'evidenceText'> & { forceConfirm?: boolean }): FieldDraft {
  const { forceConfirm, ...rest } = partial;
  return {
    ...rest,
    requiresConfirmation: forceConfirm || rest.confidence !== 'high',
    userConfirmed: false,
    userEditedAt: null,
  };
}

function suggestTitle(text: string, domain: string | null): string {
  const firstLine = stripUrls(text)
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length >= 2);
  if (firstLine) return firstLine.length > 60 ? `${firstLine.slice(0, 57)}…` : firstLine;
  if (domain) return `${domain} 링크`;
  return '';
}

/**
 * Runs every local rule over the text and returns candidates with evidence and confidence.
 * Nothing is confirmed here; the review screen decides what the user keeps.
 */
export function extractFields(input: ExtractionInput): ExtractionResult {
  const today = input.today ?? new Date();
  const text = normalizeText(input.text ?? '');
  const urls = extractUrls(text);
  const sourceUrl = input.url ?? urls[0] ?? null;
  const domain = sourceUrl ? domainOf(sourceUrl) : null;
  const method = input.method;
  const fields: FieldDraft[] = [];

  if (sourceUrl) {
    fields.push(draft({ fieldType: 'url', valueText: sourceUrl, normalizedValue: sourceUrl, role: null, confidence: 'high', method: 'shared-payload', evidenceText: null }));
  }

  for (const d of parseDates(text, { today })) {
    const confidence = cap(d.confidence, method);
    fields.push(
      draft({
        fieldType: 'date',
        valueText: formatLocal(d.value),
        normalizedValue: d.value,
        role: d.role,
        confidence,
        method: method === 'ocr' ? 'ocr' : 'regex-rule',
        evidenceText: d.evidence,
        // Unknown meaning, inferred year, relative or ambiguous dates always need a human look.
        forceConfirm: d.role === 'unknown' || d.yearInferred || d.relative || d.ambiguous,
      }),
    );
  }

  for (const m of parseMoney(text)) {
    fields.push(
      draft({
        fieldType: 'amount',
        valueText: formatMoney(m.minor, m.currency),
        normalizedValue: `${m.minor} ${m.currency}`,
        role: m.role,
        confidence: cap(m.confidence, method),
        method: method === 'ocr' ? 'ocr' : 'regex-rule',
        evidenceText: m.evidence,
      }),
    );
  }

  for (const c of [...parseCodes(text), ...parsePhones(text), ...parseAddresses(text), ...parseMerchants(text)]) {
    fields.push(
      draft({
        fieldType: c.fieldType,
        valueText: c.value,
        normalizedValue: c.value,
        role: null,
        confidence: cap(c.confidence, method),
        method: method === 'ocr' ? 'ocr' : 'regex-rule',
        evidenceText: c.evidence,
      }),
    );
  }

  for (const p of findReturnPolicyPhrases(text)) {
    fields.push(
      draft({
        fieldType: 'return-policy-text',
        valueText: p.raw,
        normalizedValue: null,
        role: null,
        confidence: 'medium',
        method: method === 'ocr' ? 'ocr' : 'regex-rule',
        evidenceText: p.raw,
        forceConfirm: true,
      }),
    );
  }

  const deduped = dedupeFields(fields);
  const categories = classify({
    text,
    domain,
    mimeType: input.mimeType,
    fieldSignals: deduped.map((f) => fieldSignal(f.fieldType, f.role)),
  });

  // Titles show up in lists and notification banners, so codes/phone numbers inside them are masked.
  let title = suggestTitle(text, domain);
  for (const f of deduped) if (SENSITIVE_FIELDS.has(f.fieldType) && f.valueText.length >= 4) title = title.split(f.valueText).join(maskSensitive(f.valueText));

  return { titleSuggestion: title, normalizedText: text, sourceUrl, domain, categories, fields: deduped };
}

function fieldKey(f: Pick<FieldDraft, 'fieldType' | 'role' | 'normalizedValue' | 'valueText'>): string {
  return `${f.fieldType}|${f.role ?? ''}|${f.normalizedValue ?? f.valueText}`;
}

export function dedupeFields<T extends Pick<FieldDraft, 'fieldType' | 'role' | 'normalizedValue' | 'valueText'>>(fields: T[]): T[] {
  const seen = new Set<string>();
  return fields.filter((f) => {
    const k = fieldKey(f);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** A field the user touched: confirmed it, edited it, or typed it in. */
export function isUserOwned(f: Pick<ExtractedField, 'userConfirmed' | 'userEditedAt' | 'method'>): boolean {
  return f.userConfirmed || f.userEditedAt != null || f.method === 'manual';
}

/**
 * Re-analysis policy: user-owned fields always win. Automatic fields from the previous run are
 * replaced by the new run; new candidates identical to a user-owned field are dropped.
 */
export function mergeReanalysis<T extends FieldDraft>(existing: T[], incoming: FieldDraft[]): (T | FieldDraft)[] {
  const kept = existing.filter(isUserOwned);
  const keptKeys = new Set(kept.map(fieldKey));
  return [...kept, ...incoming.filter((f) => !keptKeys.has(fieldKey(f)))];
}
