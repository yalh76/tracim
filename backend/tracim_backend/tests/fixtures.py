import logging
import os
import pathlib
import subprocess
import typing

from depot.manager import DepotManager
import plaster
from pyramid import testing
import pytest
import requests
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
import transaction
from webtest import TestApp

from tracim_backend import CFG
from tracim_backend import init_models
from tracim_backend import web
from tracim_backend.app_models.applications import TracimApplicationInContext
from tracim_backend.app_models.contents import ContentTypeList
from tracim_backend.fixtures import FixturesLoader
from tracim_backend.fixtures.content import Content as ContentFixture
from tracim_backend.fixtures.users import Base as BaseFixture
from tracim_backend.fixtures.users import Test as FixtureTest
from tracim_backend.lib.rq import RqQueueName
from tracim_backend.lib.rq import get_redis_connection
from tracim_backend.lib.rq import get_rq_queue
from tracim_backend.lib.utils.logger import logger
from tracim_backend.lib.webdav import TracimDavProvider
from tracim_backend.lib.webdav import WebdavAppFactory
from tracim_backend.models.auth import Profile
from tracim_backend.models.auth import User
from tracim_backend.models.meta import DeclarativeBase
from tracim_backend.models.setup_models import get_session_factory
from tracim_backend.tests.utils import TEST_CONFIG_FILE_PATH
from tracim_backend.tests.utils import ApplicationApiFactory
from tracim_backend.tests.utils import ContentApiFactory
from tracim_backend.tests.utils import ElasticSearchHelper
from tracim_backend.tests.utils import EventHelper
from tracim_backend.tests.utils import MailHogHelper
from tracim_backend.tests.utils import MessageHelper
from tracim_backend.tests.utils import RadicaleServerHelper
from tracim_backend.tests.utils import RoleApiFactory
from tracim_backend.tests.utils import ShareLibFactory
from tracim_backend.tests.utils import SubscriptionLibFactory
from tracim_backend.tests.utils import TracimTestContext
from tracim_backend.tests.utils import UploadPermissionLibFactory
from tracim_backend.tests.utils import UserApiFactory
from tracim_backend.tests.utils import WedavEnvironFactory
from tracim_backend.tests.utils import WorkspaceApiFactory
from tracim_backend.tests.utils import tracim_plugin_loader

DATABASE_URLS = {
    "sqlite": "sqlite:////tmp/tracim.sqlite",
    "mysql": "mysql+pymysql://user:secret@127.0.0.1:3306/tracim_test",
    "mariadb": "mysql+pymysql://user:secret@127.0.0.1:3307/tracim_test",
    "postgresql": "postgresql://user:secret@127.0.0.1:5432/tracim_test?client_encoding=utf8",
}


@pytest.fixture
def pushpin(tracim_webserver, tmp_path_factory):
    while True:
        try:
            requests.get("http://localhost:7999")
            break
        except requests.exceptions.ConnectionError:
            pass


@pytest.fixture
def rq_database_worker(config_uri, app_config):
    def empty_event_queues():
        redis_connection = get_redis_connection(app_config)
        for queue_name in RqQueueName:
            queue = get_rq_queue(redis_connection, queue_name)
            queue.delete()

    empty_event_queues()
    worker_env = os.environ.copy()
    worker_env["TRACIM_CONF_PATH"] = "{}#rq_worker_test".format(config_uri)
    base_args = ["rq", "worker", "-q", "-w", "tracim_backend.lib.rq.worker.DatabaseWorker"]
    queue_name_args = [queue_name.value for queue_name in RqQueueName]
    worker_process = subprocess.Popen(base_args + queue_name_args, env=worker_env,)
    yield worker_process
    empty_event_queues()
    worker_process.terminate()
    try:
        worker_process.wait(5.0)
    except TimeoutError:
        worker_process.kill()
        raise TimeoutError("rq worker didn't shut down properly, had to kill it")


