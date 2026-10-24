/** Web preview: local notifications are not supported; reminders stay visible in the 기한 tab. */
export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export function notificationsAvailable(): boolean {
  return false;
}

export function configureNotifications(): void {}

export async function getPermission(): Promise<PermissionState> {
  return 'unavailable';
}

export async function requestPermission(): Promise<PermissionState> {
  return 'unavailable';
}

export async function scheduleAt(_localDateTime: string, _title: string, _body: string, _itemId: string): Promise<string> {
  throw new Error('notifications are not available on web');
}

export async function cancel(_notificationId: string): Promise<void> {}

export async function cancelAll(): Promise<void> {}

export async function scheduledIds(): Promise<string[]> {
  return [];
}

export function onNotificationOpened(_handler: (itemId: string) => void): () => void {
  return () => {};
}
