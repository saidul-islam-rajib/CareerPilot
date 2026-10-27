import asyncio

import uvicorn

from careerpilot.api.admin_app import create_admin_app
from careerpilot.api.user_app import create_user_app
from careerpilot.bootstrap import build_container


async def serve() -> None:
    container = build_container()
    container.invite_owner()
    http = container.settings.http
    servers = [
        uvicorn.Server(uvicorn.Config(create_user_app(container), host=http.host, port=http.user_api_port)),
        uvicorn.Server(uvicorn.Config(create_admin_app(container), host=http.host, port=http.admin_api_port)),
    ]
    await asyncio.gather(*(server.serve() for server in servers))


def main() -> None:
    asyncio.run(serve())


if __name__ == "__main__":
    main()
