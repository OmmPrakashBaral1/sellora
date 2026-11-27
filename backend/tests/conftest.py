from pathlib import Path

import pytest
from dotenv import dotenv_values
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session


BACKEND_DIR = Path(__file__).resolve().parents[1]

TEST_ENV_FILE = BACKEND_DIR / ".env.test"


@pytest.fixture(scope="session")
def test_engine():
    config = dotenv_values(TEST_ENV_FILE)

    database_url = config.get("TEST_DATABASE_URL")

    if not database_url:
        pytest.fail(
            "TEST_DATABASE_URL is missing from .env.test"
        )

    url = make_url(database_url)

    if url.get_backend_name() != "postgresql":
        pytest.fail(
            "The test database must use PostgreSQL"
        )

    if url.database != "sellora_test":
        pytest.fail(
            "Unsafe database configuration: "
            "expected sellora_test"
        )

    engine = create_engine(database_url)

    try:
        with engine.connect() as connection:
            actual_database = connection.execute(
                text("SELECT current_database()")
            ).scalar_one()

            if actual_database != "sellora_test":
                pytest.fail(
                    "Connected to an unexpected database"
                )

        yield engine

    finally:
        engine.dispose()


@pytest.fixture(scope="session")
def test_schema(test_engine):
    from app.database import Base
    import app.models

    existing_tables = inspect(test_engine).get_table_names()

    if existing_tables:
        pytest.fail(
            "Expected an empty test database before "
            "schema initialization"
        )

    try:
        Base.metadata.create_all(bind=test_engine)

        yield Base.metadata

    finally:
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session(test_engine, test_schema):
    connection = test_engine.connect()
    transaction = connection.begin()

    session = Session(
        bind=connection,
        autoflush=False,
        join_transaction_mode="create_savepoint"
    )

    try:
        yield session

    finally:
        try:
            session.close()
        finally:
            try:
                if transaction.is_active:
                    transaction.rollback()
            finally:
                connection.close()