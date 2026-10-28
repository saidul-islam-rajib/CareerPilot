from collections.abc import Callable, Sequence

from careerpilot.discovery.connectors.ashby import AshbyConnector
from careerpilot.discovery.connectors.easyjobs import EasyJobsConnector
from careerpilot.discovery.connectors.greenhouse import GreenhouseConnector
from careerpilot.discovery.connectors.html import HtmlConnector
from careerpilot.discovery.connectors.lever import LeverConnector
from careerpilot.discovery.connectors.rss import RssConnector
from careerpilot.discovery.connectors.smartrecruiters import SmartRecruitersConnector
from careerpilot.discovery.connectors.workable import WorkableConnector
from careerpilot.discovery.ports import CONNECTOR_INTERFACE_VERSION, SourceConnector


class ConnectorRegistry:
    def __init__(self, connectors: list[SourceConnector]) -> None:
        incompatible = [c.key for c in connectors if c.interface_version != CONNECTOR_INTERFACE_VERSION]
        if incompatible:
            raise ValueError(", ".join(incompatible))
        self._connectors = {c.key: c for c in connectors}

    def get(self, key: str) -> SourceConnector | None:
        return self._connectors.get(key)

    def keys(self) -> list[str]:
        return sorted(self._connectors)


def first_party_connectors(
    fetch_page: Callable[[str], str] | None = None, max_details: int = 0, extra: Sequence[SourceConnector] = ()
) -> ConnectorRegistry:
    return ConnectorRegistry(
        [
            *extra,
            RssConnector(),
            GreenhouseConnector(),
            LeverConnector(),
            AshbyConnector(),
            WorkableConnector(),
            SmartRecruitersConnector(),
            EasyJobsConnector(fetch_page, max_details),
            HtmlConnector(fetch_page, max_details),
        ]
    )
