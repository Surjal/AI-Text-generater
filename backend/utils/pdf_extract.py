from __future__ import annotations

from typing import BinaryIO


def extract_text_from_pdf(file_stream: BinaryIO) -> str:
    from pypdf import PdfReader

    reader = PdfReader(file_stream)
    parts: list[str] = []
    for page in reader.pages:
        t = page.extract_text()
        if t:
            parts.append(t)
    return "\n".join(parts).strip()
