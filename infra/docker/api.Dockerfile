FROM python:3.11.13-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_DEFAULT_TIMEOUT=120 PIP_RETRIES=10 APP_ENV=docker
WORKDIR /app
COPY config ./config
COPY packages/i18n/src/locales ./packages/i18n/src/locales
COPY services/core ./services/core
COPY services/api ./services/api
COPY services/workers ./services/workers
RUN --mount=type=cache,id=careerpilot-pip,target=/root/.cache/pip pip install -e ./services/core -e ./services/api -e ./services/workers \
 && useradd --create-home --uid 10001 careerpilot \
 && mkdir -p /data/files && chown careerpilot /data/files
USER careerpilot
WORKDIR /app/services/core
EXPOSE 8000 8001
CMD ["uvicorn", "careerpilot_api.apps:user_api", "--factory", "--host", "0.0.0.0", "--port", "8000"]
