import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { catalogs, createTranslator } from '@careerpilot/i18n';
import { Providers } from '@/core/providers';
import './globals.css';

const inter = localFont({ src: './fonts/inter-latin-variable.woff2', variable: '--font-inter', display: 'swap', weight: '100 900' });
const t = createTranslator(catalogs.en);

export const metadata: Metadata = {
  title: { default: t('app.name'), template: `%s · ${t('app.name')}` },
  description: t('app.tagline'),
  authors: [{ name: t('credits.developedBy') }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
