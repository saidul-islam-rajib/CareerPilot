from typing import Annotated

from fastapi import APIRouter, File, Request, UploadFile
from fastapi.responses import JSONResponse, Response

from careerpilot.api.common import no_content, ok
from careerpilot.api.dependencies import CurrentUser, Services
from careerpilot.api.profile_routes import read_upload
from careerpilot.bootstrap import Container
from careerpilot.fees.models import ActionBody, FeeRuleInput, PaymentInput, PaymentView, ReceiptInput
from careerpilot.fees.receipt_files import ReceiptUpload

router = APIRouter(prefix="/v1/fees")
UploadedFile = Annotated[UploadFile, File()]


def linked(view: PaymentView, request: Request, services: Container) -> PaymentView:
    base_url = str(request.base_url)
    receipts = [
        receipt.model_copy(update={"url": services.file_links.link(base_url, receipt.file.key, receipt.file.file_name)})
        if receipt.file is not None
        else receipt
        for receipt in view.payment.receipts
    ]
    return view.model_copy(update={"payment": view.payment.model_copy(update={"receipts": receipts})})


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


@router.post("/payments/{payment_id}/receipt-files")
def add_receipt_file(payment_id: str, file: UploadedFile, request: Request, user: CurrentUser, services: Services) -> JSONResponse:
    limit = services.settings.fees.receipt_files.max_bytes
    upload = read_upload(file, limit)
    view = services.fees.receipt_files.add(user.id, payment_id, ReceiptUpload(upload.file_name, upload.data))
    return ok(linked(view, request, services))


@router.post("/rules/from-opportunity/{opportunity_id}")
def rule_from_opportunity(opportunity_id: str, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.fees.sources.from_opportunity(user.id, opportunity_id))


@router.post("/rules/from-program/{program_id}")
def rule_from_program(program_id: str, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.fees.sources.from_program(user.id, program_id))
