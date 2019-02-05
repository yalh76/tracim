# coding: utf-8

import os

from sqlalchemy import Boolean
from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Enum
from sqlalchemy import ForeignKey
from sqlalchemy.orm import backref
from sqlalchemy.orm import relationship
from sqlalchemy import UniqueConstraint
from sqlalchemy import event

from db import BaseModel
from enums import Flag
from enums import ContentType


class ContentModel(BaseModel):

    __tablename__ = 'content'

    id = Column('id', Integer, primary_key=True, autoincrement=True)
    remote_id = Column('remote_id', Integer, nullable=False)
    revision_id = Column('revision_id', Integer, unique=True, nullable=False)
    content_type = Column('content_type', Enum(ContentType), nullable=False)
    relative_path = Column('relative_path', String, default='', nullable=False)

    filename = Column('filename', String, default='', nullable=False)
    instance_label = Column(
        'instance_label', String, default='', nullable=False
    )
    workspace_label = Column(
        'workspace_label', String, default='', nullable=False
    )

    workspace_id = Column('workspace_id', Integer, ForeignKey('workspace.id'))

    parent_id = Column(
        'parent_id', Integer, ForeignKey('content.remote_id')
    )
    children = relationship(
        "ContentModel",
        backref=backref('parent', remote_side=[remote_id])
    )
    flag = Column('flag', Enum(Flag), default=Flag.NEW)

    UniqueConstraint(remote_id, instance_label)

    def set_relative_path(self):
        self.relative_path = self._get_relative_path()
        for child in self.children:
            child.set_relative_path()

    def _get_relative_path(self):
        if self.parent:
            return os.path.join(
                self.parent._get_relative_path(), self.filename
            )
        return os.path.join(self.workspace, self.filename)

    def has_moved(self, remote_content):
        return remote_content.filename != self.filename\
                or remote_content.parent_id != self.parent_id

class WorkspaceModel(BaseModel):

    __tablename__ = 'Workspace'

    id = Column('id', Integer, primary_key=True, autoincrement=True)
    remote_id = Column('remote_id', Integer, nullable=False)
    instance_label = Column(
        'instance_label', String, default='', nullable=False
    )
    label = Column('label', String, default='', nullable=False)
    contents = relationship('ContentModel', backref='workspace')
    flag = Column('flag', Enum(Flag), default=Flag.NEW)

    def set_relative_path(self):
        for content in self.contents:
            content.set_relative_path()

    def _get_relative_path(self):
        return os.path.join(self.instance_label, self.label)
