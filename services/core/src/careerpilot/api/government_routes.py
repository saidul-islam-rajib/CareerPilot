from dataclasses import dataclass
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse, Response

from careerpilot.api.common import no_content, ok
from careerpilot.api.dependencies import CurrentAdmin, CurrentUser, Services
from careerpilot.api.profile_routes import UploadedFile, read_upload
from careerpilot.bootstrap import Container
from careerpilot.government.models import CircularContent, ListFilters, Notice
from careerpilot.government.tracking import FeeUpdate, GovernmentTracking, SecretsInput, StageInput
from careerpilot.platform.enums import AdminArea, CircularPhase, PermissionAction
from careerpilot.platform.model import CamelModel

router = APIRouter(prefix="/v1/government")
admin_router = APIRouter(prefix="/admin/v1/government")
HOLIDAY_AUDIT = "government.holiday."
GRADE_SEPARATOR = ","


class StartBody(CamelModel):
    circular_id: str
    post_ids: list[str]


class LiveRemovedBody(CamelModel):
    removed: bool


class ImportBody(CamelModel):
    url: str


class HolidayBody(CamelModel):
    on: date
    name: str


def _grades(raw: str | None) -> list[int]:
    return [int(part) for part in (raw or "").split(GRADE_SEPARATOR) if part.strip().isdigit()]


@dataclass(frozen=True)
class GovernmentCaller:
    user_id: str
    base_url: str
    services: Container

    @property
    def tracking(self) -> GovernmentTracking:
        return self.services.government.tracking

    def view(self, application_id: str) -> JSONResponse:
        return ok(self.tracking.get(self.user_id, application_id, self.base_url))


def government_caller(user: CurrentUser, request: Request, services: Services) -> GovernmentCaller:
    return GovernmentCaller(user_id=user.id, base_url=str(request.base_url), services=services)


Caller = Annotated[GovernmentCaller, Depends(government_caller)]


@dataclass
class CircularQuery:
    grades: str | None = None
    grade_min: Annotated[int | None, Query(alias="gradeMin")] = None
    grade_max: Annotated[int | None, Query(alias="gradeMax")] = None
    authority: str | None = None
    location: str | None = None
    phase: CircularPhase | None = None
    eligible_only: Annotated[bool, Query(alias="eligibleOnly")] = False


@router.get("/reference")
def reference(_: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.government.calendar.reference())


@router.get("/circulars")
def circulars(query: Annotated[CircularQuery, Depends()], user: CurrentUser, services: Services) -> JSONResponse:
    filters = ListFilters(
        grades=_grades(query.grades),
        grade_min=query.grade_min,
        grade_max=query.grade_max,
        authority=query.authority,
        location=query.location,
        phase=query.phase,
        eligible_only=query.eligible_only,
    )
    return ok(services.government.circulars.list_for(user.id, filters))


@router.get("/circulars/{circular_id}")
def circular(circular_id: str, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.government.circulars.view_for(user.id, circular_id))


@router.get("/circulars/{circular_id}/versions/{version}")
def circular_version(circular_id: str, version: int, _: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.government.circulars.version_for(circular_id, version))


@router.get("/applications")
def applications(caller: Caller) -> JSONResponse:
    return ok(caller.tracking.list_for(caller.user_id, caller.base_url))


@router.post("/applications")
def start(body: StartBody, caller: Caller) -> JSONResponse:
    created = caller.tracking.start(caller.user_id, body.circular_id, body.post_ids)
    return caller.view(created.id)


@router.get("/applications/{application_id}")
def application(application_id: str, caller: Caller) -> JSONResponse:
    return caller.view(application_id)


@router.delete("/applications/{application_id}")
def withdraw(application_id: str, caller: Caller) -> Response:
    caller.tracking.withdraw(caller.user_id, application_id)
    return no_content()


@router.post("/applications/{application_id}/submitted")
def submitted(application_id: str, caller: Caller) -> JSONResponse:
    caller.tracking.mark_submitted(caller.user_id, application_id)
    return caller.view(application_id)


@router.post("/applications/{application_id}/confirmed")
def confirmed(application_id: str, caller: Caller) -> JSONResponse:
    caller.tracking.confirm(caller.user_id, application_id)
    return caller.view(application_id)


@router.patch("/applications/{application_id}/fee")
def fee(application_id: str, body: FeeUpdate, caller: Caller) -> JSONResponse:
    caller.tracking.update_fee(caller.user_id, application_id, body)
    return caller.view(application_id)


@router.post("/applications/{application_id}/stages")
def add_stage(application_id: str, body: StageInput, caller: Caller) -> JSONResponse:
    caller.tracking.add_stage(caller.user_id, application_id, body)
    return caller.view(application_id)


