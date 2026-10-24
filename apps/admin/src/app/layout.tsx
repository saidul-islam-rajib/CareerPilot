import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { catalogs, createTranslator } from '@careerpilot/i18n';
import { Providers } from '@/core/providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const t = createTranslator(catalogs.en);

export const metadata: Metadata = {
  title: { default: t('admin.appName'), template: `%s · ${t('admin.appName')}` },
  authors: [{ name: t('credits.developedBy') }],
  robots: { index: false, follow: false },
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
