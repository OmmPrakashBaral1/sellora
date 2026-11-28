
import re
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import (
    MAX_UPLOAD_SIZE_BYTES,
    PRIVATE_STORAGE_DIR,
)


ALLOWED_FILE_TYPES = {
    ".zip": {"application/zip", "application/x-zip-compressed"},
    ".pdf": {"application/pdf"},
    ".png": {"image/png"},
    ".jpg": {"image/jpeg"},
    ".jpeg": {"image/jpeg"},
    ".mp3": {"audio/mpeg", "audio/mp3"},
    ".mp4": {"video/mp4"},
}


def validate_file_signature(extension: str, header: bytes) -> bool:
    """Check whether the file begins with an expected file signature."""

    signatures = {
        ".pdf": lambda data: data.startswith(b"%PDF-"),
        ".png": lambda data: data.startswith(
            b"\x89PNG\r\n\x1a\n"
        ),
        ".jpg": lambda data: data.startswith(b"\xff\xd8\xff"),
        ".jpeg": lambda data: data.startswith(b"\xff\xd8\xff"),
        ".mp3": lambda data: (
            data.startswith(b"ID3")
            or (
                len(data) >= 2
                and data[0] == 0xFF
                and (data[1] & 0xE0) == 0xE0
            )
        ),
        ".mp4": lambda data: (
            len(data) >= 8 and data[4:8] == b"ftyp"
        ),
        ".zip": lambda data: (
            data.startswith(b"PK\x03\x04")
            or data.startswith(b"PK\x05\x06")
            or data.startswith(b"PK\x07\x08")
        ),
    }

    validator = signatures.get(extension)

    return bool(validator and validator(header))


def validate_filename(filename: str) -> str:
    """Extract and validate the file extension."""

    if not filename or "\x00" in filename:
        raise HTTPException(
            status_code=400,
            detail="Invalid filename."
        )

    extension = Path(filename).suffix.lower()

    if extension not in ALLOWED_FILE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type."
        )

    return extension


async def save_private_file(file: UploadFile) -> str:
    """
    Validate and save an uploaded file in private storage.

    Returns the generated storage key, not the filesystem path.
    """

    extension = validate_filename(file.filename or "")

    content_type = (file.content_type or "").lower().strip()

    if content_type not in ALLOWED_FILE_TYPES[extension]:
        raise HTTPException(
            status_code=400,
            detail="File MIME type does not match the extension."
        )

    storage_key = f"{uuid.uuid4().hex}{extension}"

    PRIVATE_STORAGE_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    destination = PRIVATE_STORAGE_DIR / storage_key

    total_size = 0
    header = bytearray()

    try:
        with destination.open("xb") as destination_file:

            while True:
                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                total_size += len(chunk)

                if total_size > MAX_UPLOAD_SIZE_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail="File exceeds the maximum upload size."
                    )

                if len(header) < 16:
                    header.extend(chunk[:16 - len(header)])

                destination_file.write(chunk)

        if not validate_file_signature(
            extension,
            bytes(header)
        ):
            raise HTTPException(
                status_code=400,
                detail="File content does not match its extension."
            )

        if total_size == 0:
            raise HTTPException(
                status_code=400,
                detail="Empty files are not allowed."
            )

        return storage_key

    except Exception:
        destination.unlink(missing_ok=True)
        raise

    finally:
        await file.close()



def get_private_file_path(storage_key: str) -> Path:
    """
    Resolve a private storage key to a safe physical file.

    Reject invalid keys, symbolic links, paths outside
    private storage, and missing files.
    """

    if not isinstance(storage_key, str) or not re.fullmatch(
        r"[a-f0-9]{32}\.(zip|pdf|png|jpg|jpeg|mp3|mp4)",
        storage_key
    ):
        raise HTTPException(
            status_code=404,
            detail="File not found."
        )

    try:
        storage_root = PRIVATE_STORAGE_DIR.resolve(strict=True)

        candidate = storage_root / storage_key

        if candidate.is_symlink():
            raise HTTPException(
                status_code=404,
                detail="File not found."
            )

        file_path = candidate.resolve(strict=True)

        if (
            file_path.parent != storage_root
            or not file_path.is_file()
        ):
            raise HTTPException(
                status_code=404,
                detail="File not found."
            )

    except (OSError, RuntimeError, ValueError):
        raise HTTPException(
            status_code=404,
            detail="File not found."
        )

    return file_path