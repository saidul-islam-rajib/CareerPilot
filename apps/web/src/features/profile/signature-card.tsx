'use client';

import { useRef, useState } from 'react';
import { Pencil, Trash2, Upload } from 'lucide-react';
import type { Profile } from '@careerpilot/api-client';
import { useRemoveSignature, useSetSignature, useT } from '@careerpilot/client-core';
import { Button, Card, ImageViewer, SignaturePadDialog, checkFile } from '@careerpilot/ui-web';
import { uploadSource, useProfileFeedback, useUploadRules } from './profile-support';

const PNG_TYPE = 'image/png';
const DRAWN_NAME = 'signature.png';

export function SignatureCard({ profile }: { profile: Profile }) {
  const t = useT();
  const feedback = useProfileFeedback();
  const rules = useUploadRules();
  const picker = useRef<HTMLInputElement>(null);
  const [drawing, setDrawing] = useState(false);
  const setSignature = useSetSignature();
  const removeSignature = useRemoveSignature();
  const label = t('profile.signature');

  const send = (file: File, afterSave?: () => void) => {
    const rejection = checkFile(file, rules.signatures.accept, rules.signatures.maxBytes);
    if (rejection) {
      feedback.rejected(rules.rejectionKey(rejection), rules.signatures.params);
      return;
    }
    setSignature.mutate(uploadSource(file), {
      onSuccess: () => {
        afterSave?.();
        feedback.saved(t('profile.signatureUpdated'));
      },
      onError: (error) => feedback.failed(error, rules.signatures.params),
    });
  };
  const sendDrawn = (png: Uint8Array) => send(new File([png.buffer as ArrayBuffer], DRAWN_NAME, { type: PNG_TYPE }), () => setDrawing(false));

  return (
    <Card className="gap-3">
      <h2 className="font-semibold">{label}</h2>
      {profile.signatureUrl ? (
        <ImageViewer
          src={profile.signatureUrl}
          title={label}
          trigger={
            <button type="button" aria-label={`${label}. ${t('profile.tapToZoom')}`} className="w-full max-w-sm rounded-control bg-surface p-2">
              <img src={profile.signatureUrl} alt="" className="w-full" />
            </button>
          }
        />
      ) : (
        <p className="text-sm text-muted">{t('profile.signatureEmpty')}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setDrawing(true)}>
          {profile.signatureUrl ? t('profile.replaceSignature') : t('profile.drawSignature')}
        </Button>
        <Button variant="secondary" size="sm" icon={Upload} loading={setSignature.isPending} onClick={() => picker.current?.click()}>
          {t('profile.uploadSignature')}
        </Button>
        {profile.signatureUrl ? (
          <Button variant="ghost" size="sm" icon={Trash2} onClick={() => removeSignature.mutate(undefined, { onSuccess: () => feedback.saved(t('profile.signatureRemoved')), onError: (error) => feedback.failed(error) })}>
            {t('profile.removeSignature')}
          </Button>
        ) : null}
      </div>
      <input
        ref={picker}
        type="file"
        accept={rules.signatures.accept.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) {
            send(file);
          }
        }}
      />
      {drawing ? <SignaturePadDialog open={drawing} onOpenChange={setDrawing} saving={setSignature.isPending} onSave={sendDrawn} /> : null}
    </Card>
  );
}
