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

class FileManager(object):

    def __init__(self, config: Config):
        self.config = config
        self.create_base()

    def create_base(self) -> None:
        dirs = session.query(
            ContentModel.instance_label,
            ContentModel.workspace_label
        ).distinct().all()
        for dir_ in dirs:
            self.create_dirs(os.path.join(*dir_))

    def update_local_files(self) -> None:
        self.move_contents()
        self.delete_contents()
        self.update_files()
        self.create_contents()
        session.commit()

    def delete_contents(self) -> None:
        contents = self.get_contents_by_flag(Flag.DELETED)

        for content in contents:
            print('deleting {}'.format(content.relative_path))
            self.delete_content(content)
            session.delete(content)
            session.commit()

    def delete_content(self, content: ContentModel) -> None:
        absolute_path = self.get_absolute_path(content)
        if content.content_type == 'folder':
            shutil.rmtree(absolute_path)
        else:
            os.remove(absolute_path)

    def move_contents(self) -> None:
        contents = self.get_contents_by_flag(Flag.MOVED)

        for content in contents:
            self.move_content(content)
            print('updating {}'.format(content.relative_path))
            if not content.content_type == 'folder':
                self.create_or_update_file(content)
            content.flag = Flag.SYNCED
            session.merge(content)
            for sub_content in content.children:
                session.merge(sub_content)
            session.commit()

    def move_content(self, content: ContentModel) -> None:
        old_absolute_path = self.get_absolute_path(content)
        content.set_relative_path()
        new_absolute_path = self.get_absolute_path(content)
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

    def create_content(self, content: ContentModel) -> None:
        if content.content_type == 'folder':
            self.create_dirs(content.relative_path)
        else:
            self.create_or_update_file(content)

    def get_contents_by_flag(self, flag: Flag) -> list:
        return session\
            .query(ContentModel)\
            .filter(ContentModel.flag == flag)\
            .order_by(ContentModel.remote_id)\
            .all()

    def create_or_update_file(self, content: ContentModel) -> None:
        instance_params= self.config.get_instance(content.instance_label)
        normalized_url = self.get_download_url(content)
        request = requests.get(
            normalized_url,
            auth=(instance_params['login'], instance_params['password']),
            stream=True
        )
        absolute_path = os.path.join(
            self.config.BASE_FOLDER,
            content.relative_path
        )
        with open(absolute_path, 'wb') as file_:
            request.raw.decode_content = True
            shutil.copyfileobj(request.raw, file_)

    def create_dirs(self, dir_path: str) -> None:
        import ipdb; ipdb.set_trace()
        os.makedirs(
            os.path.join(self.config.BASE_FOLDER, dir_path),
            exist_ok=True
        )

    def get_absolute_path(self, content: ContentModel) -> None:
        return os.path.join(
            self.config.BASE_FOLDER,
            content.relative_path
        )
            
    def get_download_url(self, content: ContentModel) -> str:
        url = os.path.join(
            self.config.get_instance(content.instance_label)['webdav']['url'],
            content.relative_path[len(content.instance_label) + 1 :]
        )
        return url_normalize(url)
