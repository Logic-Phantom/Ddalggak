import type { OcrProvider } from './contracts';

/**
 * Honest placeholder: reports OCR as unavailable instead of returning fake text.
 * The capture flow then falls back to manual entry. Replace via setOcrProvider() after the POC.
 */
export const unavailableOcrProvider: OcrProvider = {
  id: 'unavailable',
  async isAvailable() {
    return false;
  },
  async recognize() {
    throw new Error('OCR provider not configured');
  },
};
