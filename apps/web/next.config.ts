import type { NextConfig } from 'next';

const { loadConfig } = require('../../scripts/config/load-config.js') as { loadConfig: (env: string) => Record<string, unknown> };

const { version } = require('./package.json') as { version: string };

const appEnv = process.env.APP_ENV ?? 'local';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@careerpilot/api-client',
    '@careerpilot/brand',
    '@careerpilot/client-core',
    '@careerpilot/domain-ui-logic',
    '@careerpilot/i18n',
    '@careerpilot/ui-tokens',
    '@careerpilot/ui-web',
    '@careerpilot/validation',
  ],
  env: {
    NEXT_PUBLIC_CAREERPILOT_CONFIG: JSON.stringify(loadConfig(appEnv)),
    NEXT_PUBLIC_APP_VERSION: version,
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
