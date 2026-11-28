from decimal import Decimal
from uuid import uuid4

import pytest

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.routers import orders
from app.services import file_storage

from tests.factories import (
    create_pending_payment_order,
    create_multi_seller_payment_order
)


FILE_CONTENT = b"%PDF-1.7\nSellora digital product test content\n"


def complete_purchase(records):
    records["order"].status = "COMPLETED"

    records["payment"].status = "SUCCESS"

    records["payment"].razorpay_payment_id = (
        f"pay_test_{uuid4().hex}"
    )

    records["seller_order"].status = "COMPLETED"

    if "second_seller_order" in records:
        records["second_seller_order"].status = "COMPLETED"


def attach_product_file(
    product,
    storage_directory,
    content=FILE_CONTENT
):
    storage_key = f"{uuid4().hex}.pdf"

    file_path = storage_directory / storage_key

    file_path.write_bytes(content)

    product.file_storage_key = storage_key

    return file_path


@pytest.fixture
def private_storage(tmp_path, monkeypatch):
    storage_directory = tmp_path / "private_uploads"

    storage_directory.mkdir()

    monkeypatch.setattr(
        file_storage,
        "PRIVATE_STORAGE_DIR",
        storage_directory
    )

    return storage_directory


@pytest.fixture
def download_records(db_session, private_storage):
    records = create_pending_payment_order(db_session)

    complete_purchase(records)

    records["file_path"] = attach_product_file(
        records["product"],
        private_storage
    )

    db_session.flush()

    return records


@pytest.fixture
def download_client(db_session, download_records):
    test_app = FastAPI()

    test_app.include_router(orders.router)

    def override_get_db():
        yield db_session

    def override_get_current_user():
        return download_records["buyer"]

    test_app.dependency_overrides[get_db] = (
        override_get_db
    )

    test_app.dependency_overrides[get_current_user] = (
        override_get_current_user
    )

    try:
        with TestClient(test_app) as client:
            yield client

    finally:
        test_app.dependency_overrides.clear()


def metadata_url(records):
    return f"/orders/{records['order'].id}/downloads"


def download_url(records, product_id=None):
    if product_id is None:
        product_id = records["product"].id

    return f"{metadata_url(records)}/{product_id}"


def assert_download_denied(
    client,
    records,
    expected_status
):
    for url in (
        metadata_url(records),
        download_url(records)
    ):
        response = client.get(url)

        assert response.status_code == expected_status, (
            response.text
        )

def test_download_metadata(
    download_client,
    download_records
):
    response = download_client.get(
        metadata_url(download_records)
    )

    assert response.status_code == 200, response.text

    result = response.json()

    assert result == {
        "order_id": download_records["order"].id,
        "downloads": [
            {
                "product_id": download_records["product"].id,
                "title": download_records["product"].title,
                "download_available": True,
                "download_url": download_url(download_records)
            }
        ]
    }

    assert (
        download_records["product"].file_storage_key
        not in response.text
    )


def test_download_returns_exact_file_content(
    download_client,
    download_records
):
    response = download_client.get(
        download_url(download_records)
    )

    assert response.status_code == 200, response.text

    assert response.content == FILE_CONTENT


def test_download_response_security_headers(
    download_client,
    download_records
):
    response = download_client.get(
        download_url(download_records)
    )

    assert response.status_code == 200, response.text

    product_id = download_records["product"].id

    assert response.headers["content-type"] == (
        "application/pdf"
    )

    assert response.headers["cache-control"] == (
        "private, no-store"
    )

    assert response.headers["x-content-type-options"] == (
        "nosniff"
    )

    disposition = response.headers["content-disposition"]

    assert disposition.startswith("attachment")

    assert f"sellora-product-{product_id}.pdf" in disposition

    assert (
        download_records["product"].file_storage_key
        not in disposition
    )

