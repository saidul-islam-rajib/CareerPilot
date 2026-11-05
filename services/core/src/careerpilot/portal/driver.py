from collections.abc import Callable, Sequence
from contextlib import AbstractContextManager
from dataclasses import dataclass, field
from typing import Protocol

from careerpilot.portal.enums import FieldKind


class DriverError(Exception):
    pass


@dataclass(frozen=True)
class FormField:
    handle: str
    kind: FieldKind
    label: str
    name: str = ""
    autocomplete: str = ""
    required: bool = False
    options: tuple[str, ...] = ()
    value: str = ""


@dataclass(frozen=True)
class PageSnapshot:
    url: str
    title: str
    text: str
    present: frozenset[str] = field(default_factory=frozenset[str])


class PageDriver(Protocol):
    def open(self, url: str) -> None: ...

    def snapshot(self, selectors: Sequence[str]) -> PageSnapshot: ...

    def fields(self) -> list[FormField]: ...

    def fill(self, handle: str, value: str) -> None: ...

    def choose(self, handle: str, option: str) -> None: ...

    def check(self, handle: str, checked: bool) -> None: ...

    def upload(self, handle: str, file_name: str, content: bytes) -> None: ...

    def click_labelled(self, labels: Sequence[str]) -> bool: ...

    def click_selector(self, selectors: Sequence[str]) -> bool: ...

    def has_labelled(self, labels: Sequence[str]) -> bool: ...

    def has_selector(self, selectors: Sequence[str]) -> bool: ...

    def screenshot(self) -> bytes: ...


BrowserSession = Callable[[], AbstractContextManager[PageDriver]]
