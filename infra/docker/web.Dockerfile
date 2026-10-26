FROM node:24.14.0-alpine AS build
ARG APP=web
ENV APP_ENV=docker NEXT_TELEMETRY_DISABLED=1 PNPM_STORE=/pnpm/store
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
RUN --mount=type=cache,id=careerpilot-pnpm-store,target=/pnpm/store pnpm fetch --store-dir "$PNPM_STORE"
COPY config ./config
COPY scripts/config ./scripts/config
COPY packages ./packages
COPY apps/${APP} ./apps/${APP}
RUN --mount=type=cache,id=careerpilot-pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --offline --store-dir "$PNPM_STORE" --filter "@careerpilot/${APP}..." \
 && pnpm --filter "@careerpilot/${APP}" build

FROM node:24.14.0-alpine AS runtime
ARG APP=web
ARG PORT=3000
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=${PORT} APP=${APP}
WORKDIR /repo
COPY --from=build /repo /repo
USER node
WORKDIR /repo/apps/${APP}
EXPOSE ${PORT}
CMD ["sh", "-c", "exec /repo/node_modules/.bin/next start --port \"$PORT\""]