def test_unauthenticated_download_is_rejected(
    download_client,
    download_records
):
    download_client.app.dependency_overrides.pop(
        get_current_user
    )

    assert_download_denied(
        download_client,
        download_records,
        401
    )


def test_seller_download_is_rejected(
    download_client,
    download_records
):
    download_client.app.dependency_overrides[
        get_current_user
    ] = lambda: download_records["seller_user"]

    assert_download_denied(
        download_client,
        download_records,
        403
    )


def test_another_buyer_cannot_download(
    download_client,
    download_records,
    db_session
):
    other_records = create_pending_payment_order(
        db_session
    )

    download_client.app.dependency_overrides[
        get_current_user
    ] = lambda: other_records["buyer"]

    assert_download_denied(
        download_client,
        download_records,
        404
    )


def test_nonexistent_order_is_rejected(
    download_client,
    download_records
):
    nonexistent_order_id = 999999999

    product_id = download_records["product"].id

    response = download_client.get(
        f"/orders/{nonexistent_order_id}/downloads"
    )

    assert response.status_code == 404

    response = download_client.get(
        f"/orders/{nonexistent_order_id}"
        f"/downloads/{product_id}"
    )

    assert response.status_code == 404


@pytest.mark.parametrize(
    "order_status",
    ["PENDING", "CANCELLED"]
)
def test_incomplete_order_cannot_download(
    download_client,
    download_records,
    db_session,
    order_status
):
    download_records["order"].status = order_status

    db_session.flush()

    assert_download_denied(
        download_client,
        download_records,
        403
    )


def test_order_without_payment_cannot_download(
    download_client,
    download_records,
    db_session
):
    db_session.delete(download_records["payment"])

    db_session.flush()

    assert_download_denied(
        download_client,
        download_records,
        403
    )


def test_unsuccessful_payment_cannot_download(
    download_client,
    download_records,
    db_session
):
    payment = download_records["payment"]

    payment.status = "PENDING"
    payment.razorpay_payment_id = None

    db_session.flush()

    assert_download_denied(
        download_client,
        download_records,
        403
    )


def test_payment_amount_mismatch_is_rejected(
    download_client,
    download_records,
    db_session
):
    download_records["payment"].amount = Decimal("1.00")

    db_session.flush()

    assert_download_denied(
        download_client,
        download_records,
        403
    )


def test_unpurchased_product_cannot_be_downloaded(
    download_client,
    download_records,
    db_session,
    private_storage
):
    other_records = create_pending_payment_order(
        db_session
    )

    other_product = other_records["product"]

    attach_product_file(
        other_product,
        private_storage
    )

    db_session.flush()

    response = download_client.get(
        download_url(
            download_records,
            product_id=other_product.id
        )
    )

    assert response.status_code == 404


def test_incomplete_seller_order_is_rejected(
    download_client,
    download_records,
    db_session
):
    download_records["seller_order"].status = "PENDING"

    db_session.flush()

    metadata_response = download_client.get(
        metadata_url(download_records)
    )

    assert metadata_response.status_code == 403

    file_response = download_client.get(
        download_url(download_records)
    )

    assert file_response.status_code == 404


def test_soft_deleted_product_remains_downloadable(
    download_client,
    download_records,
    db_session
):
    download_records["product"].status = "DELETED"

    db_session.flush()

    response = download_client.get(
        download_url(download_records)
    )

    assert response.status_code == 200

    assert response.content == FILE_CONTENT

@pytest.mark.parametrize(
    "unavailable_reason",
    ["missing_key", "missing_file", "invalid_key"]
)
def test_unavailable_product_file(
    download_client,
    download_records,
    db_session,
    unavailable_reason
):
    if unavailable_reason == "missing_key":
        download_records["product"].file_storage_key = None

    elif unavailable_reason == "missing_file":
        download_records["file_path"].unlink()

    else:
        download_records["product"].file_storage_key = (
            "../outside.pdf"
        )

    db_session.flush()

    metadata_response = download_client.get(
        metadata_url(download_records)
    )

    assert metadata_response.status_code == 200

    download = metadata_response.json()["downloads"][0]

    assert download["download_available"] is False

    assert download["download_url"] is None

    file_response = download_client.get(
        download_url(download_records)
    )

    assert file_response.status_code == 404


