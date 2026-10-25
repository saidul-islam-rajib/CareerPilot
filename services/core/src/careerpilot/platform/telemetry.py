import json
import logging
import os
import re
from datetime import UTC, datetime
from typing import Any, cast

from opentelemetry import metrics, trace
from opentelemetry._logs import set_logger_provider
from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.trace.sampling import ParentBased, TraceIdRatioBased

from careerpilot.platform.config import ObservabilityConfig

EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
TRACE_ID_HEX = "032x"
SPAN_ID_HEX = "016x"
SERVICE_NAME = "service.name"


def scrub(value: Any, keys: frozenset[str], redacted: str) -> Any:
    if isinstance(value, dict):
        return {k: redacted if str(k) in keys else scrub(v, keys, redacted) for k, v in cast("dict[Any, Any]", value).items()}
    if isinstance(value, list | tuple):
        return [scrub(v, keys, redacted) for v in cast("list[Any]", value)]
    if isinstance(value, str):
        return EMAIL.sub(redacted, value)
    return value


class ScrubFilter(logging.Filter):
    def __init__(self, config: ObservabilityConfig) -> None:
        super().__init__()
        self._keys = frozenset(config.scrub_keys)
        self._redacted = config.redacted

    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = scrub(record.msg, self._keys, self._redacted)
        if isinstance(record.args, dict):
            record.args = cast("dict[str, object]", scrub(record.args, self._keys, self._redacted))
        elif record.args:
            record.args = tuple(scrub(list(record.args), self._keys, self._redacted))
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        context = trace.get_current_span().get_span_context()
        payload: dict[str, object] = {
            "time": datetime.fromtimestamp(record.created, UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if context.is_valid:
            payload["trace_id"] = format(context.trace_id, TRACE_ID_HEX)
            payload["span_id"] = format(context.span_id, SPAN_ID_HEX)
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload)


def configure_logging(config: ObservabilityConfig) -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    handler.addFilter(ScrubFilter(config))
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(config.log_level)


def configure_telemetry(config: ObservabilityConfig, service_name: str) -> bool:
    configure_logging(config)
    endpoint = os.environ.get(config.otlp_endpoint_env)
    if not config.enabled or not endpoint:
        return False
    resource = Resource.create({SERVICE_NAME: service_name})
    tracer_provider = TracerProvider(resource=resource, sampler=ParentBased(TraceIdRatioBased(config.trace_sample_ratio)))
    tracer_provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=f"{endpoint}/v1/traces")))
    trace.set_tracer_provider(tracer_provider)
    reader = PeriodicExportingMetricReader(
        OTLPMetricExporter(endpoint=f"{endpoint}/v1/metrics"), export_interval_millis=config.metric_export_interval_ms
    )
    metrics.set_meter_provider(MeterProvider(resource=resource, metric_readers=[reader]))
    logger_provider = LoggerProvider(resource=resource)
    logger_provider.add_log_record_processor(BatchLogRecordProcessor(OTLPLogExporter(endpoint=f"{endpoint}/v1/logs")))
    set_logger_provider(logger_provider)
    otel_handler = LoggingHandler(logger_provider=logger_provider)
    otel_handler.addFilter(ScrubFilter(config))
    logging.getLogger().addHandler(otel_handler)
    return True
