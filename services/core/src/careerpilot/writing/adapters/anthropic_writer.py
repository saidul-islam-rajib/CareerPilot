import logging
from collections.abc import Sequence
from pathlib import Path
from typing import Any, Protocol

import anthropic
from anthropic.types import OutputConfigParam, ThinkingConfigAdaptiveParam

from careerpilot.candidate.models import OpportunityDetail
from careerpilot.platform.config import repository_root
from careerpilot.writing.config import KindConfig, WritingConfig
from careerpilot.writing.enums import DraftSource, WritingKind
from careerpilot.writing.facts import facts_block
from careerpilot.writing.models import Generated, WritingRequest
from careerpilot.writing.ports import GenerationRefusedError, GenerationUnavailableError

REFUSAL = "refusal"
TEXT_BLOCK = "text"
USER_ROLE = "user"
NOT_STATED = "not stated"
LINE = "\n"
TEXT_JOIN = ""
logger = logging.getLogger(__name__)


class StreamedMessage(Protocol):
    @property
    def stop_reason(self) -> str | None: ...

    @property
    def content(self) -> Sequence[Any]: ...


def opportunity_block(opportunity: OpportunityDetail) -> str:
    return LINE.join(
        [
            f"Title: {opportunity.title}",
            f"Organization: {opportunity.organization}",
            f"Location: {opportunity.location or NOT_STATED}",
            f"Deadline: {opportunity.deadline or NOT_STATED}",
            f"Description: {opportunity.description}",
        ]
    )


def message_text(message: StreamedMessage) -> str:
    blocks = [block.text for block in message.content if getattr(block, "type", None) == TEXT_BLOCK]
    return TEXT_JOIN.join(blocks).strip()


class AnthropicWriter:
    def __init__(self, config: WritingConfig, client: anthropic.Anthropic) -> None:
        self._config = config
        self._client = client
        self._prompt = (repository_root() / Path(config.prompt_file)).read_text(encoding="utf-8")

    @property
    def model(self) -> str | None:
        return self._config.kind_rule(WritingKind.COVER_LETTER).model

    def supports(self, kind: WritingKind) -> bool:
        return any(rule.kind is kind for rule in self._config.kinds)

    def build_prompt(self, request: WritingRequest, rule: KindConfig) -> str:
        values = {
            "{kind}": request.kind.value,
            "{guidance}": rule.guidance,
            "{tone}": request.tone.value,
            "{max_words}": str(request.max_words),
            "{facts}": facts_block(request.facts),
            "{opportunity}": opportunity_block(request.opportunity),
            "{instructions}": request.instructions or NOT_STATED,
        }
        prompt = self._prompt
        for token, value in values.items():
            prompt = prompt.replace(token, value)
        return prompt

    def generate(self, request: WritingRequest) -> Generated:
        rule = self._config.kind_rule(request.kind)
        prompt = self.build_prompt(request, rule)
        try:
            message = self._stream(rule, prompt)
        except anthropic.RateLimitError as error:
            logger.warning("writing_rate_limited")
            raise GenerationUnavailableError from error
        except anthropic.APIStatusError as error:
            logger.warning("writing_api_error", extra={"status": error.status_code})
            raise GenerationUnavailableError from error
        except anthropic.APIConnectionError as error:
            logger.warning("writing_unreachable")
            raise GenerationUnavailableError from error
        if message.stop_reason == REFUSAL:
            raise GenerationRefusedError
        text = message_text(message)
        if not text:
            raise GenerationUnavailableError
        return Generated(text=text, source=DraftSource.AI, model=rule.model)

    def _stream(self, rule: KindConfig, prompt: str) -> StreamedMessage:
        thinking = ThinkingConfigAdaptiveParam(type="adaptive") if rule.adaptive_thinking else anthropic.omit
        with self._client.messages.stream(
            model=rule.model,
            max_tokens=rule.max_tokens,
            output_config=OutputConfigParam(effort=rule.effort),
            messages=[{"role": USER_ROLE, "content": prompt}],
            thinking=thinking,
        ) as stream:
            return stream.get_final_message()
