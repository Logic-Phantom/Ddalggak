import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View, type ColorValue } from 'react-native';

import { elevation, fonts, useColors } from '@/design-system';

type IconName = ComponentProps<typeof Ionicons>['name'];

const icon = (outline: IconName, filled: IconName) =>
  function TabIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    return <Ionicons name={focused ? filled : outline} color={color as string} size={size} />;
  };

/** Center "+" opens the capture screen instead of switching tabs. */
function AddButton() {
  const router = useRouter();
  const c = useColors();
  return (
    <View style={styles.addWrap}>
      <Pressable
        onPress={() => router.push('/capture')}
        accessibilityRole="button"
        accessibilityLabel="새 항목 추가"
        testID="tab-add"
        style={({ pressed }) => [styles.add, elevation.raised, { backgroundColor: pressed ? c.accentPressed : c.accent }]}>
        <Ionicons name="add" size={30} color={c.textOnAccent} />
      </Pressable>
    </View>
  );
}

/** 홈 · 보관함 · (+) · 알림 · 마이페이지. JS tabs on every platform so the center action can be custom. */
export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textTertiary,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border, height: 64, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
      }}>
      <Tabs.Screen name="index" options={{ title: '홈', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="library" options={{ title: '보관함', tabBarIcon: icon('folder-open-outline', 'folder-open') }} />
      <Tabs.Screen name="add" options={{ title: '추가', tabBarButton: () => <AddButton /> }} />
      <Tabs.Screen name="reminders" options={{ title: '알림', tabBarIcon: icon('notifications-outline', 'notifications') }} />
      <Tabs.Screen name="me" options={{ title: '마이', tabBarIcon: icon('person-outline', 'person') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  addWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  add: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginTop: -10 },
});
