from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from careerpilot.discovery.models import Listing
from careerpilot.platform.persistence import ID_LENGTH, SHORT_TEXT, Audited, Base, Database, active

URL_LENGTH = 2048


class DiscoveredListingRow(Audited, Base):
    __tablename__ = "discovered_listings"

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    fingerprint: Mapped[str] = mapped_column(String(ID_LENGTH), index=True)
    status: Mapped[str] = mapped_column(String(SHORT_TEXT), index=True)
    document: Mapped[dict[str, object]]


class ListingSourceUrlRow(Audited, Base):
    __tablename__ = "discovered_listing_urls"

    url: Mapped[str] = mapped_column(String(URL_LENGTH), primary_key=True)
    listing_id: Mapped[str] = mapped_column(String(ID_LENGTH), ForeignKey("discovered_listings.id"), index=True)


class SqlListingCatalog:
    def __init__(self, database: Database) -> None:
        self._db = database

    def find_by_url(self, url: str) -> Listing | None:
        with self._db.unit_of_work() as session:
            link = session.scalars(active(ListingSourceUrlRow).where(ListingSourceUrlRow.url == url)).first()
            row = session.get(DiscoveredListingRow, link.listing_id) if link else None
            return Listing.model_validate(row.document) if row and row.deleted_at is None else None

    def find_by_fingerprint(self, fingerprint: str) -> Listing | None:
        with self._db.unit_of_work() as session:
            row = session.scalars(active(DiscoveredListingRow).where(DiscoveredListingRow.fingerprint == fingerprint)).first()
            return Listing.model_validate(row.document) if row else None

    def save(self, listing: Listing) -> None:
        document = listing.to_json()
        with self._db.unit_of_work() as session:
            row = session.get(DiscoveredListingRow, listing.id)
            if row is None:
                session.add(
                    DiscoveredListingRow(id=listing.id, fingerprint=listing.fingerprint, status=listing.status.value, document=document)
                )
            else:
                row.status = listing.status.value
                row.document = document
            known = {u.url for u in session.scalars(active(ListingSourceUrlRow).where(ListingSourceUrlRow.listing_id == listing.id))}
            session.add_all(ListingSourceUrlRow(url=s.url, listing_id=listing.id) for s in listing.sources if s.url not in known)

    def list_all(self) -> list[Listing]:
        with self._db.unit_of_work() as session:
            return [Listing.model_validate(r.document) for r in session.scalars(active(DiscoveredListingRow))]
