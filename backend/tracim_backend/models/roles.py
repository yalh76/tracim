from enum import Enum
import typing

from tracim_backend.exceptions import RoleDoesNotExist


class WorkspaceRoles(Enum):
    """
    Available role for workspace.
    All roles should have a unique level and unique slug.
    level is role value store in database and is also use for
    permission check.
    slug is for http endpoints and other place where readability is
    needed.
    """

    NOT_APPLICABLE = (0, "not-applicable")
    READER = (1, "reader")
    CONTRIBUTOR = (2, "contributor")
    CONTENT_MANAGER = (4, "content-manager")
    WORKSPACE_MANAGER = (8, "workspace-manager")

    def __init__(self, level, slug):
        self.level = level
        self.slug = slug

    @property
    def label(self):
        """ Return valid label associated to role"""
        # TODO - G.M - 2018-06-180 - Make this work correctly
        return self.slug

    @classmethod
    def get_all_valid_role(cls) -> typing.List["WorkspaceRoles"]:
        """
        Return all valid role value
        """
        return [item for item in list(WorkspaceRoles) if item.level > 0]

    @classmethod
    def get_role_from_level(cls, level: int) -> "WorkspaceRoles":
        """
        Obtain Workspace role from a level value
        :param level: level value as int
        :return: correct workspace role related
        """
        roles = [item for item in list(WorkspaceRoles) if item.level == level]
        if len(roles) != 1:
            raise RoleDoesNotExist()
        return roles[0]

    @classmethod
    def get_role_from_slug(cls, slug: str) -> "WorkspaceRoles":
        """
        Obtain Workspace role from a slug value
        :param slug: slug value as str
        :return: correct workspace role related
        """
        roles = [item for item in list(WorkspaceRoles) if item.slug == slug]
        if len(roles) != 1:
            raise RoleDoesNotExist()
        return roles[0]

    @classmethod
    def get_all_role_values(cls) -> typing.List[int]:
        """
        Return all valid role value
        """
        return [role.level for role in WorkspaceRoles.get_all_valid_role()]

    @classmethod
    def get_all_role_slug(cls) -> typing.List[str]:
        """
        Return all valid role slug
        """
        # INFO - G.M - 25-05-2018 - Be carefull, as long as this method
        # and get_all_role_values are both used for API, this method should
        # return item in the same order as get_all_role_values
        return [role.slug for role in WorkspaceRoles.get_all_valid_role()]
