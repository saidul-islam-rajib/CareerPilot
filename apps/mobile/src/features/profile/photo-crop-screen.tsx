import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { View, type AccessibilityActionEvent, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Circle, Path } from 'react-native-svg';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCcw, ZoomIn, ZoomOut, type LucideIcon } from '@/ui/icons';
import { useProfile, useSetPhotoCrop, useT } from '@careerpilot/client-core';
import { cropFromView, moveView, viewFromCrop, viewPlacement, zoomView, type CropView, type ImageSize, type Offset } from '@careerpilot/domain-ui-logic';
import { photoCrop as cropTuning } from '@careerpilot/ui-tokens';
import { useTheme } from '@/core/theme/theme';
import { Button, ButtonVariant, Card, ErrorState, IconButton, LoadingState, Row, Screen, Text, TextTone } from '@/ui';
import { useProfileFeedback } from './profile-support';

interface Direction {
  action: string;
  label: string;
  icon: LucideIcon;
  offset: Offset;
}

const DIRECTIONS: readonly Direction[] = [
  { action: 'moveLeft', label: 'profile.movePhotoLeft', icon: ArrowLeft, offset: { x: -1, y: 0 } },
  { action: 'moveUp', label: 'profile.movePhotoUp', icon: ArrowUp, offset: { x: 0, y: -1 } },
  { action: 'moveDown', label: 'profile.movePhotoDown', icon: ArrowDown, offset: { x: 0, y: 1 } },
  { action: 'moveRight', label: 'profile.movePhotoRight', icon: ArrowRight, offset: { x: 1, y: 0 } },
];
const STROKE = 2;
const HALF = 2;
const PERCENT = 100;

function maskPath(size: number): string {
  const r = size / HALF;
  return `M0 0H${size}V${size}H0Z M${r} 0A${r} ${r} 0 1 0 ${r} ${size}A${r} ${r} 0 1 0 ${r} 0Z`;
}

function useCropEditor() {
  const theme = useTheme();
  const range = { min: theme.zoom.min, max: theme.zoom.max };
  const [image, setImage] = useState<ImageSize>();
  const [view, setView] = useState<CropView>();
  const current = useRef<CropView | undefined>(undefined);
  current.current = view;
  const update = (change: (value: CropView, size: ImageSize) => CropView) => setView((value) => (value && image ? change(value, image) : value));
  return {
    image,
    view,
    current,
    range,
    load: (size: ImageSize, crop: Parameters<typeof viewFromCrop>[0]) => {
      setImage(size);
      setView(viewFromCrop(crop, size, range));
    },
    zoomTo: (zoom: number) => update((value, size) => zoomView(value, zoom, size, range)),
    moveBy: (delta: Offset) => update((value, size) => moveView(value, delta, size)),
    nudge: (direction: Offset) => update((value, size) => moveView(value, { x: direction.x * cropTuning.nudge, y: direction.y * cropTuning.nudge }, size)),
    reset: () => image && setView(viewFromCrop(undefined, image, range)),
  };
}

export function PhotoCropScreen() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const feedback = useProfileFeedback();
  const profile = useProfile();
  const setCrop = useSetPhotoCrop();
  const editor = useCropEditor();
  const [frame, setFrame] = useState(0);
  const lastPan = useRef<Offset>({ x: 0, y: 0 });
  const pinchStart = useRef<number>(editor.range.min);

  if (profile.isPending) {
    return <LoadingState />;
  }
  const photoUrl = profile.data?.photoUrl;
  if (profile.isError || !photoUrl) {
    return <ErrorState onRetry={() => void profile.refetch()} />;
  }

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onStart(() => {
      lastPan.current = { x: 0, y: 0 };
    })
    .onUpdate((event) => {
      if (frame > 0) {
        editor.moveBy({ x: (event.translationX - lastPan.current.x) / frame, y: (event.translationY - lastPan.current.y) / frame });
      }
      lastPan.current = { x: event.translationX, y: event.translationY };
    });
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => {
      pinchStart.current = editor.current.current?.zoom ?? editor.range.min;
    })
    .onUpdate((event) => editor.zoomTo(pinchStart.current * event.scale));

  const place = editor.view && editor.image ? viewPlacement(editor.view, editor.image) : undefined;
  const save = () => {
    if (!editor.view || !editor.image) {
      return;
    }
    setCrop.mutate(cropFromView(editor.view, editor.image), {
      onSuccess: () => {
        feedback.saved(t('profile.photoUpdated'));
        router.back();
      },
      onError: (failure) => feedback.failed(failure),
    });
  };
  const onAction = (event: AccessibilityActionEvent) => {
    const direction = DIRECTIONS.find((d) => d.action === event.nativeEvent.actionName);
    if (direction) {
      editor.nudge(direction.offset);
    }
  };

  return (
    <Screen testID="photo-crop-screen" scroll={false}>
      <Card>
        <Text tone={TextTone.Muted}>{t('profile.adjustPhotoHint')}</Text>
        <GestureDetector gesture={Gesture.Simultaneous(pan, pinch)}>
          <View
            accessible
            accessibilityLabel={t('profile.photoFrame')}
            accessibilityActions={DIRECTIONS.map((d) => ({ name: d.action, label: t(d.label) }))}
            onAccessibilityAction={onAction}
            onLayout={(event: LayoutChangeEvent) => setFrame(event.nativeEvent.layout.width)}
            testID="photo-crop-frame"
            style={{ width: '100%', aspectRatio: 1, overflow: 'hidden', borderRadius: theme.radius.card, backgroundColor: theme.colors.neutralSubtle }}
          >
            <Image
              source={{ uri: photoUrl }}
              contentFit="fill"
              testID="photo-crop-image"
              onLoad={(event) => editor.load({ width: event.source.width, height: event.source.height }, profile.data?.photoCrop)}
              style={
                place
                  ? { position: 'absolute', width: `${place.width}%`, height: `${place.height}%`, left: `${place.left}%`, top: `${place.top}%` }
                  : { position: 'absolute', width: `${PERCENT}%`, height: `${PERCENT}%`, opacity: 0 }
              }
            />
            {frame > 0 ? (
              <Svg width={frame} height={frame} style={{ position: 'absolute' }} pointerEvents="none">
                <Path d={maskPath(frame)} fill={theme.colors.overlay} fillRule="evenodd" />
                <Circle cx={frame / HALF} cy={frame / HALF} r={frame / HALF - STROKE / HALF} stroke={theme.colors.background} strokeWidth={STROKE} fill="none" />
              </Svg>
            ) : null}
          </View>
        </GestureDetector>
        <Row gap={theme.space.sm} justify="center" wrap>
          <IconButton icon={ZoomOut} label={t('profile.zoomOut')} onPress={() => editor.zoomTo((editor.view?.zoom ?? editor.range.min) - cropTuning.buttonStep)} testID="photo-zoom-out" />
          <IconButton icon={ZoomIn} label={t('profile.zoomIn')} onPress={() => editor.zoomTo((editor.view?.zoom ?? editor.range.min) + cropTuning.buttonStep)} testID="photo-zoom-in" />
          {DIRECTIONS.map((direction) => (
            <IconButton key={direction.action} icon={direction.icon} label={t(direction.label)} onPress={() => editor.nudge(direction.offset)} />
          ))}
        </Row>
        <Button label={t('profile.resetPhotoFrame')} icon={RotateCcw} variant={ButtonVariant.Ghost} onPress={editor.reset} />
        <Button label={t('common.save')} onPress={save} loading={setCrop.isPending} disabled={!editor.view} fullWidth testID="photo-crop-save" />
      </Card>
    </Screen>
  );
}
