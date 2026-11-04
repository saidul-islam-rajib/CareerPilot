from dataclasses import dataclass
from datetime import date

from careerpilot.academic.config import AcademicConfig
from careerpilot.academic.enums import Failure, RecordKind
from careerpilot.academic.models import (
    Credential,
    Exam,
    Outreach,
    Program,
    Recommendation,
    Referee,
    StoredOutreachSettings,
)
from careerpilot.academic.ports import AcademicRecordRepository
from careerpilot.academic.store import RecordStore
from careerpilot.candidate.ports import WorkspaceRepository
from careerpilot.candidate.services.opportunities import OpportunityService
from careerpilot.platform.clock import Clock, IdGenerator
from careerpilot.platform.errors import validation_error

PROGRAM_PREFIX = "acp"
EXAM_PREFIX = "acx"
CREDENTIAL_PREFIX = "acc"
REFEREE_PREFIX = "acr"
RECOMMENDATION_PREFIX = "acm"
OUTREACH_PREFIX = "aco"
SETTINGS_PREFIX = "acs"
ITEM_PREFIX = "aci"


@dataclass(frozen=True)
class AcademicContext:
    config: AcademicConfig
    clock: Clock
    ids: IdGenerator
    records: AcademicRecordRepository
    workspaces: WorkspaceRepository
    opportunities: OpportunityService


class Stores:
    def __init__(self, context: AcademicContext) -> None:
        records, ids = context.records, context.ids
        self.programs = RecordStore(records, RecordKind.PROGRAM, Program, ids, PROGRAM_PREFIX)
        self.exams = RecordStore(records, RecordKind.TEST, Exam, ids, EXAM_PREFIX)
        self.credentials = RecordStore(records, RecordKind.CREDENTIAL, Credential, ids, CREDENTIAL_PREFIX)
        self.referees = RecordStore(records, RecordKind.REFEREE, Referee, ids, REFEREE_PREFIX)
        self.recommendations = RecordStore(records, RecordKind.RECOMMENDATION, Recommendation, ids, RECOMMENDATION_PREFIX)
        self.outreach = RecordStore(records, RecordKind.OUTREACH, Outreach, ids, OUTREACH_PREFIX)
        self.settings = RecordStore(records, RecordKind.SETTINGS, StoredOutreachSettings, ids, SETTINGS_PREFIX)


def today(context: AcademicContext) -> date:
    return context.clock.now().date()


def check_size(context: AcademicContext, *lists: list[object]) -> None:
    if any(len(items) > context.config.max_items_per_list for items in lists):
        raise validation_error(Failure.TOO_MANY_ITEMS.value)
