import { useState, type ReactNode } from 'react';
import { useT } from '@careerpilot/client-core';
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { ChevronDown, ChevronUp, GripVertical } from '@/ui/icons';
import { useTheme } from '@/core/theme/theme';
import { Icon } from './icon';

export function targetIndex(from: number, translation: number, itemHeight: number, count: number): number {
  if (itemHeight <= 0) {
    return from;
  }
  return Math.max(0, Math.min(count - 1, from + Math.round(translation / itemHeight)));
}

export interface SortableListProps<T> {
  items: T[];
  keyOf: (item: T) => string;
  labelOf: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  onReorder: (from: number, to: number) => void;
}

interface SortableRowProps {
  index: number;
  count: number;
  label: string;
  itemHeight: number;
  onMeasure: (height: number) => void;
  onMove: (from: number, to: number) => void;
  children: ReactNode;
}

function SortableRow({ index, count, label, itemHeight, onMeasure, onMove, children }: SortableRowProps) {
  const theme = useTheme();
  const t = useT();
  const offset = useSharedValue(0);
  const dragging = useSharedValue(false);

  const pan = Gesture.Pan()
    .activateAfterLongPress(theme.gesture.longPressMs)
    .onStart(() => {
      dragging.value = true;
    })
    .onUpdate((event) => {
      offset.value = event.translationY;
    })
    .onEnd(() => {
      const to = targetIndex(index, offset.value, itemHeight, count);
      offset.value = withTiming(0, { duration: theme.motion.fastMs });
      dragging.value = false;
      if (to !== index) {
        scheduleOnRN(onMove, index, to);
      }
    });

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }, { scale: dragging.value ? theme.gesture.dragScale : 1 }],
    zIndex: dragging.value ? 1 : 0,
    elevation: dragging.value ? theme.gesture.dragElevation : 0,
  }));

  const moveButton = (direction: number, glyph: typeof ChevronUp, name: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}: ${label}`}
      disabled={index + direction < 0 || index + direction >= count}
      onPress={() => onMove(index, index + direction)}
      hitSlop={theme.space.xs}
      style={{ padding: theme.space.xs, opacity: index + direction < 0 || index + direction >= count ? theme.opacity.disabled : 1 }}
    >
      <Icon icon={glyph} color={theme.colors.textMuted} />
    </Pressable>
  );

  return (
    <Animated.View
      onLayout={(e) => onMeasure(e.nativeEvent.layout.height)}
      style={[{ backgroundColor: theme.colors.card, borderRadius: theme.radius.control }, animated]}
      accessibilityHint={t('common.position', { index: index + 1, count })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
        <GestureDetector gesture={pan}>
          <View accessibilityLabel={t('common.moveItem', { item: label })} accessibilityHint={t('common.dragToReorder')} style={{ padding: theme.space.xs }}>
            <Icon icon={GripVertical} color={theme.colors.textMuted} />
          </View>
        </GestureDetector>
        <View style={{ flex: 1 }}>{children}</View>
        {moveButton(-1, ChevronUp, t('common.moveUp'))}
        {moveButton(1, ChevronDown, t('common.moveDown'))}
      </View>
    </Animated.View>
  );
}

export function SortableList<T>({ items, keyOf, labelOf, renderItem, onReorder }: SortableListProps<T>) {
  const [itemHeight, setItemHeight] = useState(0);
  return (
    <View>
      {items.map((item, index) => (
        <SortableRow
          key={keyOf(item)}
          index={index}
          count={items.length}
          label={labelOf(item)}
          itemHeight={itemHeight}
          onMeasure={(height) => setItemHeight((current) => (current === 0 ? height : current))}
          onMove={onReorder}
        >
          {renderItem(item)}
        </SortableRow>
      ))}
    </View>
  );
}
