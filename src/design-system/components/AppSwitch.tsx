import { Switch, type SwitchProps } from 'react-native';

import { useColors } from '../theme';

/** Platform switch tinted with design tokens (native look, token colors). */
export function AppSwitch(props: SwitchProps & { accessibilityLabel: string }) {
  const c = useColors();
  return <Switch trackColor={{ false: c.borderStrong, true: c.accent }} thumbColor={c.surface} ios_backgroundColor={c.borderStrong} {...props} />;
}
