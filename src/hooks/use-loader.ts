import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { logError } from '@/domain/errors';

import { useAppState } from './app-state';

/**
 * Loads data while the screen is focused and reloads whenever it regains focus, app data changes,
 * or `deps` change (e.g. a search query). Keeps the previous value while reloading so lists don't
 * flash empty. A plain effect keyed on the inputs — no memoized-callback identity tricks.
 */
export function useLoader<T>(load: () => Promise<T>, deps: unknown[] = []): { data: T | undefined; error: boolean; loading: boolean; reload: () => void } {
  const { dataVersion, ready } = useAppState();
  const isFocused = useIsFocused();
  const [data, setData] = useState<T>();
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const seq = useRef(0);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    if (!ready || !isFocused) return;
    const id = ++seq.current;
    loadRef
      .current()
      .then((d) => {
        if (id !== seq.current) return;
        setData(d);
        setError(false);
      })
      .catch((e) => {
        logError('load', e);
        if (id === seq.current) setError(true);
      })
      .finally(() => id === seq.current && setLoading(false));
  }, [ready, isFocused, dataVersion, depsKey, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading, reload };
}
