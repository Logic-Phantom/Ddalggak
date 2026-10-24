import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { darkColors, fonts, lightColors } from '@/design-system';
import { AppStateProvider, useAppState } from '@/hooks/app-state';
import { onNotificationOpened } from '@/infrastructure/notifications/local-notifications';

SplashScreen.preventAutoHideAsync().catch(() => {});

const FONT_FILES = {
  [fonts.regular]: require('@/assets/fonts/Pretendard-Regular.otf'),
  [fonts.medium]: require('@/assets/fonts/Pretendard-Medium.otf'),
  [fonts.semibold]: require('@/assets/fonts/Pretendard-SemiBold.otf'),
  [fonts.bold]: require('@/assets/fonts/Pretendard-Bold.otf'),
};

/** Hides the splash once the database is open, and routes notification taps to the item. */
function StartupEffects() {
  const { ready } = useAppState();
  const router = useRouter();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  useEffect(() => onNotificationOpened((itemId) => router.push({ pathname: '/item/[id]', params: { id: itemId } })), [router]);
  return null;
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  // A font that fails to load falls back to the system font; never block the app on it.
  if (!fontsLoaded && !fontError) return null;

  const c = scheme === 'dark' ? darkColors : lightColors;
  const navTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <SafeAreaProvider>
      <ThemeProvider value={{ ...navTheme, colors: { ...navTheme.colors, background: c.background, card: c.surface, text: c.textPrimary, primary: c.accent, border: c.border } }}>
        <AppStateProvider>
          <StartupEffects />
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerBackButtonDisplayMode: 'minimal',
              headerStyle: { backgroundColor: c.background },
              headerTintColor: c.textPrimary,
              headerTitleStyle: { fontFamily: fonts.bold },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: c.background },
            }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false, title: '인박스' }} />
            <Stack.Screen name="capture/index" options={{ title: '추가하기' }} />
            <Stack.Screen name="capture/review" options={{ title: '내용 확인', gestureEnabled: false }} />
            <Stack.Screen name="item/[id]" options={{ title: '상세' }} />
            <Stack.Screen name="item/edit/[id]" options={{ title: '수정' }} />
            <Stack.Screen name="category/[category]" options={{ title: '분류' }} />
            <Stack.Screen name="archive" options={{ title: '보관함·완료' }} />
            <Stack.Screen name="privacy" options={{ title: '개인정보와 데이터' }} />
          </Stack>
        </AppStateProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
