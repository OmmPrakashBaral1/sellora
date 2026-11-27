from app.models import User
from unittest.mock import Mock

from decimal import Decimal

from app.models import SellerOrder

from tests.factories import create_multi_seller_payment_order

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.routers import payments

from tests.factories import create_pending_payment_order

@pytest.fixture
def multi_seller_records(db_session):
    return create_multi_seller_payment_order(db_session)

@pytest.fixture
def payment_records(db_session):
    return create_pending_payment_order(db_session)


@pytest.fixture
def payment_client(db_session, payment_records):
    test_app = FastAPI()

    test_app.include_router(payments.router)

    def override_get_db():
        yield db_session

    def override_get_current_user():
        return payment_records["buyer"]

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


@pytest.fixture
def mocked_razorpay(monkeypatch, payment_records):
    payment = payment_records["payment"]

    gateway_order_id = payment.razorpay_order_id
    gateway_payment_id = f"pay_test_{payment.id}"

    gateway = Mock()

    gateway.order.fetch.return_value = {
        "id": gateway_order_id,
        "amount": 79900,
        "amount_paid": 79900,
        "currency": "INR",
        "status": "paid"
    }

    gateway.order.payments.return_value = {
        "count": 1,
        "items": [
            {
                "id": gateway_payment_id,
                "order_id": gateway_order_id,
                "amount": 79900,
                "currency": "INR",
                "status": "captured",
                "amount_refunded": 0
            }
        ]
    }

    monkeypatch.setattr(payments, "client", gateway)

    return gateway


def test_reconcile_captured_payment(
    payment_client,
    payment_records,
    mocked_razorpay,
    db_session
):
    order = payment_records["order"]
    payment = payment_records["payment"]
    seller_order = payment_records["seller_order"]

    assert order.status == "PENDING"
    assert payment.status == "PENDING"
    assert seller_order.status == "PENDING"

    response = payment_client.post(
        f"/payments/reconcile/{order.id}"
    )

    assert response.status_code == 200, response.text

    result = response.json()

    assert result["reconciled"] is True
    assert result["order_id"] == order.id
    assert result["payment_id"] == payment.id
    assert result["order_status"] == "COMPLETED"
    assert result["payment_status"] == "SUCCESS"

    db_session.refresh(order)
    db_session.refresh(payment)
    db_session.refresh(seller_order)

    assert order.status == "COMPLETED"
    assert payment.status == "SUCCESS"
    assert seller_order.status == "COMPLETED"

    assert payment.razorpay_payment_id == (
        f"pay_test_{payment.id}"
    )

    mocked_razorpay.order.fetch.assert_called_once_with(
        payment.razorpay_order_id
    )

    mocked_razorpay.order.payments.assert_called_once_with(
        payment.razorpay_order_id
    )


def test_reconciliation_is_idempotent(
    payment_client,
    payment_records,
    mocked_razorpay,
    db_session
):
    order = payment_records["order"]
    payment = payment_records["payment"]
    seller_order = payment_records["seller_order"]

    endpoint = f"/payments/reconcile/{order.id}"

    first_response = payment_client.post(endpoint)

    assert first_response.status_code == 200
    assert first_response.json()["reconciled"] is True

    db_session.refresh(payment)

    original_payment_id = payment.razorpay_payment_id
    original_updated_at = payment.updated_at

    second_response = payment_client.post(endpoint)

    assert second_response.status_code == 200

    result = second_response.json()

    assert result["reconciled"] is False
    assert result["message"] == "Payment already reconciled"
    assert result["order_status"] == "COMPLETED"
    assert result["payment_status"] == "SUCCESS"

    db_session.refresh(order)
    db_session.refresh(payment)
    db_session.refresh(seller_order)

    assert order.status == "COMPLETED"
    assert payment.status == "SUCCESS"
    assert seller_order.status == "COMPLETED"

    assert payment.razorpay_payment_id == original_payment_id
    assert payment.updated_at == original_updated_at