@router.put("/applications/{application_id}/stages/{stage_id}")
def update_stage(application_id: str, stage_id: str, body: StageInput, caller: Caller) -> JSONResponse:
    caller.tracking.update_stage(caller.user_id, application_id, stage_id, body)
    return caller.view(application_id)


@router.delete("/applications/{application_id}/stages/{stage_id}")
def remove_stage(application_id: str, stage_id: str, caller: Caller) -> JSONResponse:
    caller.tracking.remove_stage(caller.user_id, application_id, stage_id)
    return caller.view(application_id)


@router.post("/applications/{application_id}/copies")
def add_copy(application_id: str, file: UploadedFile, caller: Caller) -> JSONResponse:
    limit = caller.services.settings.government.limits.copy_max_bytes
    caller.tracking.add_copy(caller.user_id, application_id, read_upload(file, limit))
    return caller.view(application_id)


@router.delete("/applications/{application_id}/copies/{copy_id}")
def remove_copy(application_id: str, copy_id: str, caller: Caller) -> JSONResponse:
    caller.tracking.remove_copy(caller.user_id, application_id, copy_id)
    return caller.view(application_id)


@router.put("/applications/{application_id}/secrets")
def set_secrets(application_id: str, body: SecretsInput, caller: Caller) -> JSONResponse:
    caller.tracking.set_secrets(caller.user_id, application_id, body.values)
    return caller.view(application_id)


@router.post("/applications/{application_id}/secrets/reveal")
def reveal_secrets(application_id: str, caller: Caller) -> JSONResponse:
    revealed = caller.tracking.reveal_secrets(caller.user_id, application_id)
    response = ok({"values": {kind.value: value for kind, value in revealed.items()}})
    response.headers["Cache-Control"] = "no-store"
    return response


@router.get("/applications/{application_id}/guide")
def guide(application_id: str, caller: Caller) -> JSONResponse:
    return ok(caller.tracking.guide(caller.user_id, application_id))


@router.get("/upcoming")
def upcoming(caller: Caller) -> JSONResponse:
    return ok(caller.tracking.upcoming(caller.user_id))


@admin_router.get("/reference")
def admin_reference(_: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.government.calendar.reference())


@admin_router.get("/circulars")
def admin_circulars(admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.government.circulars.admin_list(admin))


@admin_router.post("/circulars/import")
def import_circular(body: ImportBody, admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.government.circulars.import_from_link(admin, body.url))


@admin_router.post("/circulars")
def create_circular(body: CircularContent, admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.government.circulars.create(admin, body))


@admin_router.get("/circulars/{circular_id}")
def admin_circular(circular_id: str, admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.government.circulars.admin_get(admin, circular_id))


@admin_router.put("/circulars/{circular_id}")
def update_circular(circular_id: str, body: CircularContent, admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.government.circulars.update(admin, circular_id, body))


@admin_router.post("/circulars/{circular_id}/publish")
def publish_circular(circular_id: str, admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.government.circulars.publish(admin, circular_id))


@admin_router.post("/circulars/{circular_id}/withdraw")
def withdraw_circular(circular_id: str, admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.government.circulars.withdraw(admin, circular_id))


@admin_router.put("/circulars/{circular_id}/live-removed")
def live_removed(circular_id: str, body: LiveRemovedBody, admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.government.circulars.mark_live_removed(admin, circular_id, body.removed))


@admin_router.post("/circulars/{circular_id}/notices")
def add_notice(circular_id: str, body: Notice, admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.government.circulars.add_notice(admin, circular_id, body))


@admin_router.delete("/circulars/{circular_id}")
def remove_circular(circular_id: str, admin: CurrentAdmin, services: Services) -> Response:
    services.government.circulars.remove(admin, circular_id)
    return no_content()


@admin_router.get("/holidays")
def holidays(admin: CurrentAdmin, services: Services) -> JSONResponse:
    admin.require(AdminArea.SETTINGS, PermissionAction.READ)
    return ok(services.government.calendar.list_holidays())


@admin_router.post("/holidays")
def add_holiday(body: HolidayBody, admin: CurrentAdmin, services: Services) -> JSONResponse:
    admin.require(AdminArea.SETTINGS, PermissionAction.UPDATE)
    holiday = services.government.calendar.add_holiday(body.on, body.name)
    admin.record(f"{HOLIDAY_AUDIT}added", holiday.name)
    return ok(holiday)


@admin_router.delete("/holidays/{holiday_id}")
def remove_holiday(holiday_id: str, admin: CurrentAdmin, services: Services) -> Response:
    admin.require(AdminArea.SETTINGS, PermissionAction.UPDATE)
    services.government.calendar.remove_holiday(holiday_id)
    admin.record(f"{HOLIDAY_AUDIT}removed", holiday_id)
    return no_content()
