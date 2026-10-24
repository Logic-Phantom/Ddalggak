import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { fonts, useColors } from '@/design-system';

type IconName = ComponentProps<typeof Ionicons>['name'];

const icon = (outline: IconName, filled: IconName) =>
  function TabIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    return <Ionicons name={focused ? filled : outline} color={color as string} size={size} />;
  };

/** Web (dev preview only): JS bottom tabs. iOS/Android use native tabs (_layout.tsx). */
export default function TabsLayoutWeb() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textTertiary,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        tabBarLabelStyle: { fontFamily: fonts.semibold },
      }}>
      <Tabs.Screen name="index" options={{ title: '인박스', tabBarIcon: icon('file-tray-outline', 'file-tray') }} />
      <Tabs.Screen name="search" options={{ title: '검색', tabBarIcon: icon('search-outline', 'search') }} />
      <Tabs.Screen name="reminders" options={{ title: '기한', tabBarIcon: icon('notifications-outline', 'notifications') }} />
      <Tabs.Screen name="settings" options={{ title: '설정', tabBarIcon: icon('settings-outline', 'settings') }} />
    </Tabs>
  );
}
