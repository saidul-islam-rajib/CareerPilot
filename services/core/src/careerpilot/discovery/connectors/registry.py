from careerpilot.discovery.connectors.greenhouse import GreenhouseConnector
from careerpilot.discovery.connectors.rss import RssConnector
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


def first_party_connectors() -> ConnectorRegistry:
    return ConnectorRegistry([RssConnector(), GreenhouseConnector()])
