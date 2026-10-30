import re
from dataclasses import dataclass

from fastapi import status
from fastapi.responses import Response

RANGE_HEADER = "Range"
ACCEPT_RANGES = "Accept-Ranges"
CONTENT_RANGE = "Content-Range"
BYTES = "bytes"
RANGE_PATTERN = re.compile(r"^bytes=(\d*)-(\d*)$")


@dataclass(frozen=True)
class ByteRange:
    start: int
    end: int


def requested_range(header: str, size: int) -> ByteRange | None:
    match = RANGE_PATTERN.match(header.strip())
    if match is None:
        return None
    first, last = match.groups()
    if not first and not last:
        return None
    if not first:
        return ByteRange(start=size - min(int(last), size), end=size - 1)
    return ByteRange(start=int(first), end=min(int(last), size - 1) if last else size - 1)


def file_response(data: bytes, media_type: str, headers: dict[str, str], range_header: str | None) -> Response:
    common = {**headers, ACCEPT_RANGES: BYTES}
    size = len(data)
    wanted = requested_range(range_header, size) if range_header else None
    if wanted is None:
        return Response(content=data, media_type=media_type, headers=common)
    if wanted.start > wanted.end or wanted.start >= size:
        return Response(status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE, headers={**common, CONTENT_RANGE: f"{BYTES} */{size}"})
    return Response(
        content=data[wanted.start : wanted.end + 1],
        status_code=status.HTTP_206_PARTIAL_CONTENT,
        media_type=media_type,
        headers={**common, CONTENT_RANGE: f"{BYTES} {wanted.start}-{wanted.end}/{size}"},
    )
