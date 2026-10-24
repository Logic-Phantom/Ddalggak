import { DEFAULT_SETTINGS, type AppSettings } from '@/domain/models';
import { kvGet, kvSet } from '@/infrastructure/database/database';

const KEY = 'settings.v1';

export async function loadSettings(): Promise<AppSettings> {
  const stored = await kvGet<Partial<AppSettings>>(KEY);
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await kvSet(KEY, settings);
}