def test_valid_private_file_path(
    private_storage
):
    storage_key = f"{uuid4().hex}.pdf"

    expected_path = private_storage / storage_key

    expected_path.write_bytes(FILE_CONTENT)

    resolved_path = file_storage.get_private_file_path(
        storage_key
    )

    assert resolved_path == expected_path.resolve()

    assert resolved_path.read_bytes() == FILE_CONTENT


@pytest.mark.parametrize(
    "invalid_key",
    [
        "../outside.pdf",
        "..\\outside.pdf",
        "/outside.pdf",
        "C:\\outside.pdf",
        "invalid-filename.pdf",
        "a" * 32 + ".exe",
        ""
    ]
)
def test_invalid_storage_keys_are_rejected(
    private_storage,
    invalid_key
):
    with pytest.raises(HTTPException) as exc:
        file_storage.get_private_file_path(invalid_key)

    assert exc.value.status_code == 404


def test_directory_cannot_be_downloaded(
    private_storage
):
    storage_key = f"{uuid4().hex}.pdf"

    directory = private_storage / storage_key

    directory.mkdir()

    with pytest.raises(HTTPException) as exc:
        file_storage.get_private_file_path(storage_key)

    assert exc.value.status_code == 404


def test_symbolic_link_escape_is_rejected(
    download_client,
    download_records,
    private_storage
):
    outside_file = private_storage.parent / "outside.pdf"

    outside_file.write_bytes(
        b"Private content outside storage"
    )

    file_path = download_records["file_path"]

    file_path.unlink()

    try:
        file_path.symlink_to(outside_file)

    except OSError as exc:
        if (
            getattr(exc, "winerror", None) == 1314
            or isinstance(exc, PermissionError)
        ):
            pytest.skip(
                "Symbolic link creation requires "
                "additional operating system permissions"
            )

        raise

    with pytest.raises(HTTPException) as exc:
        file_storage.get_private_file_path(
            file_path.name
        )

    assert exc.value.status_code == 404

    metadata_response = download_client.get(
        metadata_url(download_records)
    )

    assert metadata_response.status_code == 200

    download = metadata_response.json()["downloads"][0]

    assert download["download_available"] is False

    assert download["download_url"] is None

    file_response = download_client.get(
        download_url(download_records)
    )

    assert file_response.status_code == 404

def test_multi_seller_products_are_downloadable(
    download_client,
    db_session,
    private_storage
):
    records = create_multi_seller_payment_order(
        db_session
    )

    complete_purchase(records)

    first_content = b"%PDF-1.7\nFirst seller product\n"

    second_content = b"%PDF-1.7\nSecond seller product\n"

    attach_product_file(
        records["product"],
        private_storage,
        first_content
    )

    attach_product_file(
        records["second_product"],
        private_storage,
        second_content
    )

    db_session.flush()

    download_client.app.dependency_overrides[
        get_current_user
    ] = lambda: records["buyer"]

    response = download_client.get(
        metadata_url(records)
    )

    assert response.status_code == 200, response.text

    downloads = response.json()["downloads"]

    assert len(downloads) == 2

    expected_files = {
        records["product"].id: first_content,
        records["second_product"].id: second_content
    }

    assert {
        item["product_id"]
        for item in downloads
    } == set(expected_files)

    for item in downloads:
        assert item["download_available"] is True

        assert item["download_url"] == download_url(
            records,
            product_id=item["product_id"]
        )

        file_response = download_client.get(
            item["download_url"]
        )

        assert file_response.status_code == 200

        assert file_response.content == (
            expected_files[item["product_id"]]
        )