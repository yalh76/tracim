# coding: utf-8
import os
import shutil

import requests
from url_normalize import url_normalize

from config import Config
from db import session
from enums import Flag
from enums import ContentType
from models import ContentModel
from models import WorkspaceModel

class FileManager(object):

    def __init__(self, config: Config):
        self.config = config

    def update_local_files(self) -> None:
        # INFO this order is really important
        self._move_workspaces()
        self._create_workspaces()
        # We moves content before we delete so we don't delete content moved
        # from a deleted folder
        self.create_folders()
        self.move_folders()
        self.move_contents()
        # We delete before updating so if a content was changed then its folder
        # was deleted we don't download it for nothing
        self.delete_contents()
        self.update_files()
        # we move workspaces they don't have 
        self.create_contents()
        session.commit()

    def _move_workspaces(self):
        workspaces = self.get_workspaces_by_flag(Flag.MOVED)
        for workspace in workspaces:
            old_path = self.get_workspace_absolute_old_path(workspace)
            workspace.set_relative_path()
            new_path = self.get_workspace_absolute_path(workspace)
            print('moving workspace from {} to {}'.format(old_path, new_path))
            shutil.move(old_path, new_path)
            workspace.reset_olds()
            workspace.flag = Flag.SYNCED
            session.merge(workspace)
            session.commit()

    def _create_workspaces(self):
        workspaces = self.get_workspaces_by_flag(Flag.NEW)
        for workspace in workspaces:
            workspace.set_relative_path()
            print('creating new workspace {}'.format(workspace.relative_path))
            path = self.get_workspace_absolute_path(workspace)
            self.create_dirs(path)

    def delete_contents(self) -> None:
        contents = self.get_contents_by_flag(Flag.DELETED)

        for content in contents:
            print('deleting {}'.format(content.relative_path))
            self.delete_content(content)
            session.delete(content)
            session.commit()

    def delete_content(self, content: ContentModel) -> None:
        absolute_path = self.get_content_absolute_path(content)
        if content.content_type == ContentType.FOLDER:
            shutil.rmtree(absolute_path)
        else:
            os.remove(absolute_path)

    def move_contents(self) -> None:
        contents = self.get_contents_by_flag(Flag.MOVED)

        for content in contents:
            self.move_content(content)
            print('updating {}'.format(content.relative_path))
            content.flag = Flag.SYNCED
            session.merge(content)
            for sub_content in content.children:
                session.merge(sub_content)
            session.commit()

    def move_folders(self) -> None:

        folders = self.get_folder_by_flag(Flag.MOVED)
        for folder in folders:
            self.move_content(folder)
            print('updating {}'.format(folder.relative_path))
            folder.flag = Flag.SYNCED
            session.merge(folder)
            for sub_folder in folder.children:
                session.merge(sub_folder)
            session.commit()

    def move_content(self, content: ContentModel) -> None:
        old_absolute_path = self.get_content_absolute_old_path(content)
        content.set_relative_path()
        new_absolute_path = self.get_content_absolute_path(content)
        print('moving from {} to {}'.format(
                old_absolute_path,
                new_absolute_path
            )
        )
        shutil.move(old_absolute_path, new_absolute_path)

    def update_files(self) -> None:
        contents = self.get_contents_by_flag(Flag.CHANGED)
        for content in contents:
            self.create_or_update_file(content)
            content.flag = Flag.SYNCED
            session.merge(content)
        

    def create_contents(self) -> None:
        contents = self.get_contents_by_flag(Flag.NEW)

        for content in contents:
            content.set_relative_path()
            print('new file {}'.format(content.relative_path))
            try:
                self.create_content(content)
                content.flag = Flag.SYNCED
                session.merge(content)
            except requests.exceptions.ConnectionError:
                print('Could not download {}'.format(content.filename))

    def create_folders(self) -> None:
        folders = self.get_folder_by_flag(Flag.NEW)

        for folder in folders:
            folder.set_relative_path()
            print('new file {}'.format(folder.relative_path))
            self.create_content(folder)
            folder.flag = Flag.SYNCED
            session.merge(folder)


    def create_content(self, content: ContentModel) -> None:
        if content.content_type == ContentType.FOLDER:
            self.create_dirs(content.relative_path)
        else:
            self.create_or_update_file(content)

    def get_contents_by_flag(self, flag: Flag) -> list:
        return session\
            .query(ContentModel)\
            .filter(ContentModel.flag == flag)\
            .filter(ContentModel.content_type != ContentType.FOLDER)\
            .order_by(ContentModel.remote_id)\
            .all()

    def get_folder_by_flag(self, flag: Flag) -> list:
        return session\
            .query(ContentModel)\
            .filter(ContentModel.flag == flag)\
            .filter(ContentModel.content_type == ContentType.FOLDER)\
            .order_by(ContentModel.remote_id)\
            .all()


    def get_workspaces_by_flag(self, flag: Flag) -> list:
        return session\
            .query(WorkspaceModel)\
            .filter(WorkspaceModel.flag == flag)\
            .all()

    def create_or_update_file(self, content: ContentModel) -> None:
        instance_params= self.config.get_instance(content.instance_label)
        normalized_url = self.get_download_url(content)
        request = requests.get(
            normalized_url,
            auth=(instance_params['login'], instance_params['password']),
            stream=True
        )
        absolute_path = self.get_content_absolute_path(content)
        with open(absolute_path, 'wb') as file_:
            request.raw.decode_content = True
            shutil.copyfileobj(request.raw, file_)

    def create_dirs(self, dir_path: str) -> None:
        os.makedirs(
            os.path.join(self.config.BASE_FOLDER, dir_path),
            exist_ok=True
        )

    def get_content_absolute_path(self, content: ContentModel) -> None:
        content.set_relative_path()
        return os.path.join(
            self.config.BASE_FOLDER,
            content.relative_path
        )
            
    def get_download_url(self, content: ContentModel) -> str:
        content.set_relative_path()
        url = os.path.join(
            self.config.get_instance(content.instance_label)['webdav']['url'],
            content.relative_path
        )
        return url_normalize(url)

    def get_content_absolute_old_path(self, content: ContentModel) -> str:
        filename = content.old_filename or content.filename
        parent_id = content.old_parent_id or content.parent_id
        if parent_id:
            parent_content = session\
                .query(ContentModel)\
                .filter(ContentModel.remote_id == parent_id)\
                .one()

            return os.path.join(
                self.config.BASE_FOLDER,
                parent_content.relative_path,
                filename
            )
        workspace_id = content.old_workspace_id or content.workspace_id
        workspace = session\
            .query(WorkspaceModel)\
            .filter(WorkspaceModel.remote_id == workspace_id)\
            .one()

        return os.path.join(
            self.config.BASE_FOLDER,
            workspace.label,
            filename
        )
        
    def get_workspace_absolute_old_path(
            self, workspace: WorkspaceModel
    ) -> str:
        return os.path.join(self.config.BASE_FOLDER, workspace.old_label)

    def get_workspace_absolute_path(self, workspace: WorkspaceModel) -> str:
        return os.path.join(self.config.BASE_FOLDER, workspace.relative_path)
