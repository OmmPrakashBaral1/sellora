from sqlalchemy import inspect, text


def test_database_connection(test_engine):
    with test_engine.connect() as connection:
        database_name = connection.execute(
            text("SELECT current_database()")
        ).scalar_one()

    assert database_name == "sellora_test"


def test_database_schema(test_engine, test_schema):
    tables = set(
        inspect(test_engine).get_table_names()
    )

    expected_tables = {
        "users",
        "products",
        "orders",
        "order_items",
        "seller_profiles",
        "seller_orders",
        "payments",
        "seller_applications",
        "webhook_events"
    }

    assert expected_tables.issubset(tables)


def test_database_session(db_session):
    database_name = db_session.execute(
        text("SELECT current_database()")
    ).scalar_one()

    assert database_name == "sellora_test"


def test_transaction_commit_isolation(db_session):
    db_session.execute(
        text(
            "CREATE TABLE test_transaction_probe "
            "(id INTEGER PRIMARY KEY)"
        )
    )

    db_session.execute(
        text(
            "INSERT INTO test_transaction_probe "
            "(id) VALUES (1)"
        )
    )

    db_session.commit()

    result = db_session.execute(
        text(
            "SELECT id FROM test_transaction_probe"
        )
    ).scalar_one()

    assert result == 1


def test_transaction_rollback_cleanup(test_engine, test_schema):
    assert not inspect(test_engine).has_table(
        "test_transaction_probe"
    )