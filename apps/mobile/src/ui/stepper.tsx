import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useT } from '@careerpilot/client-core';
import { Minus, Plus, type LucideIcon } from '@/ui/icons';
import { useTheme } from '@/core/theme/theme';
import { Icon } from './icon';
import { Text, TextTone, TextVariant } from './text';

export interface StepperProps {
  name: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

const WHOLE_NUMBER = /^\d+$/;

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
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const typed = (next: string) => {
    setText(next);
    const number = Number(next);
    if (WHOLE_NUMBER.test(next) && number >= min && number <= max) {
      onChange(number);
    }
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }} accessibilityLabel={name}>
      <StepButton icon={Minus} label={t('common.decrease', { name })} disabled={value <= min} onPress={() => onChange(value - 1)} />
      <TextInput
        value={text}
        onChangeText={typed}
        onBlur={() => setText(String(value))}
        keyboardType="number-pad"
        maxLength={String(max).length}
        selectTextOnFocus
        accessibilityLabel={t('common.valueOf', { name, value })}
        style={{
          minWidth: theme.touchTarget + theme.space.xl,
          height: theme.touchTarget,
          borderRadius: theme.radius.control,
          borderWidth: theme.borderWidth.hairline,
          borderColor: theme.colors.input,
          backgroundColor: theme.colors.card,
          color: theme.colors.text,
          textAlign: 'center',
          fontSize: theme.fontSize.xxl,
          fontWeight: theme.fontWeight.bold,
        }}
      />
      <StepButton icon={Plus} label={t('common.increase', { name })} disabled={value >= max} onPress={() => onChange(value + 1)} />
      <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
        {t('common.range', { min, max })}
      </Text>
    </View>
  );
}
