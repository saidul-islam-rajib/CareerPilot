from enum import StrEnum


class ReminderStage(StrEnum):
    APPROVAL = "approval"
    GOVERNMENT = "government"
    FEE = "fee"
    SUPERVISOR = "supervisor"
    PROFILE = "profile"
