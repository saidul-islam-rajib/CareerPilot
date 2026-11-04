from fastapi import APIRouter
from fastapi.responses import JSONResponse, Response

from careerpilot.api.common import no_content, ok
from careerpilot.api.dependencies import CurrentUser, Services
from careerpilot.automation.models import RuleInput, SettingsInput
from careerpilot.platform.model import CamelModel

router = APIRouter(prefix="/v1/automation")


class OrderBody(CamelModel):
    rule_ids: list[str]


class DryRunBody(CamelModel):
    rule_id: str | None = None


@router.get("")
def overview(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.automation.overview(user.id))


@router.post("/rules")
def create_rule(body: RuleInput, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.automation.create_rule(user.id, body))


@router.put("/rules/order")
def reorder_rules(body: OrderBody, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.automation.reorder(user.id, body.rule_ids))


@router.put("/rules/{rule_id}")
def update_rule(rule_id: str, body: RuleInput, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.automation.update_rule(user.id, rule_id, body))


@router.delete("/rules/{rule_id}")
def delete_rule(rule_id: str, user: CurrentUser, services: Services) -> Response:
    services.automation.delete_rule(user.id, rule_id)
    return no_content()


@router.put("/settings")
def update_settings(body: SettingsInput, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.automation.update_settings(user.id, body))


@router.post("/dry-run")
def dry_run(body: DryRunBody, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.automation.dry_run(user.id, body.rule_id))
