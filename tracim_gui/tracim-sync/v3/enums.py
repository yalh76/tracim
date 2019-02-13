# coding: utf-8

import enum


class ContentType(enum.Enum):

    FOLDER = 'folder'
    DOCUMENT = 'html-document'
    THREAD = 'thread'
    FILE = 'file'
    COMMENT = 'comment'


class Flag(enum.Enum):
    NEW = 'new'
    MOVED = 'moved'
    CHANGED = 'changed'
    DELETED = 'deleted'
    SYNCED = 'synced'
    DESYNCED = 'desynced'
    RESYNCED = 'resynced'


class Url(enum.Enum):

    WORKSPACE = "{remote}/api/v2/workspaces"
    CONTENT = "{remote}/api/v2/workspaces/{workspace_id}/contents/extended?show_deleted=1&show_archived=1&after_revision_id={revision_id}"
    FOLDER = "{remote}/api/v2/workspaces/{workspace_id}/folders/{content_id}"
    FILE = "{remote}/api/v2/workspaces/{workspace_id}/files/{content_id}"
    THREAD = "{remote}/api/v2/workspaces/{workspace_id}/threads/{content_id}"  # nopep8
    DOCUMENT = "{remote}/api/v2/workspaces/{workspace_id}/html-documents/{content_id}"  # nopep8
    WEBDAV_FILE = "{webdav}/{file_path}/"