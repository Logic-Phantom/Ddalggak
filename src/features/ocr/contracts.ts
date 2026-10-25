/**
 * OCR contract. Engines (Android ML Kit Korean today, iOS Vision later) plug in behind this
 * interface so the UI never knows which engine ran. See docs/OCR_AND_EXTRACTION.md.
 */
export interface OcrLine {
  text: string;
  /** Engine confidence 0–1 when the engine reports one. */
  confidence?: number;
  /** Bounding box in source-image pixels when available. */
  box?: { x: number; y: number; width: number; height: number };
}

export interface OcrResult {
  text: string;
  lines: OcrLine[];
  engine: string;
  engineVersion?: string;
  durationMs: number;
  /** Documents only: total pages and how many were recognized (the rest were skipped). */
  pageCount?: number;
  pagesRead?: number;
}

export interface OcrProvider {
  readonly id: string;
  /** Whether the engine can run on this device/build (e.g. native module linked, model present). */
  isAvailable(): Promise<boolean>;
  /** Recognizes text in a local image file URI. Must not upload anything. */
  recognize(imageUri: string, options: { languageHints: string[] }): Promise<OcrResult>;
  /** Optional: renders the first pages of a local PDF and recognizes them. Must not upload anything. */
  recognizeDocument?(uri: string, options: { languageHints: string[]; maxPages: number }): Promise<OcrResult>;
}

export type OcrFailureReason = 'memory' | 'file' | 'pdf-protected' | 'pdf-invalid' | 'timeout' | 'engine';

export type OcrOutcome =
  | { status: 'done'; result: OcrResult }
  /** The engine ran but found no text. */
  | { status: 'empty'; result: OcrResult }
  | { status: 'unavailable' }
  | { status: 'unsupported-type' }
  | { status: 'failed'; reason: OcrFailureReason };
