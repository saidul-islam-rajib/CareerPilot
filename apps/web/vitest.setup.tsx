import '@testing-library/jest-dom/vitest';
import type { AnchorHTMLAttributes, PropsWithChildren } from 'react';
import { configure } from '@testing-library/react';
import { vi } from 'vitest';

configure({ asyncUtilTimeout: 5000 });

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

export const navigation = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  params: {} as Record<string, string>,
  search: '',
  pathname: '/',
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: navigation.push, replace: navigation.replace, back: navigation.back }),
  useParams: () => navigation.params,
  useSearchParams: () => new URLSearchParams(navigation.search),
  usePathname: () => navigation.pathname,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: PropsWithChildren<AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/core/brand-assets', () => ({ teamSoberLogoSrc: '/team-sober-logo.png' }));

Object.assign(globalThis, { navigation });