def test_reconciliation_rejects_amount_mismatch(
    payment_client,
    payment_records,
    mocked_razorpay,
    db_session
):
    order = payment_records["order"]
    payment = payment_records["payment"]
    seller_order = payment_records["seller_order"]

    mocked_razorpay.order.payments.return_value[
        "items"
    ][0]["amount"] = 69900

    response = payment_client.post(
        f"/payments/reconcile/{order.id}"
    )

    assert response.status_code == 409

    db_session.refresh(order)
    db_session.refresh(payment)
    db_session.refresh(seller_order)

    assert order.status == "PENDING"
    assert payment.status == "PENDING"
    assert seller_order.status == "PENDING"
    assert payment.razorpay_payment_id is None

def test_reconciliation_rejects_currency_mismatch(
    payment_client,
    payment_records,
    mocked_razorpay,
    db_session
):
    order = payment_records["order"]
    payment = payment_records["payment"]
    seller_order = payment_records["seller_order"]

    mocked_razorpay.order.payments.return_value[
        "items"
    ][0]["currency"] = "USD"

    response = payment_client.post(
        f"/payments/reconcile/{order.id}"
    )

    assert response.status_code == 409

    db_session.refresh(order)
    db_session.refresh(payment)
    db_session.refresh(seller_order)

    assert order.status == "PENDING"
    assert payment.status == "PENDING"
    assert seller_order.status == "PENDING"
    assert payment.razorpay_payment_id is None

def test_reconciliation_without_captured_payment(
    payment_client,
    payment_records,
    mocked_razorpay,
    db_session
):
    order = payment_records["order"]
    payment = payment_records["payment"]
    seller_order = payment_records["seller_order"]

    mocked_razorpay.order.fetch.return_value[
        "status"
    ] = "created"

    mocked_razorpay.order.fetch.return_value[
        "amount_paid"
    ] = 0

    mocked_razorpay.order.payments.return_value = {
        "count": 0,
        "items": []
    }

    response = payment_client.post(
        f"/payments/reconcile/{order.id}"
    )

    assert response.status_code == 200

    result = response.json()

    assert result["reconciled"] is False
    assert result["order_status"] == "PENDING"
    assert result["payment_status"] == "PENDING"

    db_session.refresh(order)
    db_session.refresh(payment)
    db_session.refresh(seller_order)

    assert order.status == "PENDING"
    assert payment.status == "PENDING"
    assert seller_order.status == "PENDING"
    assert payment.razorpay_payment_id is None

def test_reconciliation_handles_gateway_failure(
    payment_client,
    payment_records,
    mocked_razorpay,
    db_session
):
    order = payment_records["order"]
    payment = payment_records["payment"]
    seller_order = payment_records["seller_order"]

    mocked_razorpay.order.fetch.side_effect = (
        TimeoutError("Simulated Razorpay timeout")
    )

    response = payment_client.post(
        f"/payments/reconcile/{order.id}"
    )

    assert response.status_code == 502

    db_session.refresh(order)
    db_session.refresh(payment)
    db_session.refresh(seller_order)

    assert order.status == "PENDING"
    assert payment.status == "PENDING"
    assert seller_order.status == "PENDING"
    assert payment.razorpay_payment_id is None

    mocked_razorpay.order.payments.assert_not_called()

def test_reconciliation_rejects_another_buyers_order(
    payment_client,
    payment_records,
    mocked_razorpay,
    db_session
):
    order = payment_records["order"]
    payment = payment_records["payment"]

    another_buyer = User(
        name="Another Buyer",
        gmail="another_buyer@example.com",
        password_hash="unused-test-password-hash",
        role="BUYER"
    )

    db_session.add(another_buyer)
    db_session.flush()

    payment_client.app.dependency_overrides[
        get_current_user
    ] = lambda: another_buyer

    response = payment_client.post(
        f"/payments/reconcile/{order.id}"
    )

    assert response.status_code == 404

    db_session.refresh(order)
    db_session.refresh(payment)

    assert order.status == "PENDING"
    assert payment.status == "PENDING"

    mocked_razorpay.order.fetch.assert_not_called()
    mocked_razorpay.order.payments.assert_not_called()

def test_reconciliation_rejects_seller_role(
    payment_client,
    payment_records,
    mocked_razorpay
):
    order = payment_records["order"]

    payment_client.app.dependency_overrides[
        get_current_user
    ] = lambda: payment_records["seller_user"]

    response = payment_client.post(
        f"/payments/reconcile/{order.id}"
    )

    assert response.status_code == 403

    mocked_razorpay.order.fetch.assert_not_called()
    mocked_razorpay.order.payments.assert_not_called()

