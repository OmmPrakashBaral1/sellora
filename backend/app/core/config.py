
import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[2]

load_dotenv(BASE_DIR / ".env")


MAX_UPLOAD_SIZE_MB = int(
    os.getenv("MAX_UPLOAD_SIZE_MB", "100")
)

PRIVATE_STORAGE_DIR = Path(
    os.getenv(
        "PRIVATE_STORAGE_DIR",
        str(BASE_DIR / "private_uploads")
    )
).resolve()

MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024


if MAX_UPLOAD_SIZE_MB <= 0:
    raise ValueError("MAX_UPLOAD_SIZE_MB must be greater than zero")
