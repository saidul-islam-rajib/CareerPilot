import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';
import { Eraser, Undo2 } from '@/ui/icons';
import { useSetSignature, useT } from '@careerpilot/client-core';
import { encodeSignaturePng, hasInk, type StrokePoint } from '@careerpilot/domain-ui-logic';
import { signaturePad } from '@careerpilot/ui-tokens';
import { useTheme } from '@/core/theme/theme';
import { Button, ButtonVariant, Card, Row, Screen, Text, TextTone } from '@/ui';
import { useProfileFeedback } from './profile-support';

const PNG_TYPE = 'image/png';
const DRAWN_NAME = 'signature.png';

const toPath = (stroke: StrokePoint[]) => stroke.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

export function SignaturePadScreen() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const feedback = useProfileFeedback();
  const setSignature = useSetSignature();
  const [strokes, setStrokes] = useState<StrokePoint[][]>([]);
  const [width, setWidth] = useState(0);
  const scale = useRef(1);
  scale.current = width > 0 ? signaturePad.width / width : 1;

  const at = (x: number, y: number): StrokePoint => ({ x: x * scale.current, y: y * scale.current });
  const draw = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin((event) => setStrokes((current) => [...current, [at(event.x, event.y)]]))
    .onUpdate((event) => setStrokes((current) => current.map((stroke, i) => (i === current.length - 1 ? [...stroke, at(event.x, event.y)] : stroke))));

  const save = () => {
    if (!hasInk(strokes)) {
      return;
    }
    const png = encodeSignaturePng(strokes, signaturePad);
    setSignature.mutate(
      { name: DRAWN_NAME, type: PNG_TYPE, size: png.length, bytes: async () => png },
      {
        onSuccess: () => {
          feedback.saved(t('profile.signatureUpdated'));
          router.back();
        },
        onError: (failure) => feedback.failed(failure),
      },
    );
  };

  return (
    <Screen testID="signature-pad-screen" scroll={false}>
      <Card>
        <Text tone={TextTone.Muted}>{t('profile.drawSignatureHint')}</Text>
        <GestureDetector gesture={draw}>
          <View
            accessible
            accessibilityLabel={t('profile.signaturePad')}
            onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
            testID="signature-pad"
            style={{ width: '100%', aspectRatio: signaturePad.width / signaturePad.height, borderRadius: theme.radius.control, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }}
          >
            <Svg width="100%" height="100%" viewBox={`0 0 ${signaturePad.width} ${signaturePad.height}`}>
              {strokes.map((stroke, index) => (
                <Path key={index} d={toPath(stroke)} fill="none" stroke={theme.colors.text} strokeWidth={signaturePad.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </Svg>
          </View>
        </GestureDetector>
        <Row>
          <Button label={t('profile.undoStroke')} variant={ButtonVariant.Ghost} icon={Undo2} disabled={strokes.length === 0} onPress={() => setStrokes((current) => current.slice(0, -1))} />
          <Button label={t('profile.clearSignature')} variant={ButtonVariant.Ghost} icon={Eraser} disabled={strokes.length === 0} onPress={() => setStrokes([])} />
        </Row>
        <Button label={t('common.save')} loading={setSignature.isPending} disabled={!hasInk(strokes)} onPress={save} testID="signature-save" />
      </Card>
    </Screen>
  );
}
