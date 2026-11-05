import threading
import time
from collections import defaultdict
from collections.abc import Callable
from contextlib import contextmanager
from collections.abc import Iterator

from careerpilot.portal.config import ThrottleConfig


class HostThrottle:
    def __init__(
        self,
        config: ThrottleConfig,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._config = config
        self._clock = clock
        self._sleep = sleep
        self._lock = threading.Lock()
        self._last: dict[str, float] = {}
        self._hosts: dict[str, threading.BoundedSemaphore] = defaultdict(lambda: threading.BoundedSemaphore(config.max_concurrent_per_host))
        self._total = threading.BoundedSemaphore(config.max_concurrent_total)

    @contextmanager
    def slot(self, host: str) -> Iterator[None]:
        with self._total, self._host_semaphore(host):
            self._pace(host)
            try:
                yield
            finally:
                self._stamp(host)

    def _host_semaphore(self, host: str) -> threading.BoundedSemaphore:
        with self._lock:
            return self._hosts[host]

    def _pace(self, host: str) -> None:
        with self._lock:
            last = self._last.get(host)
        if last is None:
            return
        wait = self._config.min_interval_seconds - (self._clock() - last)
        if wait > 0:
            self._sleep(wait)

    def _stamp(self, host: str) -> None:
        with self._lock:
            self._last[host] = self._clock()
