import os
import typing

from alembic import command
from alembic.config import Config
from alembic.runtime.environment import EnvironmentContext
from alembic.script import ScriptDirectory
import pytest
from sqlalchemy.engine import Engine
from sqlalchemy.engine.reflection import Inspector

from tracim_backend.models.setup_models import *  # noqa: F403,F401
from tracim_backend.tests.fixtures import *  # noqa: F403,F401

TEST_MIGRATION_SCRIPT_LOCATION = os.environ.get("TEST_MIGRATION_SCRIPT_LOCATION")


def get_revision(
    config: Config, engine: Engine, script: ScriptDirectory, revision_type="current"
) -> str:
    """
    Helper to get revision id
    """
    with engine.connect() as conn:
        with EnvironmentContext(config, script) as env_context:
            env_context.configure(conn, version_table="migrate_version")
            if revision_type == "head":
                revision = env_context.get_head_revision()
            else:
                migration_context = env_context.get_context()
                revision = migration_context.get_current_revision()
    return revision


def _create_comparable_column_dict(column_dict: dict) -> dict:
    r = column_dict.copy()
    r["type"] = r["type"].compile()
    return r


class HashableDict(dict):
    def __hash__(self):
        items = []
        for key, value in self.items():
            if isinstance(value, list):
                items.append((key, frozenset(value)))
            elif isinstance(value, dict):
                items.append((key, HashableDict(value)))
            else:
                items.append((key, value))

        return hash(frozenset(items))


def _create_set(dicts: typing.List[dict]) -> typing.Set[dict]:
    return set(HashableDict(d) for d in dicts)


def get_schemas(engine) -> typing.List[dict]:
    inspector = Inspector.from_engine(engine)
    table_names = inspector.get_table_names()
    schemas = []  # type: typing.List[dict]
    for name in sorted(table_names):
        # Internal Alembic migration table
        if name == "migrate_version":
            continue
        table_schemas_dict = dict(
            check_constraints=_create_set(inspector.get_check_constraints(name)),
            # columns=_create_set(
            # [_create_comparable_column_dict(c) for c in inspector.get_columns(name)]
            # ),
            # foreign_keys=_create_set(inspector.get_foreign_keys(name)),
            # indexes=_create_set(inspector.get_indexes(name)),
            # primary_key_constraint=inspector.get_pk_constraint(name),
            # unique_constraints=_create_set(inspector.get_unique_constraints(name)),
        )
        schemas.append(table_schemas_dict)
    return schemas


@pytest.mark.usefixtures("base_fixture")
@pytest.mark.usefixtures("default_content_fixture")
@pytest.mark.parametrize("config_section", [{"name": "migration_test"}], indirect=True)
class TestMigration(object):
    def test_downgrade_and_upgrade(self, migration_engine, session, app_config):
        """Test all migrations up and down.

        Tests that we can apply all migrations from a brand new empty
        database, and also that we can remove them all.
        """
        uri = app_config.SQLALCHEMY__URL
        folder = TEST_MIGRATION_SCRIPT_LOCATION

        alembic_config = Config()
        alembic_config.set_main_option("script_location", folder)
        alembic_config.set_main_option("sqlalchemy.url", uri)
        script = ScriptDirectory.from_config(alembic_config)

        current_schemas = get_schemas(migration_engine)

        # stamp last_revision
        head_revision = get_revision(alembic_config, migration_engine, script, "head")
        current_revision = get_revision(alembic_config, migration_engine, script, "current")
        assert current_revision is None
        head_revision = get_revision(alembic_config, migration_engine, script, "head")
        command.stamp(alembic_config, head_revision)
        current_revision = get_revision(alembic_config, migration_engine, script, "current")
        assert current_revision == head_revision

        # downgrade all revision
        while current_revision is not None:
            command.downgrade(alembic_config, "-1")
            current_revision = get_revision(alembic_config, migration_engine, script, "current")
        assert current_revision is None
        # upgrade all revision
        while current_revision != head_revision:
            command.upgrade(alembic_config, "+1")
            current_revision = get_revision(alembic_config, migration_engine, script, "current")

        assert current_revision == head_revision

        migrated_schemas = get_schemas(migration_engine)
        assert len(migrated_schemas) == len(current_schemas)
        for current_table_schema, migrated_table_schema in zip(current_schemas, migrated_schemas):
            breakpoint()
            assert current_table_schema == migrated_table_schema
