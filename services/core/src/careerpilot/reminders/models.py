from dataclasses import dataclass

from careerpilot.platform.enums import NotificationKind, NotificationTarget
from careerpilot.reminders.enums import ReminderStage

KEY_SEPARATOR = ":"


@dataclass(frozen=True)
class ReminderItem:
    stage: ReminderStage
    marker: tuple[str, ...]
    kind: NotificationKind
    title_key: str
    body_key: str
    params: dict[str, str | int]
    target: tuple[NotificationTarget, str]

    @property
    def key(self) -> str:
        return KEY_SEPARATOR.join((self.stage.value, *self.marker))
