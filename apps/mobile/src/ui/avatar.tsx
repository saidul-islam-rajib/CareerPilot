import { Image } from 'expo-image';
import { View } from 'react-native';
import { initials } from '@careerpilot/domain-ui-logic';
import { useTheme } from '@/core/theme/theme';
import { Text, TextVariant } from './text';

export function Avatar({ name, uri, size }: { name: string; uri?: string; size: number }) {
  const theme = useTheme();
  const shape = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return <Image source={{ uri }} style={shape} accessibilityLabel={name} contentFit="cover" />;
  }
  return (
    <View accessible accessibilityLabel={name} style={[shape, { backgroundColor: theme.colors.primarySubtle, alignItems: 'center', justifyContent: 'center' }]}>
      <Text variant={TextVariant.Title} tone="primary">
        {initials(name)}
      </Text>
    </View>
  );
}
