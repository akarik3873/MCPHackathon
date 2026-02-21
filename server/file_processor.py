import base64
import io
import math
from PIL import Image
from PyPDF2 import PdfReader

IMAGE_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp"}
TEXT_TYPES = {"text/plain", "text/csv", "text/markdown", "application/json"}
PDF_TYPES = {"application/pdf"}
SUPPORTED_TYPES = IMAGE_TYPES | TEXT_TYPES | PDF_TYPES
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB


def validate_file(content_type: str, size: int):
    if content_type not in SUPPORTED_TYPES:
        raise ValueError(f"Unsupported file type: {content_type}")
    if size > MAX_FILE_SIZE:
        raise ValueError(f"File too large. Maximum size is 20MB.")


async def process_file(file) -> dict:
    content = await file.read()
    content_type = file.content_type
    validate_file(content_type, len(content))

    if content_type in IMAGE_TYPES:
        return process_image(content, content_type)
    elif content_type in PDF_TYPES:
        return process_pdf(content)
    else:
        return process_text(content)


def process_image(content: bytes, content_type: str) -> dict:
    img = Image.open(io.BytesIO(content))
    img.verify()

    b64 = base64.b64encode(content).decode("utf-8")
    data_url = f"data:{content_type};base64,{b64}"

    img = Image.open(io.BytesIO(content))
    width, height = img.size
    tokens = estimate_image_tokens(width, height)

    return {
        "type": "image",
        "data_url": data_url,
        "estimated_tokens": tokens,
        "width": width,
        "height": height,
    }


def estimate_image_tokens(width: int, height: int) -> int:
    # GPT-4o image token estimation based on tile count
    LOW_DETAIL_TOKENS = 85
    TILE_TOKENS = 170
    TILE_SIZE = 512

    if width <= 512 and height <= 512:
        return LOW_DETAIL_TOKENS

    # Scale down to fit within 2048x2048
    if max(width, height) > 2048:
        scale = 2048 / max(width, height)
        width = int(width * scale)
        height = int(height * scale)

    # Scale so shortest side is 768
    if min(width, height) > 768:
        scale = 768 / min(width, height)
        width = int(width * scale)
        height = int(height * scale)

    tiles_x = math.ceil(width / TILE_SIZE)
    tiles_y = math.ceil(height / TILE_SIZE)
    total_tiles = tiles_x * tiles_y

    return LOW_DETAIL_TOKENS + (TILE_TOKENS * total_tiles)


def process_pdf(content: bytes) -> dict:
    reader = PdfReader(io.BytesIO(content))
    text_parts = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            text_parts.append(text)

    full_text = "\n\n".join(text_parts)
    tokens = estimate_text_tokens(full_text)

    return {
        "type": "text",
        "content": full_text,
        "estimated_tokens": tokens,
        "pages": len(reader.pages),
    }


def process_text(content: bytes) -> dict:
    text = content.decode("utf-8", errors="replace")
    tokens = estimate_text_tokens(text)

    return {
        "type": "text",
        "content": text,
        "estimated_tokens": tokens,
    }


def estimate_text_tokens(text: str) -> int:
    return max(1, len(text) // 4)
