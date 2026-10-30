import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Reply } from '@/ui/icons';
import { useTheme } from '@/core/theme/theme';
import { Icon } from '@/ui';

export function SwipeToReply({ onReply, children }: { onReply: () => void; children: ReactNode }) {
  const theme = useTheme();
  const distance = theme.gesture.swipeReply;
  const offset = useSharedValue(0);

  const pan = Gesture.Pan()
    .activeOffsetX(theme.space.md)
    .failOffsetY([-theme.space.md, theme.space.md])
    .onUpdate((event) => {
      offset.value = Math.min(Math.max(event.translationX, 0), distance);
    })
    .onEnd(() => {
      if (offset.value >= distance) {
        scheduleOnRN(onReply);
      }
      offset.value = withTiming(0, { duration: theme.motion.fastMs });
    });

  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  const cue = useAnimatedStyle(() => ({ opacity: offset.value / distance }));

  return (
    <GestureDetector gesture={pan}>
      <View>
        <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, justifyContent: 'center', pointerEvents: 'none' }, cue]}>
          <Icon icon={Reply} color={theme.colors.primary} />
        </Animated.View>
        <Animated.View style={slide}>{children}</Animated.View>
      </View>
    </GestureDetector>
  );
}
