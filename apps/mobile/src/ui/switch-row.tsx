import { Switch, View } from 'react-native';
import { useTheme } from '@/core/theme/theme';
import { Text, TextTone, TextVariant } from './text';

export interface SwitchRowProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  testID?: string;
}

export function SwitchRow({ label, description, value, onChange, testID }: SwitchRowProps) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md, minHeight: theme.touchTarget }}>
      <View style={{ flex: 1, gap: theme.space.xs }}>
        <Text variant={TextVariant.Subheading}>{label}</Text>
        {description ? <Text tone={TextTone.Muted}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        accessibilityHint={description}
        trackColor={{ false: theme.colors.input, true: theme.colors.primary }}
        thumbColor={theme.colors.background}
        ios_backgroundColor={theme.colors.input}
        testID={testID}
      />
    </View>
  );
}