def test_reconciliation_requires_authentication(
    payment_client,
    payment_records,
    mocked_razorpay
):
    order = payment_records["order"]

    payment_client.app.dependency_overrides.pop(
        get_current_user
    )

    response = payment_client.post(
        f"/payments/reconcile/{order.id}"
    )

    assert response.status_code == 401

    mocked_razorpay.order.fetch.assert_not_called()
    mocked_razorpay.order.payments.assert_not_called()

def test_reconciliation_rolls_back_on_settlement_failure(
    payment_client,
    payment_records,
    mocked_razorpay,
    db_session,
    monkeypatch
):
    order = payment_records["order"]
    payment = payment_records["payment"]
    seller_order = payment_records["seller_order"]

    order_id = order.id
    payment_id = payment.id
    seller_order_id = seller_order.id

    # Preserve the initial records inside the outer
    # test transaction before testing rollback.
    db_session.commit()

    original_settlement = payments.settle_captured_payment

    def failing_settlement(*args, **kwargs):
        original_settlement(*args, **kwargs)

        db_session.flush()

        assert payment.status == "SUCCESS"
        assert order.status == "COMPLETED"
        assert seller_order.status == "COMPLETED"

        raise RuntimeError(
            "Simulated failure before settlement commit"
        )

    monkeypatch.setattr(
        payments,
        "settle_captured_payment",
        failing_settlement
    )

    response = payment_client.post(
        f"/payments/reconcile/{order_id}"
    )

    assert response.status_code == 500

    db_session.expire_all()

    assert order.id == order_id
    assert payment.id == payment_id
    assert seller_order.id == seller_order_id

    assert order.status == "PENDING"
    assert payment.status == "PENDING"
    assert seller_order.status == "PENDING"

    assert payment.razorpay_payment_id is None

def test_reconciliation_settles_multiple_sellers(
    payment_client,
    multi_seller_records,
    mocked_razorpay,
    db_session
):
    records = multi_seller_records

    order = records["order"]
    payment = records["payment"]

    payment_client.app.dependency_overrides[
        get_current_user
    ] = lambda: records["buyer"]

    gateway_order_id = payment.razorpay_order_id
    gateway_payment_id = f"pay_multi_{payment.id}"

    mocked_razorpay.order.fetch.return_value = {
        "id": gateway_order_id,
        "amount": 129800,
        "amount_paid": 129800,
        "currency": "INR",
        "status": "paid"
    }

    mocked_razorpay.order.payments.return_value = {
        "count": 1,
        "items": [
            {
                "id": gateway_payment_id,
                "order_id": gateway_order_id,
                "amount": 129800,
                "currency": "INR",
                "status": "captured",
                "amount_refunded": 0
            }
        ]
    }

    assert order.total_amount == Decimal("1298.00")
    assert payment.amount == order.total_amount

    response = payment_client.post(
        f"/payments/reconcile/{order.id}"
    )

    assert response.status_code == 200, response.text
    assert response.json()["reconciled"] is True

    db_session.refresh(order)
    db_session.refresh(payment)

    seller_orders = (
        db_session.query(SellerOrder)
        .filter(SellerOrder.order_id == order.id)
        .all()
    )

    assert len(seller_orders) == 2

    assert len({
        item.seller_id for item in seller_orders
    }) == 2

    assert all(
        item.status == "COMPLETED"
        for item in seller_orders
    )

    assert order.status == "COMPLETED"
    assert payment.status == "SUCCESS"
    assert payment.razorpay_payment_id == gateway_payment_id

    total_subtotal = sum(
        item.subtotal for item in seller_orders
    )

    total_commission = sum(
        item.commission_amount for item in seller_orders
    )

    total_earnings = sum(
        item.seller_earning for item in seller_orders
    )

    assert total_subtotal == Decimal("1298.00")
    assert total_commission == Decimal("129.80")
    assert total_earnings == Decimal("1168.20")

    assert total_commission + total_earnings == (
        order.total_amount
    )