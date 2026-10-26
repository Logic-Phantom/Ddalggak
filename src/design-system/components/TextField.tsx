import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useColors } from '../theme';
import { fonts, radius, spacing, touchTarget } from '../tokens';
import { AppText } from './AppText';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Helper below the field; replaced by `error` when present. */
  hint?: string;
  error?: string | null;
  multiline?: boolean;
}

/** Labelled input. The visible label doubles as the accessibility label; errors are announced. */
export function TextField({ label, hint, error, multiline, ...rest }: TextFieldProps) {
  const c = useColors();
  return (
    <View style={{ gap: spacing.xxs }}>
      <AppText variant="label" tone="secondary">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={c.textTertiary}
        multiline={multiline}
        maxFontSizeMultiplier={2}
        style={[
          styles.input,
          multiline && styles.multiline,
          { backgroundColor: c.surface, borderColor: error ? c.error : c.border, color: c.textPrimary },
          multiline && { lineHeight: 24 },
        ]}
        {...rest}
      />
      {error ? (
        <AppText variant="caption" tone="error" accessibilityLiveRegion="polite">{error}</AppText>
      ) : hint ? (
        <AppText variant="caption" tone="tertiary">{hint}</AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: touchTarget + 4,
    borderWidth: 1,
    borderRadius: radius.button,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 16,
    fontFamily: fonts.regular,
  },
  multiline: { minHeight: 140, textAlignVertical: 'top', paddingTop: spacing.sm, borderRadius: radius.card, paddingHorizontal: spacing.md },
});
