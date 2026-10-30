from fastapi import APIRouter
from fastapi.responses import JSONResponse, RedirectResponse, Response

from careerpilot.api.common import no_content, ok
from careerpilot.api.dependencies import CurrentAdmin, CurrentUser, Services
from careerpilot.platform.enums import ConnectFailure

router = APIRouter(prefix="/v1/integrations/google")
admin_router = APIRouter(prefix="/admin/v1")


@router.get("/authorize-url")
def authorize_url(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.integrations.google.authorize_url(user.id))


@router.get("/callback")
def callback(services: Services, state: str | None = None, code: str | None = None, error: str | None = None) -> RedirectResponse:
    if not state:
        return RedirectResponse(services.integrations.google.return_url(ConnectFailure.INVALID_STATE))
    return RedirectResponse(services.integrations.google.complete(state, code, error))


@router.get("")
def status(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.integrations.google.status(user.id))


@router.post("/sync")
def sync_now(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.integrations.sync.sync_user(user.id))


@router.delete("")
def disconnect(user: CurrentUser, services: Services) -> Response:
    services.integrations.google.disconnect(user.id)
    return no_content()


@admin_router.get("/users/{user_id}/integrations")
def connected_accounts(user_id: str, admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.integrations.admin.connected_accounts(admin, user_id))
