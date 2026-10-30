import { useState } from 'react';
import { useT } from '@careerpilot/client-core';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';
import { Eye, EyeOff } from '@/ui/icons';
import { useTheme } from '@/core/theme/theme';
import { Icon } from './icon';
import { bareInput } from './input-focus';
import { Text, TextTone, TextVariant } from './text';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  errorParams?: Record<string, string | number>;
  hint?: string;
  secret?: boolean;
}

export function TextField({ label, error, errorParams, hint, secret = false, ...rest }: TextFieldProps) {
  const theme = useTheme();
  const t = useT();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const message = error ? t(error, errorParams) : hint;
  const borderColor = error ? theme.colors.danger : focused ? theme.colors.primary : theme.colors.input;
  return (
    <View style={{ gap: theme.space.xs }}>
      <Text variant={TextVariant.Label}>{label}</Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: theme.touchTarget,
          borderWidth: focused || error ? theme.borderWidth.focus : theme.borderWidth.hairline,
          borderColor,
          borderRadius: theme.radius.control,
          backgroundColor: theme.colors.background,
          paddingHorizontal: theme.space.md,
        }}
      >
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={message}
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry={secret && !revealed}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ ...bareInput, flex: 1, color: theme.colors.text, fontSize: theme.fontSize.md, paddingVertical: theme.space.sm }}
          {...rest}
        />
        {secret ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? t('common.hidePassword') : t('common.showPassword')}
            onPress={() => setRevealed((v) => !v)}
            hitSlop={theme.space.sm}
          >
            <Icon icon={revealed ? EyeOff : Eye} color={theme.colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {message ? (
        <Text variant={TextVariant.Caption} tone={error ? TextTone.Danger : TextTone.Muted} accessibilityLiveRegion={error ? 'polite' : 'none'}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}
