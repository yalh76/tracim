# -*- coding: utf-8 -*-
from abc import ABC
from abc import abstractmethod
import functools
import typing
from typing import TYPE_CHECKING

from pyramid.interfaces import IAuthorizationPolicy
from zope.interface import implementer

from tracim_backend.app_models.contents import ContentTypeList
from tracim_backend.app_models.contents import content_type_list
from tracim_backend.exceptions import AllUsersAreNotKnown
from tracim_backend.exceptions import ContentTypeNotAllowed
from tracim_backend.exceptions import InsufficientUserProfile
from tracim_backend.exceptions import InsufficientUserRoleInWorkspace
from tracim_backend.exceptions import PageNotFound
from tracim_backend.exceptions import TracimException
from tracim_backend.exceptions import UserDoesNotExist
from tracim_backend.exceptions import UserGivenIsNotTheSameAsAuthenticated
from tracim_backend.exceptions import UserIsNotContentOwner
from tracim_backend.exceptions import UserIsNotReactionAuthor
from tracim_backend.lib.core.userworkspace import RoleApi
from tracim_backend.lib.utils.logger import logger
from tracim_backend.lib.utils.request import TracimContext
from tracim_backend.models.auth import Profile
from tracim_backend.models.roles import WorkspaceRoles

try:
    from json.decoder import JSONDecodeError
except ImportError:  # python3.4
    JSONDecodeError = ValueError

if TYPE_CHECKING:
    from tracim_backend.lib.utils.request import TracimRequest
###
# Pyramid default permission/authorization mechanism

# INFO - G.M - 12-04-2018 - Setiing a Default permission on view is
#  needed to activate AuthentificationPolicy and
# AuthorizationPolicy on pyramid request
TRACIM_DEFAULT_PERM = "tracim"


class TracimSecurityPolicy:
    """
    Adapter to keep existing authentification method compatible with pyramid 2.0
    source:
    https://docs.pylonsproject.org/projects/pyramid/en/latest/whatsnew-2.0.html#upgrading-from-third-party-policies
    """

    def __init__(self, authentification_policy, authorization_policy):
        self.authentification_policy = authentification_policy
        self.authorization_policy = authorization_policy

    def authenticated_userid(self, request):
        return self.authentification_policy.authenticated_userid(request)

    def permits(self, request, context, permission):
        principals = self.authentification_policy.effective_principals(request)
        return self.authorization_policy.permits(context, principals, permission)

    def remember(self, request, userid, **kw):
        return self.authentification_policy.remember(request, userid, **kw)

    def forget(self, request, **kw):
        return self.authentification_policy.forget(request, **kw)


@implementer(IAuthorizationPolicy)
class AcceptAllAuthorizationPolicy(object):
    """
    Empty AuthorizationPolicy : Allow all request. As Pyramid need
    a Authorization policy when we use AuthentificationPolicy, this
    class permit use to disable pyramid authorization mechanism with
    working a AuthentificationPolicy.
    """

    def permits(self, context, principals, permision):
        return True

    def principals_allowed_by_permission(self, context, permission):
        raise NotImplementedError()


class AuthorizationChecker(ABC):
    """
    Abstract class for AuthorizationChecker
    Authorization Checker are class who does check on tracim_context.
    There are usable in every tracim context (you just need to implement
    needed method in TracimContext) and are very flexible (see
    AndAuthorizationChecker and OrAuthorizationChecker for checker combination
    )
    """

    @abstractmethod
    def check(self, tracim_context: TracimContext) -> bool:
        """Return true or raise TracimException error if check doesnt pass"""
        pass


class CandidateIsCurrentUserChecker(AuthorizationChecker):
    """
    Check if candidate_user is same as current_user
    """

    def check(self, tracim_context: TracimContext) -> bool:
        if tracim_context.current_user.user_id == tracim_context.candidate_user.user_id:
            return True
        raise UserGivenIsNotTheSameAsAuthenticated()


class ProfileChecker(AuthorizationChecker):
    """
    Check if current_user profile
    is as high as profile level given
    """

    def __init__(self, profile: Profile):
        self.profile = profile

    def check(self, tracim_context: TracimContext) -> bool:
        if tracim_context.current_user.profile.id >= self.profile.id:
            return True
        raise InsufficientUserProfile()


class CandidateUserProfileChecker(AuthorizationChecker):
    """
    Check if candidate_user profile
    is as high as profile level given
    """

    def __init__(self, profile: Profile):
        self.profile = profile

    def check(self, tracim_context: TracimContext) -> bool:
        if tracim_context.candidate_user.profile.id >= self.profile.id:
            return True
        raise InsufficientUserProfile()


