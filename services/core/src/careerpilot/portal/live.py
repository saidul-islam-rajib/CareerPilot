import os
from collections.abc import Mapping

from careerpilot.platform.config import SubmissionConfig

APP_ENV = "APP_ENV"


def real_applications_enabled(config: SubmissionConfig, environ: Mapping[str, str] | None = None) -> bool:
    values = os.environ if environ is None else environ
    if any(values.get(marker) for marker in config.real_applications_blocked_markers):
        return False
    if values.get(APP_ENV, "").strip().lower() in config.real_applications_blocked_environments:
        return False
    raw = values.get(config.real_applications_env, "").strip().lower()
    if not raw:
        return config.real_applications
    return raw in config.real_applications_true_values
