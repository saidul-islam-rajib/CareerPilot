import { Pressable, View } from 'react-native';
import { Check, type LucideIcon } from '@/ui/icons';
import { useTheme } from '@/core/theme/theme';
import { Icon, IconSize } from './icon';
import { Text, TextTone, TextVariant } from './text';

export interface Choice<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: LucideIcon;
}

export interface ChoiceListProps<T extends string> {
  label: string;
  choices: ReadonlyArray<Choice<T>>;
  value: T;
  onChange: (value: T) => void;
  compact?: boolean;
}

export function ChoiceList<T extends string>({ label, choices, value, onChange, compact = false }: ChoiceListProps<T>) {
  const theme = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: theme.space.xs }}>
      <Text variant={TextVariant.Label}>{label}</Text>
      <View style={{ flexDirection: compact ? 'row' : 'column', flexWrap: compact ? 'wrap' : 'nowrap', gap: theme.space.xs }}>
        {choices.map((choice) => {
          const selected = choice.value === value;
          return (
            <Pressable
              key={choice.value}
              accessibilityRole="radio"
              accessibilityLabel={choice.label}
              accessibilityState={{ selected, checked: selected }}
              onPress={() => onChange(choice.value)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space.sm,
                minHeight: theme.touchTarget,
                paddingHorizontal: theme.space.md,
                borderRadius: theme.radius.control,
                borderWidth: theme.borderWidth.hairline,
                borderColor: selected ? theme.colors.primary : theme.colors.border,
                backgroundColor: selected ? theme.colors.primarySubtle : theme.colors.background,
              }}
            >
              {choice.icon ? <Icon icon={choice.icon} color={selected ? theme.colors.primary : theme.colors.textMuted} /> : null}
              <View style={compact ? undefined : { flex: 1, gap: theme.space.xxs, paddingVertical: choice.description ? theme.space.sm : 0 }}>
                <Text variant={TextVariant.Label} tone={selected ? TextTone.Primary : TextTone.Default}>
                  {choice.label}
                </Text>
                {choice.description ? (
                  <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
                    {choice.description}
                  </Text>
                ) : null}
              </View>
              {selected && !compact ? <Icon icon={Check} size={IconSize.Small} color={theme.colors.primary} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
