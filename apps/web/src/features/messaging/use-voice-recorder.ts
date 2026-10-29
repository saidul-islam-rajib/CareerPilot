'use client';

import { useEffect, useRef, useState } from 'react';
import type { UploadSource } from '@careerpilot/api-client';

const PREFERRED_TYPES = ['audio/webm', 'audio/mp4', 'audio/ogg'];
const EXTENSIONS: Record<string, string> = { 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg' };
const TICK_MS = 250;
const MS_PER_SECOND = 1000;

export interface VoiceNote {
  file: UploadSource;
  durationSeconds: number;
}

export function canRecordVoice(): boolean {
  return typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

function supportedType(): string | undefined {
  return PREFERRED_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

export function useVoiceRecorder(onRecorded: (note: VoiceNote) => void) {
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const keep = useRef(true);
  const [seconds, setSeconds] = useState(0);
  const [recording, setRecording] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!recording) {
      return undefined;
    }
    const timer = setInterval(() => setSeconds((Date.now() - startedAt.current) / MS_PER_SECOND), TICK_MS);
    return () => clearInterval(timer);
  }, [recording]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = supportedType();
      const next = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      keep.current = true;
      next.ondataavailable = (event) => chunks.current.push(event.data);
      next.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        if (!keep.current) {
          return;
        }
        const type = (next.mimeType || mimeType || PREFERRED_TYPES[0] || '').split(';')[0] ?? '';
        const blob = new Blob(chunks.current, { type });
        const durationSeconds = (Date.now() - startedAt.current) / MS_PER_SECOND;
        onRecorded({ file: { name: `voice.${EXTENSIONS[type] ?? 'webm'}`, type, size: blob.size, blob }, durationSeconds });
      };
      recorder.current = next;
      startedAt.current = Date.now();
      setSeconds(0);
      setDenied(false);
      next.start();
      setRecording(true);
    } catch {
      setDenied(true);
    }
  };

  const finish = (save: boolean) => {
    keep.current = save;
    recorder.current?.stop();
  };

  return { recording, seconds, denied, start, stop: () => finish(true), cancel: () => finish(false) };
}
