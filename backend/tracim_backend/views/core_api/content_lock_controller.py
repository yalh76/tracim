from http import HTTPStatus

from pyramid.config import Configurator

from tracim_backend.config import CFG
from tracim_backend.extensions import hapic
from tracim_backend.lib.core.upload_content_lock import UploadContentLockLib
from tracim_backend.lib.utils.authorization import check_right
from tracim_backend.lib.utils.authorization import is_contributor
from tracim_backend.lib.utils.request import TracimRequest
from tracim_backend.lib.utils.utils import generate_documentation_swagger_tag
from tracim_backend.views.controllers import Controller
from tracim_backend.views.core_api.schemas import LockTokenBodySchema
from tracim_backend.views.core_api.schemas import NoContentSchema
from tracim_backend.views.core_api.schemas import WorkspaceAndContentIdPathSchema
from tracim_backend.views.swagger_generic_section import SWAGGER_TAG__CONTENT_ENDPOINTS

SWAGGER_TAG__CONTENT_LOCK_SECTION = "Lock"
SWAGGER_TAG__CONTENT_LOCK_ENDPOINTS = generate_documentation_swagger_tag(
    SWAGGER_TAG__CONTENT_ENDPOINTS, SWAGGER_TAG__CONTENT_LOCK_SECTION
)


class ContentLockController(Controller):
    @hapic.with_api_doc(tags=[SWAGGER_TAG__CONTENT_LOCK_ENDPOINTS])
    @check_right(is_contributor)
    @hapic.input_path(WorkspaceAndContentIdPathSchema())
    @hapic.output_body(LockTokenBodySchema())
    def lock_content(self, context, request: TracimRequest, hapic_data=None):
        """
        Lock content
        """
        app_config = request.registry.settings["CFG"]  # type: CFG
        locklib = UploadContentLockLib(
            current_user=request.current_user, session=request.dbsession, config=app_config
        )
        lock = locklib.add_lock(content_id=hapic_data.path.content_id)
        locklib.save(lock)
        return lock

    @hapic.with_api_doc(tags=[SWAGGER_TAG__CONTENT_LOCK_ENDPOINTS])
    @check_right(is_contributor)
    @hapic.input_path(WorkspaceAndContentIdPathSchema())
    @hapic.input_body(LockTokenBodySchema())
    @hapic.output_body(NoContentSchema(), default_http_code=HTTPStatus.NO_CONTENT)
    def unlock_content(self, context, request: TracimRequest, hapic_data=None):
        """
        Unlock content
        """
        app_config = request.registry.settings["CFG"]  # type: CFG
        locklib = UploadContentLockLib(
            current_user=request.current_user, session=request.dbsession, config=app_config
        )
        lock = locklib.remove_lock(
            lock_token=hapic_data.body.lock_token, content_id=hapic_data.path.content_id
        )
        locklib.save(lock)

    def bind(self, configurator: Configurator):
        # lock content
        configurator.add_route(
            "lock_content",
            "/workspaces/{workspace_id}/contents/{content_id}/lock",
            request_method="PUT",
        )
        configurator.add_view(self.lock_content, route_name="lock_content")
        # unlock content
        configurator.add_route(
            "unlock_content",
            "/workspaces/{workspace_id}/contents/{content_id}/unlock",
            request_method="PUT",
        )
        configurator.add_view(self.unlock_content, route_name="unlock_content")
