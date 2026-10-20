import { Image } from 'expo-image';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/core/theme/theme';

export function clampZoom(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface ZoomControls {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
}

export function useZoom() {
  const theme = useTheme();
  const { min, max, step, doubleTap } = theme.zoom;
  const scale = useSharedValue<number>(min);
  const savedScale = useSharedValue<number>(min);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const duration = theme.motion.normalMs;

  const setScale = (value: number) => {
    const next = clampZoom(value, min, max);
    scale.value = withTiming(next, { duration });
    savedScale.value = next;
    if (next === min) {
      x.value = withTiming(0, { duration });
      y.value = withTiming(0, { duration });
      savedX.value = 0;
      savedY.value = 0;
    }
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = clampZoom(savedScale.value * e.scale, min, max);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      if (scale.value > min) {
        x.value = savedX.value + e.translationX;
        y.value = savedY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedX.value = x.value;
      savedY.value = y.value;
    });

  const tap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const next = scale.value > min ? min : doubleTap;
      scale.value = withTiming(next, { duration });
      savedScale.value = next;
      x.value = withTiming(0, { duration });
      y.value = withTiming(0, { duration });
      savedX.value = 0;
      savedY.value = 0;
    });

  const gesture = Gesture.Simultaneous(pinch, pan, tap);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  const controls: ZoomControls = {
    zoomIn: () => setScale(savedScale.value + step),
    zoomOut: () => setScale(savedScale.value - step),
    reset: () => setScale(min),
  };
  return { gesture, style, controls };
}

export function ZoomableImage({ uri, label, zoom }: { uri: string; label: string; zoom: ReturnType<typeof useZoom> }) {
  return (
    <GestureDetector gesture={zoom.gesture}>
      <View style={{ flex: 1, overflow: 'hidden', justifyContent: 'center' }}>
        <Animated.View style={[{ width: '100%', height: '100%' }, zoom.style]}>
          <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="contain" accessibilityLabel={label} />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
