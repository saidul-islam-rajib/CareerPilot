import ipaddress
import socket
from collections.abc import Callable
from urllib.parse import urlsplit, urlunsplit

SAFE_SCHEME = "https"
DEFAULT_HTTPS_PORT = 443
USERINFO_MARK = "@"
ADDRESS_INDEX = 4

Resolver = Callable[[str, int], list[str]]


def resolve_addresses(host: str, port: int) -> list[str]:
    return [str(info[ADDRESS_INDEX][0]) for info in socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)]


def public_https_url(url: str, resolve: Resolver = resolve_addresses) -> str | None:
    parts = urlsplit(url.strip())
    if parts.scheme != SAFE_SCHEME or not parts.hostname or USERINFO_MARK in parts.netloc:
        return None
    try:
        addresses = resolve(parts.hostname, parts.port or DEFAULT_HTTPS_PORT)
    except (OSError, ValueError):
        return None
    if not addresses or not all(ipaddress.ip_address(address.split("%")[0]).is_global for address in addresses):
        return None
    return urlunsplit((parts.scheme, parts.netloc, parts.path, parts.query, ""))


def host_resolves(url: str, resolve: Resolver = resolve_addresses) -> bool:
    host = urlsplit(url.strip()).hostname
    if not host:
        return False
    try:
        return bool(resolve(host, DEFAULT_HTTPS_PORT))
    except (OSError, ValueError):
        return False
