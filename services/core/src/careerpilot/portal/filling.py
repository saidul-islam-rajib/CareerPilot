from dataclasses import dataclass

from careerpilot.portal.driver import FormField, PageDriver
from careerpilot.portal.enums import FieldKind, FieldSource, FieldStatus
from careerpilot.portal.models import FieldPlan

TRUE_VALUE = "true"
FILLED = frozenset({FieldStatus.MAPPED, FieldStatus.CORRECTED})
CLEARED = frozenset({FieldStatus.SKIPPED})
CLEARABLE = frozenset({FieldKind.TEXT, FieldKind.EMAIL, FieldKind.TEL, FieldKind.TEXTAREA, FieldKind.NUMBER})


@dataclass(frozen=True)
class FillMaterials:
    cv_name: str = ""
    cv_content: bytes = b""
    password: str = ""


def apply_plans(driver: PageDriver, fields: list[FormField], plans: list[FieldPlan], materials: FillMaterials) -> None:
    by_handle = {f.handle: f for f in fields}
    for plan in plans:
        field_ = by_handle.get(plan.handle)
        if field_ is None:
            continue
        if plan.status in CLEARED:
            clear(driver, field_)
        elif plan.status in FILLED:
            write(driver, field_, plan, materials)


def clear(driver: PageDriver, field_: FormField) -> None:
    if field_.kind in CLEARABLE and field_.value:
        driver.fill(field_.handle, "")


def write(driver: PageDriver, field_: FormField, plan: FieldPlan, materials: FillMaterials) -> None:
    if field_.kind is FieldKind.FILE:
        driver.upload(field_.handle, materials.cv_name, materials.cv_content)
    elif field_.kind in {FieldKind.SELECT, FieldKind.RADIO}:
        driver.choose(field_.handle, plan.value)
    elif field_.kind is FieldKind.CHECKBOX:
        driver.check(field_.handle, plan.value == TRUE_VALUE)
    elif plan.source is FieldSource.ACCOUNT and field_.kind is FieldKind.PASSWORD:
        driver.fill(field_.handle, materials.password)
    else:
        driver.fill(field_.handle, plan.value)
