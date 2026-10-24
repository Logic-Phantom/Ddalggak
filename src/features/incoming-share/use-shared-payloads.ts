import { useIncomingShare } from 'expo-sharing';

import type { RawSharePayload } from './types';

/**
 * Raw payloads only (experimental expo-sharing API). Resolved payloads are deliberately not used:
 * resolving a shared web URL may fetch the page, and the app does not fetch pages on its own.
 */
export function useSharedPayloads(): { payloads: RawSharePayload[]; clear: () => void; refresh: () => void } {
  const { sharedPayloads, clearSharedPayloads, refreshSharePayloads } = useIncomingShare();
  return { payloads: sharedPayloads as RawSharePayload[], clear: clearSharedPayloads, refresh: refreshSharePayloads };
}
