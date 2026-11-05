from collections.abc import Callable

from careerpilot.candidate.models import ApplicationRecord
from careerpilot.portal.config import PortalsConfig
from careerpilot.portal.enums import RecordKind
from careerpilot.portal.models import PortalSettings
from careerpilot.portal.ports import PortalRecordRepository
from careerpilot.portal.store import RecordStore

SETTINGS_KEY = "settings"


def autopilot_handles(records: PortalRecordRepository, config: PortalsConfig) -> Callable[[str, ApplicationRecord], bool]:
    store = RecordStore(records, RecordKind.SETTINGS, PortalSettings)
    routes = {route.value for route in config.routes}

    def handles(user_id: str, application: ApplicationRecord) -> bool:
        settings = store.get(user_id, SETTINGS_KEY)
        return settings is not None and settings.enabled and application.route in routes

    return handles
