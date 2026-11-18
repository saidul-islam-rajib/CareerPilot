from pydantic import BaseModel, ConfigDict, Field


class ReportsConfig(BaseModel):
    model_config = ConfigDict(extra="ignore", frozen=True)

    max_note_length: int = Field(gt=0)
    max_open_per_user: int = Field(gt=0)
