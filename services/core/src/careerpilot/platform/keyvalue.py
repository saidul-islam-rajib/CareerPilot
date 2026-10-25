from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Protocol, TypeVar, cast

from redis import Redis, RedisError

from careerpilot.platform.clock import Clock

ResultT = TypeVar("ResultT")


class StoreUnavailableError(Exception):
    pass


class KeyValueStore(Protocol):
    def get(self, key: str) -> str | None: ...

    def put(self, key: str, value: str, ttl_seconds: int) -> None: ...

    def remove(self, key: str) -> None: ...

    def increment(self, key: str, ttl_seconds: int) -> int: ...

    def seconds_left(self, key: str) -> int: ...


@dataclass
class _Entry:
    value: str
    expires_at: datetime


class InMemoryKeyValueStore:
    def __init__(self, clock: Clock) -> None:
        self._clock = clock
        self._entries: dict[str, _Entry] = {}

    def get(self, key: str) -> str | None:
        entry = self._live(key)
        return entry.value if entry else None

    def put(self, key: str, value: str, ttl_seconds: int) -> None:
        self._entries[key] = _Entry(value, self._clock.now() + timedelta(seconds=ttl_seconds))

    def remove(self, key: str) -> None:
        self._entries.pop(key, None)

    def increment(self, key: str, ttl_seconds: int) -> int:
        entry = self._live(key)
        if entry is None:
            self.put(key, "1", ttl_seconds)
            return 1
        entry.value = str(int(entry.value) + 1)
        return int(entry.value)

    def seconds_left(self, key: str) -> int:
        entry = self._live(key)
        return max(0, int((entry.expires_at - self._clock.now()).total_seconds())) if entry else 0

    def _live(self, key: str) -> _Entry | None:
        entry = self._entries.get(key)
        if entry is not None and entry.expires_at <= self._clock.now():
            del self._entries[key]
            return None
        return entry


class RedisKeyValueStore:
    def __init__(self, client: Redis) -> None:
        self._client = client

    @classmethod
    def from_url(cls, url: str, socket_timeout_seconds: float) -> "RedisKeyValueStore":
        client = Redis.from_url(  # pyright: ignore[reportUnknownMemberType]
            url, decode_responses=True, socket_timeout=socket_timeout_seconds, socket_connect_timeout=socket_timeout_seconds
        )
        return cls(client)

    def get(self, key: str) -> str | None:
        return self._call(lambda: cast("str | None", self._client.get(key)))

    def put(self, key: str, value: str, ttl_seconds: int) -> None:
        self._call(lambda: self._client.set(key, value, ex=ttl_seconds))

    def remove(self, key: str) -> None:
        self._call(lambda: self._client.delete(key))

    def increment(self, key: str, ttl_seconds: int) -> int:
        def run() -> int:
            pipeline = self._client.pipeline()  # pyright: ignore[reportUnknownMemberType]
            pipeline.incr(key)
            pipeline.expire(key, ttl_seconds, nx=True)
            count, _ = cast("list[int]", pipeline.execute())
            return count

        return self._call(run)

    def seconds_left(self, key: str) -> int:
        return max(0, self._call(lambda: self._client.ttl(key)))

    @staticmethod
    def _call(operation: Callable[[], ResultT]) -> ResultT:
        try:
            return operation()
        except RedisError as error:
            raise StoreUnavailableError(type(error).__name__) from error
