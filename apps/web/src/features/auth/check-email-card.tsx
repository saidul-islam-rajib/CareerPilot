'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, MailCheck, RotateCw } from 'lucide-react';
import { useDemoLinkToken, useLinkResend, useT } from '@careerpilot/client-core';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Banner, Button, Card } from '@careerpilot/ui-web';
import { Routes } from '@/core/routes';

export function CheckEmailCard({ email, onStartOver }: { email: string; onStartOver: () => void }) {
  const t = useT();
  const router = useRouter();
  const link = useLinkResend(email);
  const demoToken = useDemoLinkToken();
  return (
    <Card className="gap-4 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary-subtle text-primary">
          <MailCheck className="size-7" aria-hidden />
        </span>
        <h2 className="text-xl font-semibold text-foreground">{t('accountLinks.checkEmailTitle')}</h2>
        <p className="break-words text-foreground">{t('accountLinks.checkEmailBody', { email })}</p>
        <p className="text-sm text-muted">{t('accountLinks.checkEmailExpiry', { minutes: link.ttlMinutes })}</p>
      </div>
      {link.error ? <Banner tone={StatusTone.Danger} icon={AlertCircle} title={t(link.error)} /> : null}
      {link.resent && !link.error ? (
        <p role="status" className="text-center text-sm font-medium text-success">
          {t('accountLinks.resent')}
        </p>
      ) : null}
      {demoToken ? (
        <div className="flex flex-col gap-3 rounded-control border border-warning bg-warning-subtle p-3 text-sm text-foreground">
          <p>{t('accountLinks.demoNote')}</p>
          <Button variant="outline" onClick={() => router.push(Routes.setPassword(demoToken))}>
            {t('accountLinks.openDemoLink')}
          </Button>
        </div>
      ) : null}
      <Button variant="secondary" icon={RotateCw} fullWidth disabled={link.resendIn > 0} loading={link.resending} onClick={link.resend}>
        {link.resendIn > 0 ? t('accountLinks.resendIn', { seconds: link.resendIn }) : t('accountLinks.resend')}
      </Button>
      <div className="flex flex-col items-center gap-2 text-sm sm:flex-row sm:justify-center sm:gap-6">
        <button type="button" className="font-semibold text-primary hover:underline" onClick={onStartOver}>
          {t('accountLinks.differentEmail')}
        </button>
        <Link href={Routes.signIn} className="font-semibold text-primary hover:underline">
          {t('accountLinks.backToSignIn')}
        </Link>
      </div>
    </Card>
  );
}
