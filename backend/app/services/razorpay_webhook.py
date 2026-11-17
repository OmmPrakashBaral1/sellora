import hashlib
import hmac


def verify_webhook_signature(
    body: bytes,
    signature: str,
    secret: str
) -> bool:
    """
    Verify Razorpay webhook signature using HMAC-SHA256.
    """

    if not secret:
        raise RuntimeError("Razorpay webhook secret is not configured")

    if not signature:
        return False

    expected_signature = hmac.new(
        secret.encode("utf-8"),
        body,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(
        expected_signature,
        signature.strip()
    )
