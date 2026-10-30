FROM node:24.14.0-alpine AS mobile-build
ARG APP_ENV=production
ARG CAREERPILOT_API_URL
ENV APP_ENV=${APP_ENV} CAREERPILOT_API_URL=${CAREERPILOT_API_URL} PNPM_STORE=/pnpm/store COREPACK_HOME=/corepack CI=1 EXPO_NO_TELEMETRY=1
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
RUN --mount=type=cache,id=careerpilot-corepack,target=/corepack --mount=type=cache,id=careerpilot-pnpm-store,target=/pnpm/store pnpm fetch --store-dir "$PNPM_STORE"
COPY config ./config
COPY scripts/config ./scripts/config
COPY packages ./packages
COPY apps/mobile ./apps/mobile
RUN test -n "$CAREERPILOT_API_URL"
RUN --mount=type=cache,id=careerpilot-corepack,target=/corepack --mount=type=cache,id=careerpilot-pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --prefer-offline --store-dir "$PNPM_STORE" --filter "@careerpilot/mobile..." \
 && cd apps/mobile && pnpm exec expo export --platform web --clear

FROM caddy:2.10-alpine
COPY infra/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=mobile-build /repo/apps/mobile/dist /srv/mobile
