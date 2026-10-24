from careerpilot.candidate.context import CandidateContext
from careerpilot.candidate.models import Profile
from careerpilot.platform.errors import not_found, validation_error


class ProfileService:
    def __init__(self, context: CandidateContext) -> None:
        self._ctx = context

    def get(self, user_id: str) -> Profile:
        return self._ctx.workspaces.get(user_id).profile

    def reorder_contacts(self, user_id: str, ordered_ids: list[str]) -> Profile:
        workspace = self._ctx.workspaces.get(user_id)
        by_id = {c.id: c for c in workspace.profile.contacts}
        if sorted(ordered_ids) != sorted(by_id):
            raise validation_error("contact_order")
        workspace.profile.contacts = [by_id[cid].model_copy(update={"position": index + 1}) for index, cid in enumerate(ordered_ids)]
        self._ctx.workspaces.save(user_id, workspace)
        return workspace.profile

    def set_primary_contact(self, user_id: str, contact_id: str) -> Profile:
        workspace = self._ctx.workspaces.get(user_id)
        target = next((c for c in workspace.profile.contacts if c.id == contact_id), None)
        if target is None:
            raise not_found("contact")
        workspace.profile.contacts = [
            c.model_copy(update={"is_primary": c.id == contact_id}) if c.kind is target.kind else c for c in workspace.profile.contacts
        ]
        self._ctx.workspaces.save(user_id, workspace)
        return workspace.profile
