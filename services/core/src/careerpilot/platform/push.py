import logging
from collections.abc import Callable
from concurrent.futures import Executor
from dataclasses import dataclass, field
from typing import Any, Protocol, cast

import httpx

from careerpilot.platform.config import PushConfig
from careerpilot.platform.email_delivery import report_crash

logger = logging.getLogger(__name__)

TICKET_ERROR = "error"
JSON_HEADERS = {"Accept": "application/json", "Content-Type": "application/json"}
SOUND = "default"
PRIORITY = "high"


@dataclass(frozen=True)
class PushMessage:
    to: list[str]
    title: str
    body: str
    data: dict[str, str] = field(default_factory=dict[str, str])


class PushSender(Protocol):
    def send(self, message: PushMessage) -> list[str]: ...


OnUnregistered = Callable[[list[str]], None]
Post = Callable[[str, list[dict[str, Any]], float], Any]


class InMemoryPushSender:
    def __init__(self, unregistered: frozenset[str] = frozenset()) -> None:
        self.sent: list[PushMessage] = []
        self._unregistered = unregistered

    def send(self, message: PushMessage) -> list[str]:
        self.sent.append(message)
        return [token for token in message.to if token in self._unregistered]


class NoPushSender:
    def send(self, message: PushMessage) -> list[str]:
        return []


def http_post(url: str, payload: list[dict[str, Any]], timeout: float) -> Any:
    response = httpx.post(url, json=payload, headers=JSON_HEADERS, timeout=timeout)
    response.raise_for_status()
    return response.json()


class ExpoPushSender:
    def __init__(self, config: PushConfig, post: Post = http_post) -> None:
        self._config = config
        self._post = post
        self._unregistered = frozenset(config.unregistered_errors)

    def send(self, message: PushMessage) -> list[str]:
        gone: list[str] = []
        for start in range(0, len(message.to), self._config.batch_size):
            tokens = message.to[start : start + self._config.batch_size]
            reply = self._post(self._config.endpoint, [self._payload(token, message) for token in tokens], self._config.timeout_seconds)
            gone.extend(self._unregistered_tokens(tokens, reply))
        return gone

    def _payload(self, token: str, message: PushMessage) -> dict[str, Any]:
        return {
            "to": token,
            "title": message.title,
            "body": message.body,
            "data": message.data,
            "sound": SOUND,
            "priority": PRIORITY,
            "channelId": self._config.channel_id,
        }

    def _unregistered_tokens(self, tokens: list[str], reply: Any) -> list[str]:
        body = cast("dict[str, Any]", reply) if isinstance(reply, dict) else {}
        tickets = cast("list[dict[str, Any]]", body.get("data", []))
        gone: list[str] = []
        for token, ticket in zip(tokens, tickets, strict=False):
            if ticket.get("status") != TICKET_ERROR:
                continue
            details = cast("dict[str, Any]", ticket.get("details") or {})
            reason = str(details.get("error", ""))
            logger.warning("push_not_accepted", extra={"reason": reason})
            if reason in self._unregistered:
                gone.append(token)
        return gone


class PushDispatcher(Protocol):
    def dispatch(self, message: PushMessage, on_unregistered: OnUnregistered) -> None: ...


class DirectPush:
    def __init__(self, sender: PushSender) -> None:
        self._sender = sender

    def dispatch(self, message: PushMessage, on_unregistered: OnUnregistered) -> None:
        gone = self._sender.send(message)
        if gone:
            on_unregistered(gone)


class BackgroundPush:
    def __init__(self, sender: PushSender, runner: Executor) -> None:
        self._sender = sender
        self._runner = runner

    def dispatch(self, message: PushMessage, on_unregistered: OnUnregistered) -> None:
        self._runner.submit(self._deliver, message, on_unregistered).add_done_callback(report_crash)

    def _deliver(self, message: PushMessage, on_unregistered: OnUnregistered) -> None:
        try:
            gone = self._sender.send(message)
        except httpx.HTTPError as error:
            logger.warning("push_not_sent", extra={"reason": type(error).__name__})
            return
        if gone:
            on_unregistered(gone)
