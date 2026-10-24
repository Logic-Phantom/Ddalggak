import type { RawSharePayload } from './types';

/** Web preview: there is no OS share target, so nothing is ever received. */
export function useSharedPayloads(): { payloads: RawSharePayload[]; clear: () => void; refresh: () => void } {
  return { payloads: [], clear: () => {}, refresh: () => {} };
}
