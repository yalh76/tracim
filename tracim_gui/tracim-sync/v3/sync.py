# coding: utf-8

from config import ConfigParser

from adapters import InstanceAdapter
from adapters import ContentAdapter
from adapters import WorkspaceAdapter
from db import session
from enums import Flag
from models import ContentModel
from models import WorkspaceModel

from sqlalchemy.orm.exc import NoResultFound

from tracim_sync_exceptions import IntegrityException

class Synchronizer(object):

    def __init__(self, instance: InstanceAdapter) -> None:
        self.instance = instance
        self.workpaces = list()
        self.updated_contents = list()
        self.deleted_contents = list()
        self.comments = list()

    def detect_changes(self) -> None:
        self.workpaces = self.instance.load_workspaces()
        remote_contents = set(self.instance.load_all_contents())
        self.deleted_contents = self._filter_deleted_contents(remote_contents)
        remote_contents = remote_contents - self.deleted_contents
        self.comments = self._filter_comments(remote_contents)
        self.updated_contents = remote_contents - self.comments

    def update_db(self) -> None:
        self._flag_workspaces()
        self._flag_contents()
        self._flag_threads()
        # self._flag_deleted_contents()
        session.commit()

    def _flag_workspaces(self) -> None:
        for remote_workpace in self.workpaces:
            workspace = self._cast_workspace_model(remote_workpace)
            try:
                self._flag_updated_workspace(workspace)
            except NoResultFound:
                self._flag_new_workspace(workspace)
            session.commit()

    def _flag_updated_workspace(self, remote_workpace: WorkspaceAdapter) -> None:
        local_workspace = session\
            .query(WorkspaceModel)\
            .filter_by(
                remote_id=remote_workpace.remote_id,
                instance_label=remote_workpace.instance_label
            )\
            .one()

        remote_workpace.id = local_workspace.id
        remote_workpace.flag = Flag.CHANGED
        if remote_workpace.label != local_workspace.label:
            remote_workpace.flag = Flag.MOVED
            remote_workpace.old_label = local_workspace.label
        session.merge(remote_workpace)

    def _flag_new_workspace(self, remote_workpace: WorkspaceModel) -> None:
        remote_workpace.flag = Flag.NEW
        session.add(remote_workpace)

    def _flag_contents(self) -> None:
        if not self.updated_contents:
            print('Nothing to update')

        for content in self.updated_contents:
            remote_content = self._cast_to_model(content)
            try:
                self._flag_updated_content(remote_content)
            except NoResultFound:
                self._flag_new_content(remote_content)
            except IntegrityException as ex:
                print(ex.message)
            session.commit()

        if not self.deleted_contents:
            print('Nothing to delete')

        # TODO flag children too
        for content in self.deleted_contents:
            session\
                .query(ContentModel)\
                .filter(ContentModel.remote_id == content.remote_id)\
                .update({ContentModel.flag: Flag.DELETED})
            session.commit()

    def _flag_updated_content(self, remote_content) -> None:
        local_content = session.query(ContentModel).filter_by(
                instance_label=self.instance.label,
                remote_id=remote_content.remote_id,
            ).one()

        if local_content.revision_id > remote_content.revision_id:
            raise IntegrityException(
                'Error with the API for content id {}'.format(
                    remote_content.remote_id
                )
            )

        remote_content.id = local_content.id
        remote_content.flag = Flag.CHANGED
        if local_content.has_moved(remote_content):
            remote_content.flag = Flag.MOVED
            remote_content = self.mark_olds(remote_content, local_content)
        session.merge(remote_content)

    def _flag_new_content(self, remote_content) -> None:
        remote_content.flag = Flag.NEW
        session.add(remote_content)

    def _flag_threads(self) -> None:
        comments = self._reduce_comments()
        for comment in comments:
            try:
                self._flag_updated_thread(comment)
                session.commit()
            except NoResultFound:
                print(
                    'Passed on update thread id: {}'.format(
                        comment.parent_id
                    )
                )

    def _flag_updated_thread(self, comment) -> None:
        thread = session\
            .query(ContentModel)\
            .filter(ContentModel.remote_id == comment.parent_id)\
            .filter(ContentModel.flag != Flag.DELETED)\
            .one()

        if thread.revision_id > comment.revision_id:
            raise IntegrityException(
                'Error with integrity on thread id {}'.format(
                    thread.remote_id
                )
            )
        # If the thread is deleted or moved we don't want to change its flag
        if thread.flag == Flag.SYNCED:
            thread.flag = Flag.CHANGED
        thread.revision_id = comment.revision_id
        session.merge(thread)

    def _flag_deleted_contents(self) -> None:
        if not self.deleted_contents:
            print('Nothing to delete')
        for content in self.deleted_contents:
            session\
                .query(ContentModel)\
                .filter(ContentModel.remote_id == content.remote_id)\
                .update({ContentModel.flag: Flag.DELETED})
            session.commit()

    def _reduce_comments(self) -> list:
        """
            returns self.comments reduced to a list of comments with only
            comments with the highest revision_id dictinct on remote_id 
        """
        reduced_comments = dict()
        for comment in self.comments:
            id_ = comment.remote_id
            if not reduced_comments.get(id_, None):
                reduced_comments[id_] = comment
            elif reduced_comments[id_].revision_id < comment.revision_id:
                reduced_comments[id_] = comment
        return reduced_comments.values()

    def _filter_deleted_contents(self, remote_contents) -> list:
        return set(filter(
            lambda x: x.is_deleted() or x.is_archived(), remote_contents
        ))

    def _filter_comments(self, remote_contents) -> list:
        return set(filter(
            lambda x: x.is_comment(), remote_contents
        ))

    def _cast_to_model(self, content: ContentAdapter) -> ContentModel:
        return ContentModel(
            remote_id=content.remote_id,
            revision_id=content.revision_id,
            content_type=content.content_type,
            filename=content.filename,
            instance_label=self.instance.label,
            workspace_id=content.workspace_id,
            parent_id=content.parent_id
        )

    def _cast_workspace_model(
            self, remote_workpace: WorkspaceAdapter
    ) -> WorkspaceModel:
        return WorkspaceModel(
            instance_label=self.instance.label,
            remote_id=remote_workpace.remote_id,
            label=remote_workpace.label
        )

    def mark_olds(self, remote_content, local_content):
        if remote_content.filename != local_content.filename:
            remote_content.old_filename = local_content.filename

        if remote_content.parent_id != local_content.parent_id:
            remote_content.old_parent_id = local_content.parent_id

        if remote_content.workspace_id != local_content.workspace_id:
            remote_content.old_workspace_id = local_content.workspace_id

        return remote_content
