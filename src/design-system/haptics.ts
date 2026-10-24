import * as Haptics from 'expo-haptics';

/** Light, optional feedback. Never the only signal for any state change. */
export function tapFeedback(): void {
  if (process.env.EXPO_OS === 'web') return;
  Haptics.selectionAsync().catch(() => {});
}

export function successFeedback(): void {
  if (process.env.EXPO_OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
