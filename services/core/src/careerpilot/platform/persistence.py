from collections.abc import Generator
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from datetime import datetime
from typing import Any, ClassVar, TypeVar

from sqlalchemy import JSON, DateTime, Integer, Select, String, event, select
from sqlalchemy.engine import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker
from sqlalchemy.pool import StaticPool

from careerpilot.platform.clock import Clock
from careerpilot.platform.enums import ActorType

ID_LENGTH = 64
SHORT_TEXT = 32
TEXT = 320
DEFAULT_TENANT = "default"
SYSTEM_ACTOR = "system"
FIRST_VERSION = 1
SQLITE_MEMORY_URL = "sqlite+pysqlite:///:memory:"


@dataclass(frozen=True)
class Actor:
    actor_id: str
    actor_type: ActorType


SYSTEM = Actor(SYSTEM_ACTOR, ActorType.SYSTEM)
current_actor: ContextVar[Actor] = ContextVar("current_actor", default=SYSTEM)


@contextmanager
def acting_as(actor: Actor) -> Generator[None]:
    token = current_actor.set(actor)
    try:
        yield
    finally:
        current_actor.reset(token)


class Base(DeclarativeBase):
    type_annotation_map: ClassVar[dict[Any, Any]] = {dict[str, object]: JSON, datetime: DateTime(timezone=True)}


class Audited:
    tenant_id: Mapped[str] = mapped_column(String(ID_LENGTH), default=DEFAULT_TENANT)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[str] = mapped_column(String(ID_LENGTH))
    created_by_type: Mapped[str] = mapped_column(String(SHORT_TEXT))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_by: Mapped[str] = mapped_column(String(ID_LENGTH))
    updated_by_type: Mapped[str] = mapped_column(String(SHORT_TEXT))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    deleted_by: Mapped[str | None] = mapped_column(String(ID_LENGTH), default=None)
    deleted_by_type: Mapped[str | None] = mapped_column(String(SHORT_TEXT), default=None)
    delete_reason: Mapped[str | None] = mapped_column(String(TEXT), default=None)
    version: Mapped[int] = mapped_column(Integer, default=FIRST_VERSION)

    def soft_delete(self, clock: Clock, reason: str) -> None:
        actor = current_actor.get()
        self.deleted_at = clock.now()
        self.deleted_by = actor.actor_id
        self.deleted_by_type = actor.actor_type.value
        self.delete_reason = reason

    def restore(self) -> None:
        self.deleted_at = None
        self.deleted_by = None
        self.deleted_by_type = None
        self.delete_reason = None


class PhysicalDeleteError(RuntimeError):
    pass


def install_audit_listeners(session_factory: sessionmaker[Session], clock: Clock) -> None:
    @event.listens_for(session_factory, "before_flush")
    def stamp(session: Session, _context: object, _instances: object) -> None:
        if session.deleted:
            raise PhysicalDeleteError
        actor = current_actor.get()
        now = clock.now()
        for instance in session.new:
            if isinstance(instance, Audited):
                instance.created_at = now
                instance.created_by = actor.actor_id
                instance.created_by_type = actor.actor_type.value
                instance.updated_at = now
                instance.updated_by = actor.actor_id
                instance.updated_by_type = actor.actor_type.value
                instance.version = FIRST_VERSION
        for instance in session.dirty:
            if isinstance(instance, Audited) and session.is_modified(instance):
                instance.updated_at = now
                instance.updated_by = actor.actor_id
                instance.updated_by_type = actor.actor_type.value
                instance.version = (instance.version or FIRST_VERSION) + 1


@dataclass(frozen=True)
class Database:
    engine: Engine
    sessions: sessionmaker[Session]

    @contextmanager
    def unit_of_work(self) -> Generator[Session]:
        with self.sessions() as session, session.begin():
            yield session


def create_database(url: str, clock: Clock) -> Database:
    options: dict[str, object] = {"poolclass": StaticPool, "connect_args": {"check_same_thread": False}} if url == SQLITE_MEMORY_URL else {}
    engine = create_engine(url, **options)  # pyright: ignore[reportArgumentType]
    sessions = sessionmaker(engine, expire_on_commit=False)
    install_audit_listeners(sessions, clock)
    return Database(engine, sessions)


ModelT = TypeVar("ModelT", bound=Audited)


def active(model: type[ModelT]) -> Select[tuple[ModelT]]:
    return select(model).where(model.deleted_at.is_(None))
