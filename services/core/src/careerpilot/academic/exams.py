from careerpilot.academic.context import ITEM_PREFIX, AcademicContext, Stores, check_size
from careerpilot.academic.enums import ConversionSource, Failure
from careerpilot.academic.models import (
    Credential,
    CredentialInput,
    CredentialView,
    Exam,
    ExamInput,
    ExamView,
)
from careerpilot.academic.planner import exam_view
from careerpilot.platform.errors import validation_error


class ExamService:
    def __init__(self, context: AcademicContext, stores: Stores) -> None:
        self._ctx = context
        self._stores = stores

    def items(self, user_id: str) -> list[ExamView]:
        return [exam_view(exam, self._ctx.config) for exam in self._stores.exams.all(user_id)]

    def create(self, user_id: str, data: ExamInput) -> ExamView:
        exam = Exam(id=self._stores.exams.new_id(), user_id=user_id, **self._clean(user_id, data).model_dump())
        return exam_view(self._stores.exams.save(user_id, exam.id, exam), self._ctx.config)

    def update(self, user_id: str, exam_id: str, data: ExamInput) -> ExamView:
        self._stores.exams.find(user_id, exam_id)
        exam = Exam(id=exam_id, user_id=user_id, **self._clean(user_id, data).model_dump())
        return exam_view(self._stores.exams.save(user_id, exam_id, exam), self._ctx.config)

    def remove(self, user_id: str, exam_id: str) -> None:
        self._stores.exams.find(user_id, exam_id)
        self._stores.exams.remove(user_id, exam_id)

    def _clean(self, user_id: str, data: ExamInput) -> ExamInput:
        check_size(self._ctx, list(data.reports))
        allowed = set(self._ctx.config.exam(data.exam).sections)
        if data.scores is not None and allowed and not set(data.scores.sections) <= allowed:
            raise validation_error(Failure.UNKNOWN_SECTION.value)
        owned = {p.id for p in self._stores.programs.all(user_id)}
        for report in data.reports:
            if report.program_id not in owned:
                raise validation_error(Failure.UNKNOWN_PROGRAM.value)
            report.id = report.id or self._ctx.ids.next(ITEM_PREFIX)
            if report.confirmed_receipt and report.confirmed_on is None:
                report.confirmed_on = self._ctx.clock.now().date()
            if not report.confirmed_receipt:
                report.confirmed_on = None
        return data


class CredentialService:
    def __init__(self, context: AcademicContext, stores: Stores) -> None:
        self._ctx = context
        self._stores = stores

    def items(self, user_id: str) -> list[CredentialView]:
        return [self._view(c) for c in self._stores.credentials.all(user_id)]

    def create(self, user_id: str, data: CredentialInput) -> CredentialView:
        credential = Credential(id=self._stores.credentials.new_id(), user_id=user_id, **self._clean(data).model_dump())
        return self._view(self._stores.credentials.save(user_id, credential.id, credential))

    def update(self, user_id: str, credential_id: str, data: CredentialInput) -> CredentialView:
        self._stores.credentials.find(user_id, credential_id)
        credential = Credential(id=credential_id, user_id=user_id, **self._clean(data).model_dump())
        return self._view(self._stores.credentials.save(user_id, credential_id, credential))

    def remove(self, user_id: str, credential_id: str) -> None:
        self._stores.credentials.find(user_id, credential_id)
        self._stores.credentials.remove(user_id, credential_id)

    def _clean(self, data: CredentialInput) -> CredentialInput:
        if data.converted_value and data.conversion_source is None:
            data.conversion_source = ConversionSource.ESTIMATE
        if not data.converted_value:
            data.conversion_source = None
        return data

    def _view(self, credential: Credential) -> CredentialView:
        estimated = bool(credential.converted_value) and credential.conversion_source is not ConversionSource.OFFICIAL
        return CredentialView(**credential.model_dump(), conversion_is_estimate=estimated)
