from collections.abc import AsyncGenerator
from typing import Annotated, cast

from fastapi import Depends, Query, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from starlette.concurrency import run_in_threadpool

from careerpilot.administration.context import FIRST_PAGE, AdminActor, PageRequest
from careerpilot.api.common import bearer_token
from careerpilot.bootstrap import Container
from careerpilot.candidate.models import UserSummary
from careerpilot.platform.enums import ActorType
from careerpilot.platform.persistence import Actor, acting_as

bearer = HTTPBearer(auto_error=False)
Credentials = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]


def get_container(request: Request) -> Container:
    return cast("Container", request.app.state.container)


Services = Annotated[Container, Depends(get_container)]


async def current_user(services: Services, credentials: Credentials) -> AsyncGenerator[UserSummary]:
    user = await run_in_threadpool(services.auth.authenticate, bearer_token(credentials))
    with acting_as(Actor(user.id, ActorType.USER)):
        yield user


async def current_admin(services: Services, credentials: Credentials) -> AsyncGenerator[AdminActor]:
    admin = await run_in_threadpool(services.admin_auth.authenticate, bearer_token(credentials))
    with acting_as(Actor(admin.summary.id, ActorType.ADMIN)):
        yield admin


def page_request(
    page: Annotated[int, Query(ge=FIRST_PAGE)] = FIRST_PAGE,
    page_size: Annotated[int, Query(alias="pageSize", ge=0)] = 0,
    search: str | None = None,
    status: str | None = None,
) -> PageRequest:
    return PageRequest(page=page, page_size=page_size, search=search, status=status)


CurrentUser = Annotated[UserSummary, Depends(current_user)]
CurrentAdmin = Annotated[AdminActor, Depends(current_admin)]
Paging = Annotated[PageRequest, Depends(page_request)]