class RoleChecker(AuthorizationChecker):
    """
    Check if current_user in current_workspace role
    is as high as role level given
    """

    def __init__(self, role_level: int):
        self.role_level = role_level

    def check(self, tracim_context: TracimContext) -> bool:
        if (
            tracim_context.current_workspace.get_user_role(tracim_context.current_user)
            >= self.role_level
        ):
            return True
        raise InsufficientUserRoleInWorkspace()


class CurrentContentRoleChecker(AuthorizationChecker):
    """
    Check if current_user as correct role in workspace of current_content
    """

    def __init__(self, role_level: int) -> None:
        self.role_level = role_level

    def check(self, tracim_context: TracimContext) -> bool:
        if (
            tracim_context.current_content.workspace.get_user_role(tracim_context.current_user)
            >= self.role_level
        ):
            return True
        raise InsufficientUserRoleInWorkspace()


class CandidateWorkspaceRoleChecker(AuthorizationChecker):
    """
    Check if current_user in candidate_workspace role
    is as high as role level given
    """

    def __init__(self, role_level: int):
        self.role_level = role_level

    def check(self, tracim_context: TracimContext) -> bool:
        if (
            tracim_context.candidate_workspace.get_user_role(tracim_context.current_user)
            >= self.role_level
        ):
            return True
        raise InsufficientUserRoleInWorkspace()


class ContentTypeChecker(AuthorizationChecker):
    """
    Check if current_content match content_types given
    """

    def __init__(self, allowed_content_type_list: typing.List[str]):
        self.allowed_content_type_list = allowed_content_type_list

    def check(self, tracim_context: TracimContext) -> bool:
        content = tracim_context.current_content
        current_content_type_slug = content_type_list.get_one_by_slug(content.type).slug
        if current_content_type_slug in self.allowed_content_type_list:
            return True
        raise ContentTypeNotAllowed()


class ContentTypeCreationChecker(AuthorizationChecker):
    """
    Check if user can create content of this type
    """

    def __init__(
        self, content_type_list: ContentTypeList, content_type_slug: typing.Optional[str] = None,
    ):
        """
        :param content_type_slug: force to check a content_type, if not provided,
        :param content_type_list: list of all content_type available in tracim
        check if content type creation is allowed with
        tracim_context.candidate_content_type
        """
        super().__init__()
        self.content_type_slug = content_type_slug
        self.content_type_list = content_type_list

    def check(self, tracim_context: TracimContext) -> bool:
        user_role = tracim_context.current_workspace.get_user_role(tracim_context.current_user)
        if self.content_type_slug:
            content_type = self.content_type_list.get_one_by_slug(self.content_type_slug)
        else:
            content_type = tracim_context.candidate_content_type
        if user_role >= content_type.minimal_role_content_creation.level:
            return True
        raise InsufficientUserRoleInWorkspace()


class CommentOwnerChecker(AuthorizationChecker):
    """
    Check if current_user is owner of current_comment
    """

    def check(self, tracim_context: TracimContext) -> bool:

        if tracim_context.current_comment.owner.user_id == tracim_context.current_user.user_id:
            return True
        raise UserIsNotContentOwner(
            "user {} is not owner of comment {}".format(
                tracim_context.current_user.user_id, tracim_context.current_comment.content_id,
            )
        )


class ReactionAuthorChecker(AuthorizationChecker):
    """
    Check if current_user is author of current_reaction
    """

    def check(self, tracim_context: TracimContext) -> bool:

        if tracim_context.current_reaction.author.user_id == tracim_context.current_user.user_id:
            return True
        raise UserIsNotReactionAuthor(
            "user {} is not author of reaction {}".format(
                tracim_context.current_user.user_id, tracim_context.current_reaction.reaction_id,
            )
        )


class TranslationEnabled(AuthorizationChecker):
    def check(self, tracim_context: TracimContext):
        if not tracim_context.app_config.TRANSLATION_SERVICE__ENABLED:
            raise PageNotFound()


class OrAuthorizationChecker(AuthorizationChecker):
    """
    Check multiple auth_checker with a logical operator "or"
    return last exception found in list of checker
    """

    def __init__(self, *authorization_checkers):
        self.authorization_checkers = authorization_checkers

    def check(self, tracim_context: TracimContext) -> bool:
        exception_to_raise = None
        for authorization_checker in self.authorization_checkers:
            try:
                authorization_checker.check(tracim_context=tracim_context)
                return True
            except TracimException as e:
                exception_to_raise = e

        raise exception_to_raise


