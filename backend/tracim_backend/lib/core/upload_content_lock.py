import typing
import uuid

from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import NoResultFound

from tracim_backend import CFG
from tracim_backend.exceptions import ContentLockNotFound
from tracim_backend.models.auth import User
from tracim_backend.models.content_lock import UploadContentLock


class UploadContentLockLib(object):
    def __init__(
        self,
        current_user: typing.Optional[User],
        session: Session,
        config: CFG,
        show_deleted: bool = False,
    ) -> None:
        self._session = session
        self._user = current_user
        self._config = config
        self.show_deleted = show_deleted

    def _base_query(self):
        query = self._session.query(UploadContentLock)
        if not self.show_deleted:
            query = query.filter(UploadContentLock.enabled == True)  # noqa: E711
        return query

    def get_lock_by_token(self, lock_token: str, content_id: int) -> UploadContentLock:
        try:
            return (
                self._base_query()
                .filter(UploadContentLock.lock_token == lock_token)
                .filter(UploadContentLock.content_id == content_id)
                .one()
            )
        except NoResultFound as exc:
            raise ContentLockNotFound(
                'Content Lock with token "{}" not found in database'.format(lock_token)
            ) from exc

    def get_content_locks(self, content_id: int) -> UploadContentLock:
        return self._base_query().filter(UploadContentLock.content_id == content_id).all()

    def can_upload_content(self, content_id: int, lock_token: typing.Optional[str]):
        if lock_token:
            try:
                self.get_lock_by_token(lock_token, content_id)
                return True
            except ContentLockNotFound:
                return False
        else:
            return len(self.get_content_locks(content_id)) == 0

    def add_lock(
        self, content_id: int, lock_token: typing.Optional[str] = None
    ) -> UploadContentLock:
        if not lock_token:
            lock_token = str(uuid.uuid4().hex)
        return UploadContentLock(
            lock_token=lock_token, content_id=content_id, user_id=self._user.user_id
        )

    def remove_lock(self, lock_token: str, content_id: int) -> UploadContentLock:
        lock = self.get_lock_by_token(lock_token, content_id)
        lock.enabled = False
        return lock

    def save(self, upload_content_lock: UploadContentLock) -> UploadContentLock:
        self._session.add(upload_content_lock)
        return upload_content_lock
