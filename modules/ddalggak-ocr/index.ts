import { requireOptionalNativeModule } from 'expo';

/** Raw result of the native module (see android/.../DdalggakOcrModule.kt). */
export interface NativeOcrResult {
  text: string;
  lines: { text: string; box: { x: number; y: number; width: number; height: number } | null }[];
  engine: string;
  engineVersion: string;
  durationMs: number;
  pageCount: number;
  pagesRead: number;
}

export interface DdalggakOcrNativeModule {
  isAvailable(): boolean;
  /** Local file URI only. `maxSide` caps the decoded image's longest side (memory). */
  recognizeImage(uri: string, maxSide: number): Promise<NativeOcrResult>;
  /** Renders the first `maxPages` pages with Android PdfRenderer and recognizes each. */
  recognizePdf(uri: string, maxPages: number, maxSide: number): Promise<NativeOcrResult>;
}

/**
 * `null` when the native module is not linked: iOS (not implemented yet), web, Expo Go, or a
 * build made before this module existed. Callers must treat that as "OCR unavailable".
 */
export const DdalggakOcr = requireOptionalNativeModule<DdalggakOcrNativeModule>('DdalggakOcr');
