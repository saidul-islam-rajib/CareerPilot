from pydantic import BaseModel, ConfigDict, Field

from careerpilot.platform.enums import NotificationKind

TIME_OF_DAY_PATTERN = r"^([01]\d|2[0-3]):[0-5]\d$"


class RemindersBase(BaseModel):
    model_config = ConfigDict(extra="ignore", frozen=True)


class QuietHoursConfig(RemindersBase):
    default_start: str = Field(pattern=TIME_OF_DAY_PATTERN)
    default_end: str = Field(pattern=TIME_OF_DAY_PATTERN)
    urgent_kinds: list[NotificationKind]


class RemindersConfig(RemindersBase):
    approval_lead_hours: list[int]
    government_lead_days: list[int]
    quiet_hours: QuietHoursConfig
