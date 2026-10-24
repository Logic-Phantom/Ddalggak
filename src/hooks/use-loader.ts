import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { logError } from '@/domain/errors';

import { useAppState } from './app-state';

/**
 * Loads data when the screen gains focus and whenever app data changes or `deps` change.
 * Keeps the previous value while reloading so lists don't flash empty.
 */
export function useLoader<T>(load: () => Promise<T>, deps: unknown[] = []): { data: T | undefined; error: boolean; loading: boolean; reload: () => void } {
  const { dataVersion, ready } = useAppState();
  const [data, setData] = useState<T>();
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  const depsKey = JSON.stringify(deps);

  const run = useCallback(() => {
    if (!ready) return;
    const id = ++seq.current;
    setLoading(true);
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
  }, [ready, dataVersion, depsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useFocusEffect(run);
  return { data, error, loading, reload: run };
}
