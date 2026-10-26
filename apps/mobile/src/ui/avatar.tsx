import { Image } from 'expo-image';
import { View } from 'react-native';
import { cropPlacement, initials, type PhotoCrop } from '@careerpilot/domain-ui-logic';
import { useTheme } from '@/core/theme/theme';
import { Text, TextVariant } from './text';

export function Avatar({ name, uri, crop, size }: { name: string; uri?: string; crop?: PhotoCrop; size: number }) {
  const theme = useTheme();
  const shape = { width: size, height: size, borderRadius: size / 2 };
  if (uri && crop) {
    const place = cropPlacement(crop);
    return (
      <View accessible accessibilityRole="image" accessibilityLabel={name} style={[shape, { overflow: 'hidden', backgroundColor: theme.colors.neutralSubtle }]}>
        <Image
          source={{ uri }}
          contentFit="fill"
          style={{ position: 'absolute', width: `${place.width}%`, height: `${place.height}%`, left: `${place.left}%`, top: `${place.top}%` }}
        />
      </View>
    );
  }
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
