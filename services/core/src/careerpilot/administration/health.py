from collections.abc import Callable
from dataclasses import dataclass

from sqlalchemy import text

from careerpilot.administration.models import ServiceStatus
from careerpilot.platform.enums import HealthTarget, ServiceHealth
from careerpilot.platform.keyvalue import KeyValueStore
from careerpilot.platform.persistence import Database

PING_STATEMENT = "SELECT 1"
PING_KEY = "health:ping"


@dataclass(frozen=True)
class HealthProbe:
    target: HealthTarget
    check: Callable[[], object]


def database_probe(database: Database) -> HealthProbe:
    def check() -> object:
        with database.unit_of_work() as session:
            return session.execute(text(PING_STATEMENT)).scalar()

    return HealthProbe(HealthTarget.DATABASE, check)


def store_probe(target: HealthTarget, store: KeyValueStore) -> HealthProbe:
    return HealthProbe(target, lambda: store.get(PING_KEY))


def run_probes(probes: list[HealthProbe]) -> list[ServiceStatus]:
    return [ServiceStatus(service=probe.target.value, status=_state(probe).value) for probe in probes]


def _state(probe: HealthProbe) -> ServiceHealth:
    try:
        probe.check()
    except Exception:
        return ServiceHealth.DOWN
    return ServiceHealth.UP
