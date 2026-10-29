import threading
from dataclasses import dataclass
from datetime import datetime, timedelta

from careerpilot.administration.models import UserPresence, UserSession
from careerpilot.administration.ports import Directory
from careerpilot.candidate.services.auth import ClientInfo
from careerpilot.platform.clock import Clock, iso, parse_iso
from careerpilot.platform.config import PresenceConfig


@dataclass(frozen=True)
class PresenceContext:
    directory: Directory
    clock: Clock
    config: PresenceConfig


def seconds_between(earlier: str, later: datetime) -> int:
    return max(0, int((later - parse_iso(earlier)).total_seconds()))


class PresenceService:
    def __init__(self, context: PresenceContext) -> None:
        self._directory = context.directory
        self._clock = context.clock
        self._config = context.config
        self._written: dict[str, datetime] = {}
        self._lock = threading.Lock()

    def started(self, user_id: str, session_id: str, client: ClientInfo) -> None:
        now = self._clock.now()
        self._remember(session_id, now)
        self._directory.save_session(
            UserSession(
                id=session_id,
                user_id=user_id,
                started_at=iso(now),
                last_seen_at=iso(now),
                ip=client.ip,
                device=client.device,
                approximate_location=client.approximate_location,
            )
        )
        self._archive_oldest(user_id)

    def touch(self, user_id: str, session_id: str, client: ClientInfo) -> None:
        now = self._clock.now()
        if not self._due(session_id, now):
            return
        session = self._directory.session(session_id)
        if session is None or session.user_id != user_id:
            self.started(user_id, session_id, client)
            return
        gap = seconds_between(session.last_seen_at, now)
        counted = gap if gap <= self._config.idle_minutes * 60 else 0
        self._directory.save_session(
            session.model_copy(
                update={
                    "last_seen_at": iso(now),
                    "active_seconds": session.active_seconds + counted,
                    "ip": client.ip or session.ip,
                    "device": client.device or session.device,
                    "approximate_location": client.approximate_location or session.approximate_location,
                    "signed_out_at": None,
                }
            )
        )

    def ended(self, user_id: str, session_id: str) -> None:
        session = self._directory.session(session_id)
        if session is not None and session.user_id == user_id:
            now = self._clock.now()
            self._directory.save_session(session.model_copy(update={"signed_out_at": iso(now), "last_seen_at": iso(now)}))
        with self._lock:
            self._written.pop(session_id, None)

    def sessions_of(self, user_id: str) -> list[UserSession]:
        mine = [session for session in self._directory.sessions() if session.user_id == user_id and session.archived_at is None]
        return sorted(mine, key=lambda session: session.last_seen_at, reverse=True)

    def presence_of(self, user_id: str) -> UserPresence:
        return self.summarize(self.sessions_of(user_id))

    def everyone(self) -> dict[str, UserPresence]:
        grouped: dict[str, list[UserSession]] = {}
        for session in self._directory.sessions():
            if session.archived_at is None:
                grouped.setdefault(session.user_id, []).append(session)
        return {user_id: self.summarize(sorted(found, key=lambda s: s.last_seen_at, reverse=True)) for user_id, found in grouped.items()}

    def summarize(self, sessions: list[UserSession]) -> UserPresence:
        if not sessions:
            return UserPresence()
        latest = sessions[0]
        online_since = self._clock.now() - timedelta(minutes=self._config.online_minutes)
        online = any(s.signed_out_at is None and parse_iso(s.last_seen_at) >= online_since for s in sessions)
        return UserPresence(
            online=online,
            last_seen_at=latest.last_seen_at,
            active_seconds=sum(session.active_seconds for session in sessions),
            sessions_count=len(sessions),
            location=latest.approximate_location,
            device=latest.device,
        )

    def _due(self, session_id: str, now: datetime) -> bool:
        with self._lock:
            last = self._written.get(session_id)
            if last is not None and (now - last).total_seconds() < self._config.touch_interval_seconds:
                return False
            self._written[session_id] = now
            return True

    def _remember(self, session_id: str, now: datetime) -> None:
        with self._lock:
            self._written[session_id] = now

    def _archive_oldest(self, user_id: str) -> None:
        sessions = self.sessions_of(user_id)
        for session in sessions[self._config.max_sessions_per_user :]:
            self._directory.save_session(session.model_copy(update={"archived_at": iso(self._clock.now())}))
