from typing import Any

from careerpilot.administration.models import NotificationCounts, SecretMetadata, ServiceStatus
from careerpilot.administration.ports import OperationsSnapshot


def operations_from_document(document: dict[str, Any]) -> OperationsSnapshot:
    return OperationsSnapshot(
        services=[ServiceStatus.model_validate(s) for s in document["services"]],
        notifications=NotificationCounts.model_validate(document["notifications"]),
        archived_circulars=int(document["archivedCirculars"]),
        user_phones={k: str(v) for k, v in document["userPhones"].items()},
        user_secrets={k: [SecretMetadata.model_validate(s) for s in v] for k, v in document["secrets"].items()},
    )


def operations_document(seed: dict[str, Any]) -> dict[str, object]:
    return {key: seed[key] for key in ("services", "notifications", "archivedCirculars", "userPhones", "secrets")}
