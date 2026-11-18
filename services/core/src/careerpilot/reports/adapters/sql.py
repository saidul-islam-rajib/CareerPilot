from sqlalchemy import Select, String
from sqlalchemy.orm import Mapped, Session, mapped_column

from careerpilot.platform.persistence import ID_LENGTH, SHORT_TEXT, Audited, Base, Database, active
from careerpilot.reports.enums import ReportStatus
from careerpilot.reports.models import OpportunityReport


class OpportunityReportRow(Audited, Base):
    __tablename__ = "opportunity_reports"

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(ID_LENGTH), index=True)
    opportunity_id: Mapped[str] = mapped_column(String(ID_LENGTH), index=True)
    status: Mapped[str] = mapped_column(String(SHORT_TEXT), index=True)
    document: Mapped[dict[str, object]]


class SqlReports:
    def __init__(self, database: Database) -> None:
        self._db = database

    @staticmethod
    def _all() -> Select[tuple[OpportunityReportRow]]:
        return active(OpportunityReportRow)

    def add(self, report: OpportunityReport) -> None:
        row = OpportunityReportRow(
            id=report.id,
            user_id=report.user_id,
            opportunity_id=report.opportunity_id,
            status=report.status.value,
            document=report.to_json(),
        )
        self._db.write(lambda session: session.add(row))

    def get(self, report_id: str) -> OpportunityReport | None:
        with self._db.unit_of_work() as session:
            row = session.scalars(self._all().where(OpportunityReportRow.id == report_id)).first()
            return OpportunityReport.model_validate(row.document) if row else None

    def save(self, report: OpportunityReport) -> None:
        def change(session: Session) -> None:
            row = session.scalars(self._all().where(OpportunityReportRow.id == report.id)).first()
            if row is not None:
                row.status = report.status.value
                row.document = report.to_json()

        self._db.write(change)

    def for_user(self, user_id: str) -> list[OpportunityReport]:
        query = self._all().where(OpportunityReportRow.user_id == user_id).order_by(OpportunityReportRow.created_at)
        with self._db.unit_of_work() as session:
            return [OpportunityReport.model_validate(row.document) for row in session.scalars(query)]

    def with_status(self, status: ReportStatus | None) -> list[OpportunityReport]:
        query = self._all().order_by(OpportunityReportRow.created_at.desc())
        if status is not None:
            query = query.where(OpportunityReportRow.status == status.value)
        with self._db.unit_of_work() as session:
            return [OpportunityReport.model_validate(row.document) for row in session.scalars(query)]
