FROM mcr.microsoft.com/playwright/python:v1.64.1-noble AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_DEFAULT_TIMEOUT=120 PIP_RETRIES=10 APP_ENV=docker VIRTUAL_ENV=/opt/venv PATH=/opt/venv/bin:$PATH
WORKDIR /app
RUN python -m venv /opt/venv
COPY infra/docker/python_requirements.py /opt/build/python_requirements.py
COPY services/core/pyproject.toml ./services/core/pyproject.toml
COPY services/api/pyproject.toml ./services/api/pyproject.toml
COPY services/workers/pyproject.toml ./services/workers/pyproject.toml
RUN --mount=type=cache,id=careerpilot-pip-portal,target=/root/.cache/pip python /opt/build/python_requirements.py services/core/pyproject.toml services/api/pyproject.toml services/workers/pyproject.toml > /opt/build/requirements.txt \
 && pip install -r /opt/build/requirements.txt
COPY config ./config
COPY packages/i18n/src/locales ./packages/i18n/src/locales
COPY services/core ./services/core
COPY services/api ./services/api
COPY services/workers ./services/workers
RUN pip install --no-deps --no-build-isolation -e ./services/core -e ./services/api -e ./services/workers \
 && useradd --create-home --uid 10001 careerpilot \
 && mkdir -p /data/files && chown careerpilot /data/files
USER careerpilot
WORKDIR /app/services/core
CMD ["careerpilot-portal-worker"]
