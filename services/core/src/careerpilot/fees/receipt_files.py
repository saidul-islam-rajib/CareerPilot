import hashlib
from dataclasses import dataclass

from careerpilot.candidate.models import StoredFile
from careerpilot.fees.context import RECEIPT_PREFIX, FeesContext, Stores
from careerpilot.fees.enums import Failure, ReceiptKind
from careerpilot.fees.models import PaymentView, Receipt
from careerpilot.fees.payments import PaymentService
from careerpilot.platform.clock import iso
from careerpilot.platform.errors import validation_error
from careerpilot.platform.files import EXTENSIONS, detect_content_type

FILE_PREFIX = "fef"


@dataclass(frozen=True)
class ReceiptUpload:
    file_name: str
    data: bytes


class ReceiptFileService:
    def __init__(self, context: FeesContext, stores: Stores, payments: PaymentService) -> None:
        self._ctx = context
        self._stores = stores
        self._payments = payments

    def add(self, user_id: str, payment_id: str, upload: ReceiptUpload) -> PaymentView:
        settings = self._ctx.config.receipt_files
        payment = self._stores.payments.find(user_id, payment_id)
        if len(payment.receipts) >= self._ctx.config.max_receipts_per_payment:
            raise validation_error(Failure.TOO_MANY_ITEMS.value)
        if not upload.data:
            raise validation_error(Failure.FILE_EMPTY.value)
        if len(upload.data) > settings.max_bytes:
            raise validation_error(Failure.FILE_TOO_LARGE.value)
        content_type = detect_content_type(upload.data)
        if content_type is None or content_type not in settings.types:
            raise validation_error(Failure.FILE_TYPE.value)
        now = iso(self._ctx.clock.now())
        key = f"{settings.folder}/{user_id}/{payment_id}/{self._ctx.ids.next(FILE_PREFIX).lower()}.{EXTENSIONS[content_type]}"
        self._ctx.storage.put(key, upload.data)
        name = upload.file_name.strip()[: settings.max_name_chars] or key.rsplit("/", 1)[-1]
        payment.receipts.append(
            Receipt(
                id=self._ctx.ids.next(RECEIPT_PREFIX),
                added_at=now,
                kind=ReceiptKind.UPLOADED_FILE,
                reference=name,
                file=StoredFile(key=key, file_name=name, content_type=content_type, size_bytes=len(upload.data), uploaded_at=now),
                sha256=hashlib.sha256(upload.data).hexdigest(),
            )
        )
        self._stores.payments.save(user_id, payment_id, payment)
        return self._payments.get(user_id, payment_id)
