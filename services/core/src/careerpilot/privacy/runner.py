from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor


class DirectRunner:
    def run(self, job: Callable[[], object]) -> None:
        job()


class BackgroundRunner:
    def __init__(self, executor: ThreadPoolExecutor) -> None:
        self._executor = executor

    def run(self, job: Callable[[], object]) -> None:
        self._executor.submit(job)
