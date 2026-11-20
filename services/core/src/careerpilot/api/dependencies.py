from collections.abc import AsyncGenerator
from typing import Annotated, cast

from fastapi import Depends, Header, Query, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from starlette.concurrency import run_in_threadpool

from careerpilot.administration.context import FIRST_PAGE, AdminActor, PageRequest
from careerpilot.administration.live_figures import DashboardFilter
from careerpilot.api.common import bearer_token, client_info
from careerpilot.bootstrap import Container
from careerpilot.candidate.models import UserSummary
from careerpilot.platform.enums import ActorType, UserSegment
from careerpilot.platform.persistence import Actor, acting_as

REAUTH_HEADER = "X-Reauth-Token"
bearer = HTTPBearer(auto_error=False)
Credentials = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]


def get_container(request: Request) -> Container:
    return cast("Container", request.app.state.container)


Services = Annotated[Container, Depends(get_container)]


async def current_user(request: Request, services: Services, credentials: Credentials) -> AsyncGenerator[UserSummary]:
    user, session_id = await run_in_threadpool(services.auth.authenticate_session, bearer_token(credentials))
    await run_in_threadpool(services.presence.touch, user.id, session_id, client_info(request, services.settings))
    with acting_as(Actor(user.id, ActorType.USER)):
        yield user


async def current_admin(services: Services, credentials: Credentials) -> AsyncGenerator[AdminActor]:
    admin = await run_in_threadpool(services.admin_auth.authenticate, bearer_token(credentials))
    with acting_as(Actor(admin.summary.id, ActorType.ADMIN)):
        yield admin


async def reauthenticated_admin(
    services: Services,
    admin: Annotated[AdminActor, Depends(current_admin)],
    reauth_token: Annotated[str | None, Header(alias=REAUTH_HEADER)] = None,
) -> AdminActor:
    services.admin_auth.require_reauth(admin, reauth_token)
    return admin


def page_request(
    page: Annotated[int, Query(ge=FIRST_PAGE)] = FIRST_PAGE,
    page_size: Annotated[int, Query(alias="pageSize", ge=0)] = 0,
    search: str | None = None,
    status: str | None = None,
    segment: UserSegment | None = None,
) -> PageRequest:
    return PageRequest(page=page, page_size=page_size, search=search, status=status, segment=segment)


def dashboard_filter(
    date_from: Annotated[str | None, Query(alias="dateFrom")] = None,
    date_to: Annotated[str | None, Query(alias="dateTo")] = None,
    country: str | None = None,
    track: str | None = None,
    user_id: Annotated[str | None, Query(alias="userId")] = None,
) -> DashboardFilter:
    return DashboardFilter(date_from, date_to, country, track, user_id)


Filtering = Annotated[DashboardFilter, Depends(dashboard_filter)]
CurrentUser = Annotated[UserSummary, Depends(current_user)]
CurrentAdmin = Annotated[AdminActor, Depends(current_admin)]
ReauthenticatedAdmin = Annotated[AdminActor, Depends(reauthenticated_admin)]
Paging = Annotated[PageRequest, Depends(page_request)]
