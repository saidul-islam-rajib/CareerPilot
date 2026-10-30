import hashlib
import hmac
import re
from collections.abc import Callable
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path
from typing import Protocol
from urllib.parse import quote, urlencode

from careerpilot.platform.clock import Clock

KEY_PATTERN = re.compile(r"^[a-z0-9][a-z0-9/_.-]{0,199}$")
PARENT = ".."
SAMPLE_PREFIX = "sample/"
PDF = "application/pdf"
PNG = "image/png"
JPEG = "image/jpeg"
WEBP = "image/webp"
MP4_AUDIO = "audio/mp4"
WEBM_AUDIO = "audio/webm"
OGG_AUDIO = "audio/ogg"
MPEG_AUDIO = "audio/mpeg"
AAC_AUDIO = "audio/aac"
WAV_AUDIO = "audio/wav"
EXTENSIONS = {
    PDF: "pdf",
    PNG: "png",
    JPEG: "jpg",
    WEBP: "webp",
    MP4_AUDIO: "m4a",
    WEBM_AUDIO: "webm",
    OGG_AUDIO: "ogg",
    MPEG_AUDIO: "mp3",
    AAC_AUDIO: "aac",
    WAV_AUDIO: "wav",
}
SIGNATURE_SEPARATOR = "\n"
FILES_PATH = "v1/files"
WEBP_HEADER = (b"RIFF", b"WEBP")
PDF_HEADER = b"%PDF-"
PNG_HEADER = b"\x89PNG\r\n\x1a\n"
JPEG_HEADER = b"\xff\xd8\xff"
WEBP_TAG_OFFSET = slice(8, 12)
WEBP_RIFF_OFFSET = slice(0, 4)
WAV_TAG = b"WAVE"
MP4_BOX = b"ftyp"
MP4_BOX_OFFSET = slice(4, 8)
WEBM_HEADER = bytes([0x1A, 0x45, 0xDF, 0xA3])
OGG_HEADER = b"OggS"
ID3_HEADER = b"ID3"
FRAME_SYNC = 0xFF
AAC_SECOND_BYTES = frozenset({0xF1, 0xF9})
MPEG_SYNC_MASK = 0xE0


class StorageKeyError(ValueError):
    pass


class FileStorage(Protocol):
    def put(self, key: str, data: bytes) -> None: ...

    def get(self, key: str) -> bytes | None: ...


def require_key(key: str) -> str:
    if not KEY_PATTERN.match(key) or PARENT in key:
        raise StorageKeyError(key)
    return key


def detect_content_type(data: bytes) -> str | None:
    if data.startswith(PDF_HEADER):
        return PDF
    if data.startswith(PNG_HEADER):
        return PNG
    if data.startswith(JPEG_HEADER):
        return JPEG
    if (data[WEBP_RIFF_OFFSET], data[WEBP_TAG_OFFSET]) == WEBP_HEADER:
        return WEBP
    return detect_audio_type(data)


def _frame_sync(data: bytes) -> bool:
    return len(data) > 1 and data[0] == FRAME_SYNC


AUDIO_SIGNATURES: tuple[tuple[Callable[[bytes], bool], str], ...] = (
    (lambda data: data[MP4_BOX_OFFSET] == MP4_BOX, MP4_AUDIO),
    (lambda data: data.startswith(WEBM_HEADER), WEBM_AUDIO),
    (lambda data: data.startswith(OGG_HEADER), OGG_AUDIO),
    (lambda data: (data[WEBP_RIFF_OFFSET], data[WEBP_TAG_OFFSET]) == (WEBP_HEADER[0], WAV_TAG), WAV_AUDIO),
    (lambda data: data.startswith(ID3_HEADER), MPEG_AUDIO),
    (lambda data: _frame_sync(data) and data[1] in AAC_SECOND_BYTES, AAC_AUDIO),
    (lambda data: _frame_sync(data) and data[1] & MPEG_SYNC_MASK == MPEG_SYNC_MASK, MPEG_AUDIO),
)


def detect_audio_type(data: bytes) -> str | None:
    return next((kind for matches, kind in AUDIO_SIGNATURES if matches(data)), None)


class LocalFileStorage:
    def __init__(self, root: Path) -> None:
        self._root = root

    def put(self, key: str, data: bytes) -> None:
        path = self._root / require_key(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def get(self, key: str) -> bytes | None:
        path = self._root / require_key(key)
        return path.read_bytes() if path.is_file() else None


class InMemoryFileStorage:
    def __init__(self) -> None:
        self._files: dict[str, bytes] = {}

    def put(self, key: str, data: bytes) -> None:
        self._files[require_key(key)] = data

    def get(self, key: str) -> bytes | None:
        return self._files.get(require_key(key))


def sample_pdf(title: str) -> bytes:
    safe = title.encode("latin-1", "replace").replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)")
    stream = b"BT /F1 20 Tf 72 720 Td (" + safe + b") Tj ET"
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    body = bytearray(b"%PDF-1.4\n")
    offsets: list[int] = []
    for number, content in enumerate(objects, start=1):
        offsets.append(len(body))
        body += f"{number} 0 obj\n".encode() + content + b"\nendobj\n"
    xref = len(body)
    body += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    body += b"".join(f"{offset:010d} 00000 n \n".encode() for offset in offsets)
    body += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return bytes(body)


class SampleAwareStorage:
    def __init__(self, inner: FileStorage) -> None:
        self._inner = inner

    def put(self, key: str, data: bytes) -> None:
        self._inner.put(key, data)

    def get(self, key: str) -> bytes | None:
        if require_key(key).startswith(SAMPLE_PREFIX):
            return self._inner.get(key) or sample_pdf(Path(key).stem.replace("-", " ").title())
        return self._inner.get(key)


@dataclass(frozen=True)
class SignedFile:
    key: str
    expires: int
    name: str


class FileLinkSigner:
    def __init__(self, secret: str, clock: Clock, ttl_seconds: int, reuse_seconds: int) -> None:
        self._secret = secret.encode()
        self._clock = clock
        self._ttl = ttl_seconds
        self._reuse = reuse_seconds

    def link(self, base_url: str, key: str, name: str) -> str:
        earliest = int((self._clock.now() + timedelta(seconds=self._ttl)).timestamp())
        expires = (earliest // self._reuse + 1) * self._reuse
        query = urlencode({"expires": expires, "name": name, "signature": self._sign(key, expires, name)})
        return f"{base_url.rstrip('/')}/{FILES_PATH}/{quote(key)}?{query}"

    def verify(self, key: str, expires: int, name: str, signature: str) -> SignedFile | None:
        expected = self._sign(key, expires, name)
        if not hmac.compare_digest(expected, signature) or expires < int(self._clock.now().timestamp()):
            return None
        return SignedFile(key=key, expires=expires, name=name)

    def _sign(self, key: str, expires: int, name: str) -> str:
        message = SIGNATURE_SEPARATOR.join((key, str(expires), name)).encode()
        return hmac.new(self._secret, message, hashlib.sha256).hexdigest()
