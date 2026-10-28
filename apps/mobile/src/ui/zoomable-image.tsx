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

export function focalTranslation(focal: number, saved: number, ratio: number): number {
  'worklet';
  return focal * (1 - ratio) + saved * ratio;
}

export function boundTranslation(value: number, size: number, scale: number): number {
  'worklet';
  const limit = (size * (scale - 1)) / 2;
  return Math.max(-limit, Math.min(limit, value));
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
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const duration = theme.motion.normalMs;

  const settle = (next: number) => {
    'worklet';
    scale.value = withTiming(next, { duration });
    savedScale.value = next;
    const boundedX = next === min ? 0 : boundTranslation(savedX.value, width.value, next);
    const boundedY = next === min ? 0 : boundTranslation(savedY.value, height.value, next);
    x.value = withTiming(boundedX, { duration });
    y.value = withTiming(boundedY, { duration });
    savedX.value = boundedX;
    savedY.value = boundedY;
  };

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      focalX.value = e.focalX - width.value / 2;
      focalY.value = e.focalY - height.value / 2;
    })
    .onUpdate((e) => {
      const next = clampZoom(savedScale.value * e.scale, min, max);
      const ratio = next / savedScale.value;
      scale.value = next;
      x.value = focalTranslation(focalX.value, savedX.value, ratio);
      y.value = focalTranslation(focalY.value, savedY.value, ratio);
    })
    .onEnd(() => {
      savedX.value = x.value;
      savedY.value = y.value;
      settle(scale.value);
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      if (scale.value > min) {
        x.value = boundTranslation(savedX.value + e.translationX, width.value, scale.value);
        y.value = boundTranslation(savedY.value + e.translationY, height.value, scale.value);
      }
    })
    .onEnd(() => {
      savedX.value = x.value;
      savedY.value = y.value;
    });

  const tap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (scale.value > min) {
        savedX.value = 0;
        savedY.value = 0;
        settle(min);
        return;
      }
      savedX.value = focalTranslation(e.x - width.value / 2, 0, doubleTap);
      savedY.value = focalTranslation(e.y - height.value / 2, 0, doubleTap);
      settle(doubleTap);
    });

  const gesture = Gesture.Simultaneous(pinch, pan, tap);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  const controls: ZoomControls = {
    zoomIn: () => settle(clampZoom(savedScale.value + step, min, max)),
    zoomOut: () => settle(clampZoom(savedScale.value - step, min, max)),
    reset: () => settle(min),
  };
  const measure = (w: number, h: number) => {
    width.value = w;
    height.value = h;
  };
  return { gesture, style, controls, measure };
}

export function ZoomableImage({ uri, label, zoom }: { uri: string; label: string; zoom: ReturnType<typeof useZoom> }) {
  return (
    <GestureDetector gesture={zoom.gesture}>
      <View style={{ flex: 1, overflow: 'hidden', justifyContent: 'center' }} onLayout={(e) => zoom.measure(e.nativeEvent.layout.width, e.nativeEvent.layout.height)}>
        <Animated.View style={[{ width: '100%', height: '100%' }, zoom.style]}>
          <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="contain" accessibilityLabel={label} />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
