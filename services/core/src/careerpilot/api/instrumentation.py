from fastapi import FastAPI
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor  # pyright: ignore[reportMissingTypeStubs]

from careerpilot.bootstrap import Container
from careerpilot.platform.telemetry import configure_telemetry


def instrument(app: FastAPI, container: Container, service_name: str) -> None:
    if not configure_telemetry(container.settings.observability, service_name):
        return
    FastAPIInstrumentor.instrument_app(app)
    if container.database is not None:
        SQLAlchemyInstrumentor().instrument(engine=container.database.engine)
