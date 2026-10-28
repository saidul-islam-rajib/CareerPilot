from careerpilot.administration.models import PlatformSettings
from careerpilot.platform.config import JobSourcesConfig


def effective_source_limit(settings: PlatformSettings, config: JobSourcesConfig) -> int:
    return settings.max_sources_per_user or config.max_per_user
