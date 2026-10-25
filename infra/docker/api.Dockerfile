FROM python:3.11.13-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 APP_ENV=docker
WORKDIR /app
COPY config ./config
COPY seeds ./seeds
COPY packages/i18n/src/locales ./packages/i18n/src/locales
COPY services/core ./services/core
COPY services/api ./services/api
RUN pip install -e ./services/core -e ./services/api \
 && useradd --create-home --uid 10001 careerpilot
USER careerpilot
WORKDIR /app/services/core
EXPOSE 8000 8001
CMD ["uvicorn", "careerpilot_api.apps:user_api", "--factory", "--host", "0.0.0.0", "--port", "8000"]
