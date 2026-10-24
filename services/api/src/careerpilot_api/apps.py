from fastapi import FastAPI

from careerpilot.api.admin_app import create_admin_app
from careerpilot.api.user_app import create_user_app
from careerpilot.bootstrap import build_container


def user_api() -> FastAPI:
    return create_user_app(build_container())


def admin_api() -> FastAPI:
    return create_admin_app(build_container())
