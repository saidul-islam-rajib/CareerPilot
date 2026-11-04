import os

import anthropic

from careerpilot.candidate.context import CandidateContext
from careerpilot.candidate.services.opportunities import OpportunityService
from careerpilot.matching.skills import SkillCatalog
from careerpilot.platform.messages import translate
from careerpilot.repositories import Repositories
from careerpilot.writing.adapters.anthropic_writer import AnthropicWriter
from careerpilot.writing.adapters.template import HEADINGS, TemplateWriter
from careerpilot.writing.checks import WritingChecker
from careerpilot.writing.config import WritingConfig
from careerpilot.writing.enums import WritingMode
from careerpilot.writing.facts import words_of
from careerpilot.writing.ports import DraftGenerator
from careerpilot.writing.service import WritingContext, WritingService

SUMMARY_HEADING = "summary"
SKILLS_HEADING = "skills"


def heading_words(config: WritingConfig) -> frozenset[str]:
    keys = [SUMMARY_HEADING, SKILLS_HEADING, *(section.heading for section in config.template.cv_sections)]
    words: set[str] = set()
    for key in keys:
        words |= words_of(translate(f"{HEADINGS}.{key}"))
    return frozenset(words)


def ai_writer(config: WritingConfig, override: DraftGenerator | None) -> DraftGenerator | None:
    if override is not None:
        return override
    api_key = os.environ.get(config.api_key_env)
    if config.mode is WritingMode.AUTO and api_key:
        return AnthropicWriter(config, anthropic.Anthropic(api_key=api_key))
    return None


def build_writing(
    candidate: CandidateContext, repos: Repositories, opportunities: OpportunityService, ai: DraftGenerator | None
) -> WritingService:
    config = candidate.settings.writing
    checker = WritingChecker(config, SkillCatalog(candidate.settings.matching.skill_gap), heading_words(config))
    return WritingService(
        WritingContext(
            candidate=candidate,
            drafts=repos.writing_drafts,
            opportunities=opportunities,
            template=TemplateWriter(config),
            checker=checker,
            ai=ai_writer(config, ai),
        )
    )
