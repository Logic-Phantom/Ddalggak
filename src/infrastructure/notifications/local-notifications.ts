import * as Notifications from 'expo-notifications';
// Named import: eslint-plugin-import cannot see this enum through the namespace re-export.
import { AndroidImportance } from 'expo-notifications';

import { parseLocal } from '@/utils/dates';

/**
 * Local notifications only — no push token, no server. Delivery is up to the OS (battery savers,
 * Focus modes, force-stop can delay or drop it); the in-app 기한 tab is the source of truth.
 */
let handlerSet = false;

export function configureNotifications(): void {
  if (handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
  if (process.env.EXPO_OS === 'android') {
    Notifications.setNotificationChannelAsync('reminders', { name: '기한 알림', importance: AndroidImportance.DEFAULT }).catch(() => {});
  }
}

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function getPermission(): Promise<PermissionState> {
  const s = await Notifications.getPermissionsAsync();
  if (s.granted) return 'granted';
  return s.canAskAgain ? 'undetermined' : 'denied';
}

/** Asked only when the user sets their first reminder (never at app launch). */
export async function requestPermission(): Promise<PermissionState> {
  const current = await getPermission();
  if (current !== 'undetermined') return current;
  const s = await Notifications.requestPermissionsAsync();
  return s.granted ? 'granted' : 'denied';
}

/** Schedules at a local wall-clock time. The body never contains codes, amounts or OCR text. */
export async function scheduleAt(localDateTime: string, title: string, body: string, itemId: string): Promise<string> {
  const date = parseLocal(localDateTime);
  if (!date) throw new Error('invalid date');
  return Notifications.scheduleNotificationAsync({
    content: { title, body, data: { itemId } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: 'reminders' },
  });
}

export async function cancel(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});
}

export async function cancelAll(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}

export async function scheduledIds(): Promise<string[]> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all.map((n) => n.identifier);
}

/** Opens the item when the user taps a notification. */
export function onNotificationOpened(handler: (itemId: string) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    const itemId = r.notification.request.content.data?.itemId;
    if (typeof itemId === 'string') handler(itemId);
  });
  return () => sub.remove();
}
