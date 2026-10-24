from typing import Annotated, cast

from fastapi import Depends, Query, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from careerpilot.administration.context import FIRST_PAGE, AdminActor, PageRequest
from careerpilot.api.common import bearer_token
from careerpilot.bootstrap import Container
from careerpilot.candidate.models import UserSummary

bearer = HTTPBearer(auto_error=False)
Credentials = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]


def get_container(request: Request) -> Container:
    return cast("Container", request.app.state.container)


Services = Annotated[Container, Depends(get_container)]


def current_user(services: Services, credentials: Credentials) -> UserSummary:
    return services.auth.authenticate(bearer_token(credentials))


def current_admin(services: Services, credentials: Credentials) -> AdminActor:
    return services.admin_auth.authenticate(bearer_token(credentials))


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
