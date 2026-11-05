from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from typing import Any, cast

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import Page, sync_playwright

from careerpilot.portal.config import BrowserConfig
from careerpilot.portal.driver import DriverError, FormField, PageDriver, PageSnapshot
from careerpilot.portal.enums import FieldKind

MILLISECONDS = 1000
HANDLE_ATTRIBUTE = "data-cp"
GROUP_PREFIX = "group:"
CONTENT_TYPE = "application/pdf"
MAX_BODY_CHARS = 20000

COLLECT_FIELDS = """
() => {
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const labelOf = (el) => {
    const ids = el.getAttribute('aria-labelledby');
    if (ids) return ids.split(' ').map(i => (document.getElementById(i) || {}).innerText || '').join(' ').trim();
    if (el.id) { const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (l) return l.innerText.trim(); }
    const wrap = el.closest('label'); if (wrap) return wrap.innerText.trim();
    return (el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim();
  };
  const groupLabel = (el) => {
    const set = el.closest('fieldset'); if (set) { const l = set.querySelector('legend'); if (l) return l.innerText.trim(); }
    const p = el.closest('[role=radiogroup],[role=group]'); if (p && p.getAttribute('aria-label')) return p.getAttribute('aria-label');
    const wrap = el.closest('div'); const q = wrap && wrap.parentElement ? wrap.parentElement.querySelector('label,legend,p,span') : null;
    return q ? q.innerText.trim() : '';
  };
  const out = []; const groups = {}; let n = 0;
  document.querySelectorAll('input,select,textarea').forEach((el) => {
    const type = (el.getAttribute('type') || el.tagName).toLowerCase();
    if (['hidden', 'submit', 'button', 'image', 'reset'].includes(type)) return;
    if (type !== 'file' && !visible(el)) return;
    if (type === 'radio') {
      const key = el.name; if (!groups[key]) { groups[key] = {handle: 'group:' + key, kind: 'radio', label: groupLabel(el), name: key, autocomplete: '', required: el.required, options: [], value: ''}; out.push(groups[key]); }
      groups[key].options.push(labelOf(el)); if (el.checked) groups[key].value = labelOf(el); return;
    }
    n += 1; const handle = 'f' + n; el.setAttribute('data-cp', handle);
    const kind = el.tagName === 'SELECT' ? 'select' : el.tagName === 'TEXTAREA' ? 'textarea' : type;
    const options = el.tagName === 'SELECT' ? Array.from(el.options).filter(o => o.value !== '').map(o => o.text.trim()) : [];
    out.push({handle, kind, label: labelOf(el), name: el.name || el.id || '', autocomplete: el.getAttribute('autocomplete') || '', required: el.required || el.getAttribute('aria-required') === 'true', options, value: type === 'checkbox' ? (el.checked ? 'true' : '') : (el.value || '')});
  });
  return out;
}
"""

FIELD_KINDS = {kind.value for kind in FieldKind}


def wrapped(error: PlaywrightError) -> DriverError:
    return DriverError(type(error).__name__)


