from pydantic import BaseModel, ConfigDict, Field

from careerpilot.automation.enums import DeadlineAction


class AutomationConfig(BaseModel):
    model_config = ConfigDict(extra="ignore", frozen=True)

    max_rules: int = Field(gt=0)
    max_list_items: int = Field(gt=0)
    max_item_length: int = Field(gt=0)
    max_skip_records: int = Field(gt=0)
    dry_run_limit: int = Field(gt=0)
    window_lookahead_days: int = Field(gt=0)
    default_min_match_score: int = Field(ge=0, le=100)
    default_deadline_buffer_hours: int = Field(ge=0)
    max_deadline_buffer_hours: int = Field(gt=0)
    default_deadline_action: DeadlineAction
    default_inactivity_days: int = Field(gt=0)
    min_inactivity_days: int = Field(gt=0)
    max_inactivity_days: int = Field(gt=0)
    default_weekly_cap: int = Field(gt=0)
    max_weekly_cap: int = Field(gt=0)
    max_daily_cap: int = Field(gt=0)
    max_total_cap: int = Field(gt=0)
    user_only_steps: list[str]
