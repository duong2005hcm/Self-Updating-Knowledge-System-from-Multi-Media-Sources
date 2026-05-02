from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Optional

from backend.app.config.openai_factory import get_openai_client

logger = logging.getLogger(__name__)

DEFAULT_MEDICAL_WARNING = (
    "Thông tin chỉ phục vụ tham khảo, không thay thế tư vấn, chẩn đoán hoặc điều trị "
    "từ bác sĩ/chuyên gia y tế."
)
SUMMARY_MODEL = os.getenv("DOCUMENT_SUMMARY_MODEL", "gpt-4o-mini")
SUMMARY_MAX_INPUT_CHARS = max(int(os.getenv("DOCUMENT_SUMMARY_MAX_INPUT_CHARS", "12000")), 2000)
SUMMARY_MAX_TOKENS = max(int(os.getenv("DOCUMENT_SUMMARY_MAX_TOKENS", "900")), 300)


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip()


def _trim_context(value: str) -> str:
    text = _clean_text(value)
    if len(text) <= SUMMARY_MAX_INPUT_CHARS:
        return text

    half = int(SUMMARY_MAX_INPUT_CHARS / 2)
    return f"{text[:half]}\n...\n{text[-half:]}"


def _extract_json(content: str) -> dict[str, Any]:
    raw = (content or "").strip()
    if not raw:
        return {}

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", raw, flags=re.DOTALL)
        if not match:
            return {}
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return {}


def _normalize_list(value: Any, limit: int = 10) -> list[str]:
    if isinstance(value, str):
        items = [item.strip() for item in re.split(r"[,;\n]", value)]
    elif isinstance(value, list):
        items = [str(item).strip() for item in value]
    else:
        items = []
    return [item for item in items if item][:limit]


def normalize_ai_summary(value: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
    if not value:
        return None

    summary = _clean_text(str(value.get("summary") or ""))[:3000]
    key_points = _normalize_list(value.get("key_points"))
    suggested_tags = _normalize_list(value.get("suggested_tags"))
    suggested_topic = _clean_text(str(value.get("suggested_topic") or ""))[:120]
    medical_warning = _clean_text(str(value.get("medical_warning") or "")) or DEFAULT_MEDICAL_WARNING

    if not summary and not key_points:
        return None

    return {
        "summary": summary,
        "key_points": key_points,
        "medical_warning": medical_warning,
        "suggested_tags": suggested_tags,
        "suggested_topic": suggested_topic,
    }


class DocumentSummaryService:
    def __init__(self, openai_client=None):
        self._client = openai_client

    def generate_summary(
        self,
        *,
        title: str,
        source_type: str,
        text: str,
    ) -> Optional[dict[str, Any]]:
        context = _trim_context(text)
        if len(context) < 80:
            return None

        prompt = f"""
Hãy tóm tắt tài liệu y tế/sức khỏe sau thành bản tóm tắt ngắn cho admin kiểm duyệt.
Không đưa chẩn đoán, không đưa chỉ định điều trị cá nhân, không khẳng định thay bác sĩ.
Chỉ tóm tắt nội dung tài liệu và đề xuất tag/topic để quản trị kho tri thức.

Trả về JSON hợp lệ đúng schema:
{{
  "summary": "...",
  "key_points": ["...", "..."],
  "suggested_tags": ["..."],
  "suggested_topic": "...",
  "medical_warning": "{DEFAULT_MEDICAL_WARNING}"
}}

Tiêu đề: {title}
Loại nguồn: {source_type}
Nội dung:
{context}
""".strip()

        try:
            client = self._client or get_openai_client()
            response = client.chat.completions.create(
                model=SUMMARY_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": "Bạn tạo JSON summary để admin duyệt nội dung y tế tham khảo.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                max_tokens=SUMMARY_MAX_TOKENS,
                response_format={"type": "json_object"},
            )
            content = response.choices[0].message.content or ""
            return normalize_ai_summary(_extract_json(content))
        except Exception as exc:
            logger.warning("AI summary generation failed for title='%s': %s", title, str(exc))
            return None
