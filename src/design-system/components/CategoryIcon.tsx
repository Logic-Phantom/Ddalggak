import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native';

import { CATEGORY_INFO } from '@/domain/categories';
import type { Category } from '@/domain/models';

import { categoryTones, spacing } from '../tokens';
import { useColors } from '../theme';
import { AppText } from './AppText';
import type { IconName } from './Buttons';

export function useCategoryTone(category: Category): { bg: string; fg: string } {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return categoryTones[scheme][CATEGORY_INFO[category].tone];
}

/** Pastel circle with the category icon. Decorative: the label is always shown or read next to it. */
export function CategoryIcon({ category, size = 44 }: { category: Category; size?: number }) {
  const tone = useCategoryTone(category);
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: tone.bg }]} accessible={false}>
      <Ionicons name={CATEGORY_INFO[category].icon as IconName} size={Math.round(size * 0.46)} color={tone.fg} />
    </View>
  );
}

/** Icon + short label stacked (home grid). `selected` adds a ring and the selected state. */
export function CategoryTile({ category, label, onPress, selected, icon }: { category: Category | 'all'; label?: string; onPress: () => void; selected?: boolean; icon?: IconName }) {
  const c = useColors();
  const text = label ?? (category === 'all' ? '전체' : CATEGORY_INFO[category].short);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={text} accessibilityState={{ selected: !!selected }} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7 }]}>
      <View style={[styles.ring, { borderColor: selected ? c.accent : 'transparent' }]}>
        {category === 'all' ? (
          <View style={[styles.circle, { width: 44, height: 44, borderRadius: 22, backgroundColor: c.accentSoft }]}>
            <Ionicons name={icon ?? 'apps'} size={20} color={c.accentText} />
          </View>
        ) : (
          <CategoryIcon category={category} />
        )}
      </View>
      <AppText variant="caption" tone={selected ? 'primary' : 'secondary'} numberOfLines={1} style={selected ? { fontWeight: '700' } : undefined}>
        {text}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  tile: { alignItems: 'center', gap: spacing.xxs, minWidth: 56 },
  ring: { borderWidth: 2, borderRadius: 26, padding: 1 },
});
