/**
 * expo-sharing opens the app with `ddalggak://expo-sharing` when content is shared into it
 * (Android intent / iOS share extension). Route that to the capture screen, which reads the payload.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    if (path.includes('expo-sharing')) return '/capture?source=share';
    return path;
  } catch {
    return '/';
  }
}
