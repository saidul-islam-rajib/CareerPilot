import { Pressable, View } from 'react-native';
import { Minus, Plus, type LucideIcon } from 'lucide-react-native';
import { useT } from '@/core/i18n/i18n';
import { useTheme } from '@/core/theme/theme';
import { Icon } from './icon';
import { Text, TextVariant } from './text';

export interface StepperProps {
  name: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

function StepButton({ icon, label, disabled, onPress }: { icon: LucideIcon; label: string; disabled: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        width: theme.touchTarget,
        height: theme.touchTarget,
        borderRadius: theme.radius.control,
        borderWidth: theme.borderWidth.hairline,
        borderColor: theme.colors.input,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? theme.opacity.disabled : 1,
      }}
    >
      <Icon icon={icon} color={theme.colors.primary} />
    </Pressable>
  );
}

export function Stepper({ name, value, min, max, onChange }: StepperProps) {
  const t = useT();
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }} accessibilityRole="adjustable" accessibilityLabel={name} accessibilityValue={{ min, max, now: value }}>
      <StepButton icon={Minus} label={t('common.decrease', { name })} disabled={value <= min} onPress={() => onChange(value - 1)} />
      <View style={{ minWidth: theme.touchTarget, alignItems: 'center' }} accessibilityLiveRegion="polite">
        <Text variant={TextVariant.Title} accessibilityLabel={t('common.valueOf', { name, value })}>
          {value}
        </Text>
      </View>
      <StepButton icon={Plus} label={t('common.increase', { name })} disabled={value >= max} onPress={() => onChange(value + 1)} />
    </View>
  );
}
