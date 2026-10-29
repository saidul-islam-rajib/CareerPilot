import { useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import type { UploadSource } from '@careerpilot/api-client';
import { useT, voiceLength } from '@careerpilot/client-core';
import { Pause, Play } from '@/ui/icons';
import { useTheme } from '@/core/theme/theme';
import { toUploadSource } from '@/features/profile/profile-support';
import { Icon, Text, TextVariant } from '@/ui';

const VOICE_TYPE = 'audio/mp4';
const VOICE_NAME = 'voice.m4a';
const MS_PER_SECOND = 1000;

export interface RecordedVoice {
  file: UploadSource;
  durationSeconds: number;
}

export function useVoiceNote(onRecorded: (voice: RecordedVoice) => void) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);
  const [denied, setDenied] = useState(false);

  const start = async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setDenied(true);
      return;
    }
    setDenied(false);
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  };

  const finish = async (keep: boolean) => {
    const durationSeconds = state.durationMillis / MS_PER_SECOND;
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    if (keep && recorder.uri) {
      onRecorded({ file: toUploadSource({ uri: recorder.uri, name: VOICE_NAME, mimeType: VOICE_TYPE }), durationSeconds });
    }
  };

  return {
    recording: state.isRecording,
    seconds: state.durationMillis / MS_PER_SECOND,
    denied,
    start,
    stop: () => finish(true),
    cancel: () => finish(false),
  };
}

export function VoicePlayer({ url, durationSeconds, tint }: { url: string; durationSeconds?: number; tint: string }) {
  const t = useT();
  const theme = useTheme();
  const player = useAudioPlayer(url);
  const status = useAudioPlayerStatus(player);
  const toggle = () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration)) {
      void player.seekTo(0);
    }
    player.play();
  };
  const total = durationSeconds ?? status.duration;
  const progress = total > 0 ? Math.min(1, status.currentTime / total) : 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm, minWidth: 200 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={status.playing ? t('messaging.pause') : t('messaging.play')}
        onPress={toggle}
        hitSlop={theme.space.xs}
        style={{ width: theme.touchTarget, height: theme.touchTarget, borderRadius: theme.touchTarget / 2, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon icon={status.playing ? Pause : Play} color={tint} />
      </Pressable>
      <View style={{ flex: 1, gap: theme.space.xxs }}>
        <View style={{ height: theme.space.xs, borderRadius: theme.radius.pill, backgroundColor: theme.colors.border, overflow: 'hidden' }}>
          <View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: tint }} />
        </View>
        <Text variant={TextVariant.Caption} style={{ color: tint }}>
          {voiceLength(status.playing ? status.currentTime : total)}
        </Text>
      </View>
    </View>
  );
}