@pytest.fixture
def tracim_webserver(
    settings, config_uri, engine, session_factory
) -> typing.Generator[subprocess.Popen, None, None]:
    config_filepath = pathlib.Path(__file__).parent.parent.parent / config_uri
    try:
        penv = os.environ.copy()
        penv["TRACIM_DEBUG"] = "1"
        process = subprocess.Popen(
            [
                "pserve",
                str(config_filepath),
                "-n",
                "tracim_webserver",
                "--server-name",
                "tracim_webserver",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=penv,
        )
        try:
            # INFO 2021/06/22 - SG - wait to see if pserve executes properly
            process.wait(0.5)
            raise Exception(
                "Error while starting server, return code={}".format(process.returncode)
            )
        except subprocess.TimeoutExpired:
            # INFO 2021/06/22 - SG - the process started successfully
            pass
        # INFO 2021/06/22 - SG - then wait for pserve to listen on its port
        starting = True
        while starting:
            try:
                requests.get("http://localhost:6543")
                starting = False
            except requests.exceptions.ConnectionError:
                pass
        yield process

    finally:
        process.terminate()
        try:
            process.wait(timeout=2)
        except Exception:
            process.kill()
    session_factory.close_all()
    DeclarativeBase.metadata.drop_all(engine)


@pytest.fixture
def config_uri() -> str:
    return TEST_CONFIG_FILE_PATH


@pytest.fixture
def config_section(request) -> str:
    """This fixture is used by other fixtures to know which test config section to use.

    To change which config section name must be used for a test, use following decorator
    on your test:

        @pytest.mark.parametrize("config_section", [{"name": "<name_of_config_section>"}], indirect=True)
    """
    return getattr(request, "param", {}).get("name", "base_test")


@pytest.fixture
def settings(config_uri, config_section, sqlalchemy_database):
    _settings = plaster.get_settings(config_uri, config_section)
    _settings["here"] = os.path.dirname(os.path.abspath(TEST_CONFIG_FILE_PATH))
    os.environ["TRACIM_SQLALCHEMY__URL"] = DATABASE_URLS[sqlalchemy_database]
    _settings["sqlalchemy.url"] = DATABASE_URLS[sqlalchemy_database]
    return _settings


@pytest.fixture
def config(settings):
    """This fixture initialize and return pyramid configurator"""
    yield testing.setUp(settings=settings)
    testing.tearDown()


@pytest.fixture
def app_config(settings) -> CFG:
    DepotManager._clear()
    config = CFG(settings)
    config.configure_filedepot()
    yield config
    DepotManager._clear()


@pytest.fixture
def web_testapp(settings, hapic, session):
    DepotManager._clear()
    app = web({}, **settings)
    return TestApp(app)


@pytest.fixture
def hapic():
    from tracim_backend.extensions import hapic as hapic_static

    # INFO - G.M - 2019-03-19 - Reset all hapic context: PyramidContext
    # and controllers
    hapic_static.reset_context()
    # TODO - G.M - 2019-03-19 - Replace this code by something better, see
    # https://github.com/algoo/hapic/issues/144
    hapic_static._controllers = []
    yield hapic_static
    hapic_static.reset_context()
    # TODO - G.M - 2019-03-19 - Replace this code by something better, see
    # https://github.com/algoo/hapic/issues/144
    hapic_static._controllers = []


@pytest.fixture
def engine(config, app_config):
    init_models(config, app_config)
    from tracim_backend.models.setup_models import get_engine

    if app_config.SQLALCHEMY__URL.startswith("sqlite"):
        isolation_level = "SERIALIZABLE"
    else:
        isolation_level = "READ_COMMITTED"
    engine = get_engine(app_config, isolation_level=isolation_level, pool_pre_ping=True)
    yield engine
    engine.dispose()


@pytest.fixture
def session_factory(engine):
    return get_session_factory(engine)


@pytest.fixture
def migration_engine(engine):
    yield engine
    sql = text("DROP TABLE IF EXISTS migrate_version;")
    engine.execute(sql)


@pytest.fixture()
def official_plugin_folder():
    return os.path.dirname(os.path.dirname(os.path.dirname(__file__))) + "/official_plugins"


@pytest.fixture()
def load_parent_access_plugin(test_context, official_plugin_folder):
    pluggy_manager = test_context.plugin_manager
    plugin_name = "tracim_backend_parent_access"
    return tracim_plugin_loader(plugin_name, pluggy_manager, official_plugin_folder)


@pytest.fixture()
def load_auto_invite_plugin(test_context, official_plugin_folder):
    pluggy_manager = test_context.plugin_manager
    plugin_name = "tracim_backend_autoinvite"
    return tracim_plugin_loader(plugin_name, pluggy_manager, official_plugin_folder)


@pytest.fixture()
def load_child_removal_plugin(test_context, official_plugin_folder):
    pluggy_manager = test_context.plugin_manager
    plugin_name = "tracim_backend_child_removal"
    return tracim_plugin_loader(plugin_name, pluggy_manager, official_plugin_folder)


@pytest.fixture
def test_context(app_config, session_factory):
    yield TracimTestContext(app_config, session_factory=session_factory)


@pytest.fixture
def test_context_without_plugins(app_config, session_factory):
    yield TracimTestContext(app_config, session_factory=session_factory, init_plugins=False)


@pytest.fixture
def session(request, engine, session_factory, app_config, test_logger, test_context):
    context = test_context
    with transaction.manager:
        try:
            DeclarativeBase.metadata.drop_all(engine)
            DeclarativeBase.metadata.create_all(engine)
        except Exception as e:
            transaction.abort()
            raise e
    yield context.dbsession

    context.dbsession.rollback()
    context.dbsession.close_all()
    transaction.abort()
    DeclarativeBase.metadata.drop_all(engine)


@pytest.fixture
def base_fixture(session, app_config) -> Session:
    with transaction.manager:
        try:
            fixtures_loader = FixturesLoader(session, app_config)
            fixtures_loader.loads([BaseFixture])
        except IntegrityError as e:
            transaction.abort()
            raise e
    transaction.commit()
    return session


@pytest.fixture
def test_fixture(session, app_config) -> Session:
    """
    Warning! This fixture is now deprecated. Don't use it for new tests.
    """
    with transaction.manager:
        try:
            fixtures_loader = FixturesLoader(session, app_config)
            fixtures_loader.loads([FixtureTest])
        except IntegrityError as e:
            transaction.abort()
            raise e
    transaction.commit()
    return session


@pytest.fixture
def default_content_fixture(base_fixture, app_config) -> Session:
    """
    Warning! This fixture is now deprecated. Don't use it for new tests.
    """
    with transaction.manager:
        try:
            fixtures_loader = FixturesLoader(base_fixture, app_config)
            fixtures_loader.loads([ContentFixture])
        except IntegrityError as e:
            transaction.abort()
            raise e
    transaction.commit()
    return session


@pytest.fixture
def user_api_factory(session, app_config, admin_user) -> UserApiFactory:
    return UserApiFactory(session, app_config, admin_user)


@pytest.fixture
def workspace_api_factory(session, app_config, admin_user) -> WorkspaceApiFactory:
    return WorkspaceApiFactory(session, app_config, admin_user)


@pytest.fixture
def content_api_factory(session, app_config, admin_user) -> ContentApiFactory:
    return ContentApiFactory(session, app_config, admin_user)


@pytest.fixture
def share_lib_factory(session, app_config, admin_user) -> ShareLibFactory:
    return ShareLibFactory(session, app_config, admin_user)


@pytest.fixture
def upload_permission_lib_factory(session, app_config, admin_user) -> UploadPermissionLibFactory:
    return UploadPermissionLibFactory(session, app_config, admin_user)


@pytest.fixture
def role_api_factory(session, app_config, admin_user) -> RoleApiFactory:
    return RoleApiFactory(session, app_config, admin_user)


@pytest.fixture
def application_api_factory(app_list) -> ApplicationApiFactory:
    return ApplicationApiFactory(app_list)


@pytest.fixture
def subscription_lib_factory(session, app_config, admin_user) -> ApplicationApiFactory:
    return SubscriptionLibFactory(session, app_config, admin_user)


@pytest.fixture()
def admin_user(session: Session) -> User:
    return session.query(User).filter(User.email == "admin@admin.admin").one()


@pytest.fixture()
def bob_user(session: Session, user_api_factory: UserApiFactory) -> User:
    user = user_api_factory.get().create_user(
        email="bob@test.test",
        username="bob",
        password="password",
        name="bob",
        profile=Profile.USER,
        timezone="Europe/Paris",
        lang="fr",
        do_save=True,
        do_notify=False,
    )
    transaction.commit()
    return user


@pytest.fixture()
def riyad_user(session: Session, user_api_factory: UserApiFactory) -> User:
    user = user_api_factory.get().create_user(
        email="riyad@test.test",
        username="riyad",
        password="password",
        name="Riyad Faisal",
        profile=Profile.USER,
        timezone="Europe/Paris",
        lang="fr",
        do_save=True,
        do_notify=False,
    )
    transaction.commit()
    return user


@pytest.fixture()
def app_list() -> typing.List[TracimApplicationInContext]:
    from tracim_backend.extensions import app_list as application_list_static

    return application_list_static


@pytest.fixture()
def content_type_list() -> ContentTypeList:
    from tracim_backend.app_models.contents import content_type_list as content_type_list_static

    return content_type_list_static


@pytest.fixture()
def webdav_provider(app_config: CFG):
    return TracimDavProvider(app_config=app_config)


@pytest.fixture()
def webdav_environ_factory(
    webdav_provider: TracimDavProvider, session: Session, admin_user: User, app_config: CFG,
) -> WedavEnvironFactory:
    return WedavEnvironFactory(
        provider=webdav_provider, session=session, app_config=app_config, admin_user=admin_user,
    )


@pytest.fixture
def test_logger() -> None:
    """
    Set all logger to a high level to avoid getting too much noise for tests
    """
    logger._logger.setLevel("ERROR")
    logging.getLogger().setLevel("ERROR")
    logging.getLogger("sqlalchemy").setLevel("ERROR")
    logging.getLogger("txn").setLevel("ERROR")
    logging.getLogger("cliff").setLevel("ERROR")
    logging.getLogger("_jb_pytest_runner").setLevel("ERROR")
    return logger


@pytest.fixture
def mailhog() -> MailHogHelper:
    mailhog_helper = MailHogHelper()
    mailhog_helper.cleanup_mailhog()
    yield mailhog_helper
    mailhog_helper.cleanup_mailhog()


@pytest.fixture
def elasticsearch(app_config, session) -> ElasticSearchHelper:
    elasticsearch_helper = ElasticSearchHelper(app_config, session)
    yield elasticsearch_helper
    elasticsearch_helper.delete_indices()


@pytest.fixture
def radicale_server(config_uri, config_section) -> RadicaleServerHelper:
    radicale_server_helper = RadicaleServerHelper(config_uri, config_section)
    yield radicale_server_helper
    radicale_server_helper.stop_radicale_server()


@pytest.fixture
def webdav_testapp(config_uri, config_section) -> TestApp:
    DepotManager._clear()
    settings = plaster.get_settings(config_uri, config_section)
    settings["here"] = os.path.dirname(os.path.abspath(TEST_CONFIG_FILE_PATH))
    app_factory = WebdavAppFactory(**settings)
    app = app_factory.get_wsgi_app()
    return TestApp(app)


@pytest.fixture
def event_helper(session) -> EventHelper:
    return EventHelper(session)


@pytest.fixture
def message_helper(session) -> MessageHelper:
    return MessageHelper(session)


@pytest.fixture
def html_with_nasty_mention() -> str:
    return "<p> You are not a <img onerror='nastyXSSCall()' alt='member' /> of this workspace <span id='mention-victim'>@victimnotmemberofthisworkspace</span>, are you? </p>"


@pytest.fixture
def html_with_wrong_user_mention() -> str:
    return (
        '<p>Bravo <span id="mention-errormention" class="mention">@userthatdoesnotexist</span></p>'
    )


@pytest.fixture
def html_with_empty_mention() -> str:
    return '<p>Bravo <span id="mention-emptymention" class="mention"></span></p>'
