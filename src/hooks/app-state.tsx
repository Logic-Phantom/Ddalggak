import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { logError } from '@/domain/errors';
import { DEFAULT_SETTINGS, type AppSettings } from '@/domain/models';
import { reconcileStorage } from '@/features/items/item-service';
import { loadSettings, saveSettings } from '@/features/preferences/settings-repository';
import { reconcileNotifications } from '@/features/reminders/reminder-service';
import { getDb } from '@/infrastructure/database/database';
import { configureNotifications } from '@/infrastructure/notifications/local-notifications';

interface AppState {
  ready: boolean;
  dbError: boolean;
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  /** Bumped after any write so list screens reload. */
  dataVersion: number;
  notifyDataChanged: () => void;
  retry: () => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [dbError, setDbError] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [dataVersion, setDataVersion] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await getDb();
        const s = await loadSettings();
        if (!alive) return;
        setSettings(s);
        setDbError(false);
        configureNotifications();
        // Housekeeping runs after the UI is usable; failures are logged, never shown as blockers.
        reconcileStorage()
          .then(() => reconcileNotifications())
          .then(() => alive && setDataVersion((v) => v + 1))
          .catch((e) => logError('startup', e));
      } catch (e) {
        logError('db.open', e);
        if (alive) setDbError(true);
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [attempt]);

  const updateSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      const next = { ...settings, ...patch };
      setSettings(next);
      await saveSettings(next);
    },
    [settings],
  );

  const notifyDataChanged = useCallback(() => setDataVersion((v) => v + 1), []);
  const retry = useCallback(() => {
    setReady(false);
    setAttempt((a) => a + 1);
  }, []);

  const value = useMemo(() => ({ ready, dbError, settings, updateSettings, dataVersion, notifyDataChanged, retry }), [ready, dbError, settings, updateSettings, dataVersion, notifyDataChanged, retry]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppState outside provider');
  return v;
}
