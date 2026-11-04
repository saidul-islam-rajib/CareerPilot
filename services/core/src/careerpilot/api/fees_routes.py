from fastapi import APIRouter
from fastapi.responses import JSONResponse, Response

from careerpilot.api.common import no_content, ok
from careerpilot.api.dependencies import CurrentUser, Services
from careerpilot.fees.models import ActionBody, FeeRuleInput, PaymentInput, ReceiptInput

router = APIRouter(prefix="/v1/fees")


@router.get("/reference")
def reference(_: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.fees.reference)


@router.get("/overview")
def overview(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.fees.overview.build(user.id))


@router.get("/rules")
def list_rules(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.fees.rules.items(user.id))


@router.post("/rules")
def create_rule(body: FeeRuleInput, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.fees.rules.create(user.id, body))


@router.put("/rules/{rule_id}")
def update_rule(rule_id: str, body: FeeRuleInput, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.fees.rules.update(user.id, rule_id, body))


@router.delete("/rules/{rule_id}")
def delete_rule(rule_id: str, user: CurrentUser, services: Services) -> Response:
    services.fees.rules.remove(user.id, rule_id)
    return no_content()


@router.post("/rules/{rule_id}/payments")
def payment_from_rule(rule_id: str, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.fees.payments.from_rule(user.id, rule_id))


@router.get("/payments")
def list_payments(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.fees.payments.items(user.id))


@router.post("/payments")
def create_payment(body: PaymentInput, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.fees.payments.create(user.id, body))


@router.get("/payments/{payment_id}")
def get_payment(payment_id: str, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.fees.payments.get(user.id, payment_id))


@router.put("/payments/{payment_id}")
def update_payment(payment_id: str, body: PaymentInput, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.fees.payments.update(user.id, payment_id, body))


@router.delete("/payments/{payment_id}")
def delete_payment(payment_id: str, user: CurrentUser, services: Services) -> Response:
    services.fees.payments.remove(user.id, payment_id)
    return no_content()


@router.post("/payments/{payment_id}/actions")
def payment_action(payment_id: str, body: ActionBody, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.fees.payments.act(user.id, payment_id, body))


@router.post("/payments/{payment_id}/receipts")
def add_receipt(payment_id: str, body: ReceiptInput, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.fees.payments.add_receipt(user.id, payment_id, body))


@router.delete("/payments/{payment_id}/receipts/{receipt_id}")
def remove_receipt(payment_id: str, receipt_id: str, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.fees.payments.remove_receipt(user.id, payment_id, receipt_id))
