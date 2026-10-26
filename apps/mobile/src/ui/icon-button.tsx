import { Pressable } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/core/theme/theme';
import { Icon } from './icon';

export interface IconButtonProps {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  testID?: string;
}

export function IconButton({ icon, label, onPress, testID }: IconButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        width: theme.touchTarget,
        height: theme.touchTarget,
        borderRadius: theme.radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? theme.colors.primarySubtle : theme.colors.neutralSubtle,
      })}
    >
      <Icon icon={icon} color={theme.colors.primary} />
    </Pressable>
  );
}
