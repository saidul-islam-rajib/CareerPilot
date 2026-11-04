from datetime import date

from careerpilot.government.models import Circular, GovApplication, Holiday


class InMemoryCircularRepository:
    def __init__(self) -> None:
        self._items: dict[str, Circular] = {}

    def get(self, circular_id: str) -> Circular | None:
        found = self._items.get(circular_id)
        return found.model_copy(deep=True) if found else None

    def list_all(self) -> list[Circular]:
        return [item.model_copy(deep=True) for item in self._items.values()]

    def save(self, circular: Circular) -> None:
        self._items[circular.id] = circular.model_copy(deep=True)

    def remove(self, circular_id: str, reason: str) -> None:
        self._items.pop(circular_id, None)


class InMemoryHolidayRepository:
    def __init__(self) -> None:
        self._items: dict[str, Holiday] = {}

    def list_all(self) -> list[Holiday]:
        return sorted((h.model_copy() for h in self._items.values()), key=lambda h: h.on)

    def between(self, first: date, last: date) -> list[Holiday]:
        return [h for h in self.list_all() if first <= h.on <= last]

    def add(self, holiday: Holiday) -> None:
        self._items[holiday.id] = holiday.model_copy()

    def remove(self, holiday_id: str, reason: str) -> None:
        self._items.pop(holiday_id, None)


class InMemoryGovApplicationRepository:
    def __init__(self) -> None:
        self._items: dict[str, GovApplication] = {}

    def get(self, user_id: str, application_id: str) -> GovApplication | None:
        found = self._items.get(application_id)
        return found.model_copy(deep=True) if found and found.user_id == user_id else None

    def for_user(self, user_id: str) -> list[GovApplication]:
        return [a.model_copy(deep=True) for a in self._items.values() if a.user_id == user_id]

    def all_active(self) -> list[GovApplication]:
        return [a.model_copy(deep=True) for a in self._items.values()]

    def save(self, application: GovApplication) -> None:
        self._items[application.id] = application.model_copy(deep=True)

    def remove(self, user_id: str, application_id: str, reason: str) -> None:
        found = self._items.get(application_id)
        if found and found.user_id == user_id:
            del self._items[application_id]