class AndAuthorizationChecker(AuthorizationChecker):
    """
    Check multiple auth_checker with an logical operator "and"
    return first exception found in list of checker
    """

    def __init__(self, *authorization_checkers):
        self.authorization_checkers = authorization_checkers

    def check(self, tracim_context: TracimContext) -> bool:
        for authorization_checker in self.authorization_checkers:
            authorization_checker.check(tracim_context=tracim_context)
        return True


class AllUsersAreKnownChecker(AuthorizationChecker):
    """
    Check that KNOWN_MEMBERS__FILTER is False
    """

    def check(self, tracim_context: TracimContext):
        if tracim_context.app_config.KNOWN_MEMBERS__FILTER:
            raise AllUsersAreNotKnown()
        return True


class OneCommonWorkspaceUserChecker(AuthorizationChecker):
    """
    Check that the current user has a common space with the candidate user.
    """

    def check(self, tracim_context: TracimContext) -> bool:
        role_api = RoleApi(
            tracim_context.dbsession, tracim_context.current_user, tracim_context.app_config,
        )
        if not role_api.get_common_workspace_ids(tracim_context.candidate_user.user_id):
            raise UserDoesNotExist(
                "User {} not found or not known".format(tracim_context.candidate_user.user_id)
            )
        return True


# Useful Authorization Checker
# profile
is_administrator = ProfileChecker(Profile.ADMIN)
is_trusted_user = ProfileChecker(Profile.TRUSTED_USER)
is_user = ProfileChecker(Profile.USER)
# role
is_workspace_manager = RoleChecker(WorkspaceRoles.WORKSPACE_MANAGER.level)
is_content_manager = RoleChecker(WorkspaceRoles.CONTENT_MANAGER.level)
is_reader = RoleChecker(WorkspaceRoles.READER.level)
is_current_content_reader = CurrentContentRoleChecker(WorkspaceRoles.READER.level)
is_current_content_contributor = CurrentContentRoleChecker(WorkspaceRoles.CONTRIBUTOR.level)
is_contributor = RoleChecker(WorkspaceRoles.CONTRIBUTOR.level)
# personal_access
has_personal_access = OrAuthorizationChecker(CandidateIsCurrentUserChecker(), is_administrator)
# knows candidate user
# INFO - G.M - 2021-01-28 - Warning! Rule access here should be consistent
# with UserApi.get_known_users method.
# A user "knows" another when either of the following condition is true:
#  - KNOWN_MEMBERS__FILTER is False
#  - the user ids are the same (captain obvious inside)
#  - User is trusted-user (or more)
#  - current and candidate user are member of at least one common space
knows_candidate_user = OrAuthorizationChecker(
    AllUsersAreKnownChecker(),
    CandidateIsCurrentUserChecker(),
    is_trusted_user,
    OneCommonWorkspaceUserChecker(),
)

# workspace
can_see_workspace_information = OrAuthorizationChecker(
    is_administrator, AndAuthorizationChecker(is_reader, is_user)
)
can_modify_workspace = OrAuthorizationChecker(
    is_administrator, AndAuthorizationChecker(is_workspace_manager, is_user)
)
can_leave_workspace = OrAuthorizationChecker(CandidateIsCurrentUserChecker(), can_modify_workspace)
can_delete_workspace = OrAuthorizationChecker(
    is_administrator, AndAuthorizationChecker(is_workspace_manager, is_trusted_user)
)
# content
can_move_content = AndAuthorizationChecker(
    is_content_manager, CandidateWorkspaceRoleChecker(WorkspaceRoles.CONTENT_MANAGER.level),
)
can_create_content = ContentTypeCreationChecker(content_type_list)
# comments
is_comment_owner = CommentOwnerChecker()
can_edit_comment = OrAuthorizationChecker(
    AndAuthorizationChecker(is_contributor, is_comment_owner), is_workspace_manager
)
# reaction
is_reaction_author = ReactionAuthorChecker()
can_delete_reaction = OrAuthorizationChecker(
    AndAuthorizationChecker(is_contributor, is_reaction_author), is_workspace_manager
)
is_translation_service_enabled = TranslationEnabled()

###
# Authorization decorators for views

# INFO - G.M - 12-04-2018
# Instead of relying on pyramid authorization mechanism
# We prefer to use decorators


def check_right(authorization_checker: AuthorizationChecker):
    def decorator(func: typing.Callable) -> typing.Callable:
        @functools.wraps(func)
        def wrapper(self, context, request: "TracimRequest") -> typing.Callable:
            authorization_checker.check(tracim_context=request)
            logger.info(
                request,
                "{} {} from authenticated user {}".format(
                    request.method, request.path, request.current_user.user_id
                ),
            )
            return func(self, context, request)

        return wrapper

    return decorator
