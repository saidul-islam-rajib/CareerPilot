from datetime import date

from sqlalchemy import Date, String
from sqlalchemy.orm import Mapped, Session, mapped_column

from careerpilot.government.models import Circular, GovApplication, Holiday
from careerpilot.platform.clock import Clock
from careerpilot.platform.persistence import ID_LENGTH, SHORT_TEXT, Audited, Base, Database, active


class CircularRow(Audited, Base):
    __tablename__ = "gov_circulars"

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    status: Mapped[str] = mapped_column(String(SHORT_TEXT), index=True)
    document: Mapped[dict[str, object]]


class HolidayRow(Audited, Base):
    __tablename__ = "gov_holidays"

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    on_date: Mapped[date] = mapped_column(Date, index=True)
    document: Mapped[dict[str, object]]


class GovApplicationRow(Audited, Base):
    __tablename__ = "gov_applications"

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(ID_LENGTH), index=True)
    circular_id: Mapped[str] = mapped_column(String(ID_LENGTH), index=True)
    document: Mapped[dict[str, object]]


def _json(model: Circular | Holiday | GovApplication) -> dict[str, object]:
    return model.model_dump(mode="json", by_alias=True, exclude_none=True)


class SqlCircularRepository:
    def __init__(self, database: Database, clock: Clock) -> None:
        self._db = database
        self._clock = clock

    def get(self, circular_id: str) -> Circular | None:
        with self._db.unit_of_work() as session:
            row = session.scalars(active(CircularRow).where(CircularRow.id == circular_id)).first()
            return Circular.model_validate(row.document) if row else None

    def list_all(self) -> list[Circular]:
        with self._db.unit_of_work() as session:
            return [Circular.model_validate(row.document) for row in session.scalars(active(CircularRow))]

    def save(self, circular: Circular) -> None:
        def change(session: Session) -> None:
            row = session.get(CircularRow, circular.id)
            if row is None:
                session.add(CircularRow(id=circular.id, status=circular.status.value, document=_json(circular)))
                return
            row.status = circular.status.value
            row.document = _json(circular)

        self._db.write(change)

    def remove(self, circular_id: str, reason: str) -> None:
        def change(session: Session) -> None:
            for row in session.scalars(active(CircularRow).where(CircularRow.id == circular_id)):
                row.soft_delete(self._clock, reason)

        self._db.write(change)


class SqlHolidayRepository:
    def __init__(self, database: Database, clock: Clock) -> None:
        self._db = database
        self._clock = clock

    def list_all(self) -> list[Holiday]:
        with self._db.unit_of_work() as session:
            rows = session.scalars(active(HolidayRow).order_by(HolidayRow.on_date))
            return [Holiday.model_validate(row.document) for row in rows]

    def between(self, first: date, last: date) -> list[Holiday]:
        with self._db.unit_of_work() as session:
            rows = session.scalars(active(HolidayRow).where(HolidayRow.on_date >= first, HolidayRow.on_date <= last))
            return [Holiday.model_validate(row.document) for row in rows]

    def add(self, holiday: Holiday) -> None:
        self._db.write(lambda session: session.add(HolidayRow(id=holiday.id, on_date=holiday.on, document=_json(holiday))))

    def remove(self, holiday_id: str, reason: str) -> None:
        def change(session: Session) -> None:
            for row in session.scalars(active(HolidayRow).where(HolidayRow.id == holiday_id)):
                row.soft_delete(self._clock, reason)

        self._db.write(change)


class SqlGovApplicationRepository:
    def __init__(self, database: Database, clock: Clock) -> None:
        self._db = database
        self._clock = clock

    def get(self, user_id: str, application_id: str) -> GovApplication | None:
        with self._db.unit_of_work() as session:
            query = active(GovApplicationRow).where(GovApplicationRow.id == application_id, GovApplicationRow.user_id == user_id)
            row = session.scalars(query).first()
            return GovApplication.model_validate(row.document) if row else None

    def for_user(self, user_id: str) -> list[GovApplication]:
        with self._db.unit_of_work() as session:
            rows = session.scalars(active(GovApplicationRow).where(GovApplicationRow.user_id == user_id))
            return [GovApplication.model_validate(row.document) for row in rows]

    def all_active(self) -> list[GovApplication]:
        with self._db.unit_of_work() as session:
            return [GovApplication.model_validate(row.document) for row in session.scalars(active(GovApplicationRow))]

    def save(self, application: GovApplication) -> None:
        def change(session: Session) -> None:
            row = session.get(GovApplicationRow, application.id)
            if row is None:
                session.add(
                    GovApplicationRow(
                        id=application.id,
                        user_id=application.user_id,
                        circular_id=application.circular_id,
                        document=_json(application),
                    )
                )
                return
            row.document = _json(application)

        self._db.write(change)

    def remove(self, user_id: str, application_id: str, reason: str) -> None:
        def change(session: Session) -> None:
            query = active(GovApplicationRow).where(GovApplicationRow.id == application_id, GovApplicationRow.user_id == user_id)
            for row in session.scalars(query):
                row.soft_delete(self._clock, reason)

        self._db.write(change)
