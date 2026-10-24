/**
 * OCR contract. Engines (iOS Vision, Android ML Kit Korean, …) plug in behind this interface so
 * the UI never knows which engine ran. Engine selection is pending the Phase 0 POC
 * (docs/OCR_AND_EXTRACTION.md); until then the app ships the `unavailable` provider.
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
}

export interface OcrProvider {
  readonly id: string;
  /** Whether the engine can run on this device/build (e.g. native module linked, model present). */
  isAvailable(): Promise<boolean>;
  /** Recognizes text in a local image file URI. Must not upload anything. */
  recognize(imageUri: string, options: { languageHints: string[] }): Promise<OcrResult>;
}

export type OcrOutcome =
  | { status: 'done'; result: OcrResult }
  | { status: 'unavailable' }
  | { status: 'unsupported-type' }
  | { status: 'failed' };
