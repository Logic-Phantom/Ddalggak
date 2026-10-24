import type { AppErrorCode } from '@/domain/errors';
import type { SourceType } from '@/domain/models';

/**
 * Mirror of expo-sharing's raw `SharePayload` so the normalizer stays a pure, testable function.
 * Only raw payloads are used: resolving them (`getResolvedSharedPayloadsAsync`) may fetch web pages,
 * which the product does not do automatically.
 */
export interface RawSharePayload {
  value: string;
  shareType: 'text' | 'url' | 'audio' | 'image' | 'video' | 'file';
  mimeType?: string;
}

export type CaptureInput =
  | { kind: 'text'; text: string; sourceType: SourceType }
  | { kind: 'url'; url: string; text: string | null; sourceType: SourceType }
  | { kind: 'file'; uri: string; mimeType: string; name: string | null; size: number | null; sourceType: SourceType };

export interface RejectedPayload {
  shareType: RawSharePayload['shareType'];
  reason: AppErrorCode;
}

export interface NormalizedShare {
  inputs: CaptureInput[];
  rejected: RejectedPayload[];
}
