from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, use_enum_values=False, extra="ignore")

    def to_json(self) -> dict[str, object]:
        return self.model_dump(mode="json", by_alias=True, exclude_none=True)
