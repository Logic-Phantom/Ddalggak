import Constants, { ExecutionEnvironment } from 'expo-constants';

import { parseLocal } from '@/utils/dates';

/**
 * Local notifications only — no push token, no server. Delivery is up to the OS (battery savers,
 * Focus modes, force-stop can delay or drop it); the in-app 알림 tab is the source of truth.
 * No exact-alarm permission is requested, so Android may deliver a few minutes late (Doze).
 *
 * expo-notifications is loaded lazily: Expo Go (Android) lacks some of its native modules and the
 * package throws on import there. In that case notifications are reported as unavailable and
 * reminders stay in-app only.
 */
type NotificationsModule = typeof import('expo-notifications');
let cached: NotificationsModule | null | undefined;

function N(): NotificationsModule | null {
  if (cached !== undefined) return cached;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return (cached = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- must stay lazy (see above)
    cached = require('expo-notifications') as NotificationsModule;
  } catch {
    cached = null;
  }
  return cached;
}

export function notificationsAvailable(): boolean {
  return N() != null;
}

let handlerSet = false;

export function configureNotifications(): void {
  const n = N();
  if (!n || handlerSet) return;
  handlerSet = true;
  n.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
  if (process.env.EXPO_OS === 'android') {
    n.setNotificationChannelAsync('reminders', { name: '기한 알림', importance: n.AndroidImportance.DEFAULT }).catch(() => {});
  }
}

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export async function getPermission(): Promise<PermissionState> {
  const n = N();
  if (!n) return 'unavailable';
  const s = await n.getPermissionsAsync();
  if (s.granted) return 'granted';
  return s.canAskAgain ? 'undetermined' : 'denied';
}

/** Asked only when the user sets their first reminder (never at app launch). */
export async function requestPermission(): Promise<PermissionState> {
  const n = N();
  if (!n) return 'unavailable';
  const current = await getPermission();
  if (current !== 'undetermined') return current;
  const s = await n.requestPermissionsAsync();
  return s.granted ? 'granted' : 'denied';
}

/** Schedules at a local wall-clock time. The body never contains codes, amounts or OCR text. */
export async function scheduleAt(localDateTime: string, title: string, body: string, itemId: string): Promise<string> {
  const n = N();
  if (!n) throw new Error('notifications unavailable');
  const date = parseLocal(localDateTime);
  if (!date) throw new Error('invalid date');
  return n.scheduleNotificationAsync({
    content: { title, body, data: { itemId } },
    trigger: { type: n.SchedulableTriggerInputTypes.DATE, date, channelId: 'reminders' },
  });
}

export async function cancel(notificationId: string): Promise<void> {
  await N()?.cancelScheduledNotificationAsync(notificationId).catch(() => {});
}

export async function cancelAll(): Promise<void> {
  await N()?.cancelAllScheduledNotificationsAsync().catch(() => {});
}

export async function scheduledIds(): Promise<string[]> {
  const n = N();
  if (!n) return [];
  const all = await n.getAllScheduledNotificationsAsync();
  return all.map((x) => x.identifier);
}

/**
 * Opens the item when the user taps a notification. A tap that launched the app from a killed state
 * fires before this listener exists, so the last response is read once and then cleared.
 */
export function onNotificationOpened(handler: (itemId: string) => void): () => void {
  const n = N();
  if (!n) return () => {};
  const open = (r: import('expo-notifications').NotificationResponse | null) => {
    const itemId = r?.notification.request.content.data?.itemId;
    if (typeof itemId === 'string') handler(itemId);
  };
  let alive = true;
  n.getLastNotificationResponseAsync()
    .then((r) => {
      if (!alive || !r) return;
      open(r);
      return n.clearLastNotificationResponseAsync();
    })
    .catch(() => {});
  const sub = n.addNotificationResponseReceivedListener((r) => {
    open(r);
    n.clearLastNotificationResponseAsync().catch(() => {});
  });
  return () => {
    alive = false;
    sub.remove();
  };
}