class PlaywrightDriver:
    def __init__(self, page: Page, config: BrowserConfig) -> None:
        self._page = page
        self._config = config

    def open(self, url: str) -> None:
        try:
            self._page.goto(url, wait_until="domcontentloaded", timeout=self._config.navigation_timeout_seconds * MILLISECONDS)
        except PlaywrightError as error:
            raise wrapped(error) from error

    def snapshot(self, selectors: Sequence[str]) -> PageSnapshot:
        try:
            self._page.wait_for_load_state("domcontentloaded", timeout=self._config.navigation_timeout_seconds * MILLISECONDS)
            text = self._page.inner_text("body")[:MAX_BODY_CHARS]
            present = frozenset(s for s in selectors if self._count(s) > 0)
            return PageSnapshot(url=self._page.url, title=self._page.title(), text=text, present=present)
        except PlaywrightError as error:
            raise wrapped(error) from error

    def fields(self) -> list[FormField]:
        try:
            raw = cast("list[dict[str, Any]]", self._page.evaluate(COLLECT_FIELDS))
        except PlaywrightError as error:
            raise wrapped(error) from error
        return [self._field(item) for item in raw]

    @staticmethod
    def _field(item: dict[str, Any]) -> FormField:
        kind = str(item["kind"])
        return FormField(
            handle=str(item["handle"]),
            kind=FieldKind(kind) if kind in FIELD_KINDS else FieldKind.OTHER,
            label=str(item["label"]),
            name=str(item["name"]),
            autocomplete=str(item["autocomplete"]),
            required=bool(item["required"]),
            options=tuple(str(o) for o in item["options"]),
            value=str(item["value"]),
        )

    def fill(self, handle: str, value: str) -> None:
        self._act(lambda: self._element(handle).fill(value, timeout=self._timeout()))

    def choose(self, handle: str, option: str) -> None:
        if handle.startswith(GROUP_PREFIX):
            self._act(lambda: self._radio(handle.removeprefix(GROUP_PREFIX), option))
            return
        self._act(lambda: self._element(handle).select_option(label=option, timeout=self._timeout()))

    def check(self, handle: str, checked: bool) -> None:
        self._act(lambda: self._element(handle).set_checked(checked, timeout=self._timeout()))

    def upload(self, handle: str, file_name: str, content: bytes) -> None:
        payload = {"name": file_name, "mimeType": CONTENT_TYPE, "buffer": content}
        self._act(lambda: self._element(handle).set_input_files(payload, timeout=self._timeout()))

    def click_labelled(self, labels: Sequence[str]) -> bool:
        for label in labels:
            target = self._labelled(label)
            if target is not None:
                return self._click(target)
        return False

    def click_selector(self, selectors: Sequence[str]) -> bool:
        for selector in selectors:
            target = self._visible_first(selector)
            if target is not None:
                return self._click(target)
        return False

    def has_labelled(self, labels: Sequence[str]) -> bool:
        return any(self._labelled(label) is not None for label in labels)

    def has_selector(self, selectors: Sequence[str]) -> bool:
        return any(self._visible_first(selector) is not None for selector in selectors)

    def screenshot(self) -> bytes:
        try:
            return self._page.screenshot(full_page=True)
        except PlaywrightError as error:
            raise wrapped(error) from error

    def _timeout(self) -> float:
        return self._config.action_timeout_seconds * MILLISECONDS

    def _element(self, handle: str) -> Any:
        return self._page.locator(f'[{HANDLE_ATTRIBUTE}="{handle}"]')

    def _radio(self, name: str, option: str) -> None:
        for radio in self._page.locator(f'input[type=radio][name="{name}"]').all():
            label = radio.evaluate("el => (el.closest('label') ? el.closest('label').innerText : (document.querySelector('label[for=\"' + el.id + '\"]') || {}).innerText || '')")
            if str(label).strip() == option:
                radio.check(timeout=self._timeout())
                return
        raise DriverError("radio_option_missing")

    def _count(self, selector: str) -> int:
        try:
            return self._page.locator(selector).count()
        except PlaywrightError:
            return 0

    def _visible_first(self, selector: str) -> Any | None:
        try:
            matches = self._page.locator(selector)
            for index in range(min(matches.count(), 5)):
                candidate = matches.nth(index)
                if candidate.is_visible():
                    return candidate
        except PlaywrightError:
            return None
        return None

    def _labelled(self, label: str) -> Any | None:
        page = self._page
        candidates = (
            page.get_by_role("button", name=label),
            page.get_by_role("link", name=label),
            page.locator(f'input[type=submit][value*="{label}" i]'),
        )
        for candidate in candidates:
            try:
                for index in range(min(candidate.count(), 5)):
                    if candidate.nth(index).is_visible():
                        return candidate.nth(index)
            except PlaywrightError:
                continue
        return None

    def _click(self, target: Any) -> bool:
        self._act(lambda: target.click(timeout=self._timeout()))
        return True

    def _act(self, action: Any) -> None:
        try:
            action()
        except PlaywrightError as error:
            raise wrapped(error) from error


@contextmanager
def chromium_session(config: BrowserConfig) -> Iterator[PageDriver]:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=config.headless)
        try:
            context = browser.new_context(
                viewport={"width": config.viewport_width, "height": config.viewport_height},
                accept_downloads=False,
            )
            page = context.new_page()
            yield PlaywrightDriver(page, config)
        finally:
            browser.close()
