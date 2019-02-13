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


class WorkspaceModel(BaseModel):

    __tablename__ = 'workspace'

    id = Column('id', Integer, primary_key=True, autoincrement=True)
    remote_id = Column('remote_id', Integer, nullable=False)
    instance_label = Column(
        'instance_label', String, default='', nullable=False
    )
    label = Column('label', String, default='', nullable=False)
    old_label = Column('old_label', String, default='', nullable=False)
    # contents = relationship('ContentModel', backref='workspace')
    flag = Column('flag', Enum(Flag), default=Flag.NEW)
    relative_path = Column('relative_path', String, default='', nullable=False)

    def set_relative_path(self):
        self.relative_path = self._get_relative_path()

    def _get_relative_path(self):
        return os.path.join(self.instance_label, self.label)

    def reset_olds(self):
        self.old_label = ''

class ContentModel(BaseModel):

    __tablename__ = 'content'

    id = Column('id', Integer, primary_key=True, autoincrement=True)
    remote_id = Column('remote_id', Integer, nullable=False)
    revision_id = Column('revision_id', Integer, nullable=False)
    content_type = Column('content_type', Enum(ContentType), nullable=False)
    relative_path = Column('relative_path', String, default='', nullable=False)
    instance_label = Column(
        'instance_label', String, default='', nullable=False
    )

    filename = Column('filename', String, default='', nullable=False)
    old_filename = Column('old_filename', String, default='', nullable=False)

    workspace_id = Column(Integer, ForeignKey('workspace.remote_id'))
    old_workspace_id = Column('old_workspace_id', Integer, ForeignKey('workspace.remote_id'), nullable=True)

    workspace = relationship('WorkspaceModel', foreign_keys=[workspace_id, instance_label])
    old_workspace = relationship('WorkspaceModel', foreign_keys=[old_workspace_id, instance_label])

    parent_id = Column('parent_id', Integer, ForeignKey('content.remote_id'))
    old_parent_id = Column(
        'old_parent_id',
        Integer,
        ForeignKey('content.remote_id'),
        nullable=True
    )
    children = relationship(
        "ContentModel",
        backref=backref('parent', remote_side=[remote_id]),
        foreign_keys=[parent_id]
    )
    old_children = relationship(
        "ContentModel",
        backref=backref('old_parent', remote_side=[remote_id]),
        foreign_keys=[old_parent_id]
    )

    flag = Column('flag', Enum(Flag), default=Flag.NEW)

    def set_relative_path(self):
        self.relative_path = self._get_relative_path()
        for child in self.children:
            child.set_relative_path()

    def _get_relative_path(self):
        if self.parent:
            return os.path.join(
                self.parent._get_relative_path(), self.filename
            )
        return os.path.join(
            self.workspace._get_relative_path(), self.filename
        )

    def has_moved(self, remote_content):
        return remote_content.filename != self.filename\
            or remote_content.parent_id != self.parent_id\
            or remote_content.workspace_id != self.workspace_id

    def _reset_olds(self):
        self.old_filename = ''
        self.old_parent_id = None
        self.old_workspace_id = None
