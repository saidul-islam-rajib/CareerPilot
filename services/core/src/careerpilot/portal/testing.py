from collections.abc import Callable, Sequence
from dataclasses import dataclass, field

from careerpilot.portal.driver import DriverError, FormField, PageSnapshot


@dataclass
class FakePage:
    text: str = ""
    title: str = ""
    fields: list[FormField] = field(default_factory=list[FormField])
    present: frozenset[str] = field(default_factory=frozenset[str])
    buttons: dict[str, str | Callable[["FakeDriver"], str]] = field(default_factory=dict[str, str | Callable[["FakeDriver"], str]])
    selectors: dict[str, str] = field(default_factory=dict[str, str])


@dataclass
class FakeDriver:
    pages: dict[str, FakePage]
    start: str
    current: str = ""
    urls: dict[str, str] = field(default_factory=dict[str, str])
    opened: list[str] = field(default_factory=list[str])
    filled: dict[str, str] = field(default_factory=dict[str, str])
    chosen: dict[str, str] = field(default_factory=dict[str, str])
    checked: dict[str, bool] = field(default_factory=dict[str, bool])
    uploads: dict[str, str] = field(default_factory=dict[str, str])
    clicks: list[str] = field(default_factory=list[str])
    fail_after_click: str | None = None

    def open(self, url: str) -> None:
        self.opened.append(url)
        target = self.urls.get(url)
        if target is None and not self.current:
            target = self.start
        if target is not None:
            self.current = target

    def _page(self) -> FakePage:
        return self.pages[self.current]

    def snapshot(self, selectors: Sequence[str]) -> PageSnapshot:
        page = self._page()
        return PageSnapshot(
            url=f"https://fake.test/{self.current}",
            title=page.title,
            text=page.text,
            present=frozenset(s for s in selectors if s in page.present),
        )

    def fields(self) -> list[FormField]:
        return list(self._page().fields)

    def fill(self, handle: str, value: str) -> None:
        self.filled[handle] = value

    def choose(self, handle: str, option: str) -> None:
        self.chosen[handle] = option

    def check(self, handle: str, checked: bool) -> None:
        self.checked[handle] = checked

    def upload(self, handle: str, file_name: str, content: bytes) -> None:
        self.uploads[handle] = file_name

    def _press(self, key: str, target: str | Callable[["FakeDriver"], str]) -> bool:
        self.clicks.append(key)
        self.current = target(self) if callable(target) else target
        if self.fail_after_click == key:
            raise DriverError("lost_connection")
        return True

    def click_labelled(self, labels: Sequence[str]) -> bool:
        for label in labels:
            for key, target in self._page().buttons.items():
                if label.lower() in key.lower():
                    return self._press(key, target)
        return False

    def click_selector(self, selectors: Sequence[str]) -> bool:
        for selector in selectors:
            target = self._page().selectors.get(selector)
            if target is not None:
                return self._press(selector, target)
        return False

    def has_labelled(self, labels: Sequence[str]) -> bool:
        return any(label.lower() in key.lower() for label in labels for key in self._page().buttons)

    def has_selector(self, selectors: Sequence[str]) -> bool:
        return any(selector in self._page().selectors for selector in selectors)

    def screenshot(self) -> bytes:
        return b"png"
