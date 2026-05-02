import logging
from typing import Any, AsyncGenerator

from backend.app.config.openai_factory import get_openai_client
from backend.app.rag.prompting.prompt_registry import (
    PROMPT_SCOPE_CASUAL,
    PROMPT_SCOPE_PROFESSIONAL,
    get_prompt,
)

client = get_openai_client()
logger = logging.getLogger(__name__)

MEDICAL_DISCLAIMER = (
    "Lưu ý: Thông tin trên chỉ phục vụ tham khảo, không thay thế tư vấn/chẩn đoán/điều trị "
    "từ bác sĩ. Nếu bạn có triệu chứng nghiêm trọng, kéo dài hoặc bất thường, hãy đến cơ sở y tế "
    "hoặc bệnh viện để được thăm khám."
)

MANDATORY_MEDICAL_SYSTEM_PROMPT = """
Ban la tro ly tra cuu tri thuc suc khoe. Ban chi duoc tra loi dua tren cac doan tai lieu duoc cung cap trong CONTEXT.
Khong duoc bia thong tin, khong suy doan ngoai nguon, khong tu chan doan benh va khong dua phac do dieu tri ca nhan hoa.
Neu CONTEXT khong du thong tin, hay noi ro rang kho tri thuc chua co du du lieu phu hop.

Quy tac bat buoc:
1. Tra loi bang tieng Viet.
2. Dua tren context da truy xuat.
3. Neu co du lieu, mo dau bang cum nhu "Dua tren cac tai lieu trong kho tri thuc..." hoac "Theo tai lieu duoc truy xuat...".
4. Neu thieu du lieu, phai noi ro "Minh chua tim thay tai lieu du lien quan trong kho tri thuc de tra loi chac chan."
5. Khong duoc dung cac cau nhu:
   - "Chac chan ban bi..."
   - "Ban nen uong thuoc..."
   - "Khong can di kham..."
6. Khi tra loi ve trieu chung, benh, thuoc, dieu tri hoac suc khoe, luon nhac rang thong tin chi mang tinh tham khao
   va khong thay the tu van, chan doan hoac dieu tri tu bac si/chuyen gia y te.
7. Neu nguoi dung co trieu chung nghiem trong, keo dai, bat thuong hoac dang lo lang ve suc khoe,
   hay khuyen den co so y te/benh vien de duoc tham kham.
8. Cuoi cau tra loi phai co dung doan sau:
   "Luu y: Thong tin tren chi phuc vu tham khao, khong thay the tu van/chan doan/dieu tri tu bac si.
   Neu ban co trieu chung nghiem trong, keo dai hoac bat thuong, hay den co so y te hoac benh vien de duoc tham kham."

Format uu tien:
- Mo dau ngan gon dua tren context.
- Muc "Y chinh:" voi cac y 1, 2, 3 neu co.
- Muc "Nguon tham khao:" liet ke cac nguon da dung.
- Ket thuc bang phan "Luu y y te:".
""".strip()


def build_messages(system_prompt: str, question: str, history: list[dict[str, Any]]) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]

    for msg in history[-5:]:
        role = msg.get("role", "user")
        content = str(msg.get("content", ""))

        if role == "system":
            messages.append({"role": "user", "content": f"[Summary]\n{content}"})
        else:
            messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": question})
    return messages


def build_casual_fallback_answer() -> str:
    return (
        "Chào bạn. Bạn có thể đặt câu hỏi về tài liệu, chủ đề sức khỏe hoặc nội dung có trong kho tri thức, "
        "mình sẽ cố gắng trả lời dựa trên các nguồn đã được truy xuất.\n\n"
        f"{MEDICAL_DISCLAIMER}"
    )


def build_no_context_answer() -> str:
    return (
        "Hiện mình chưa tìm thấy tài liệu đủ liên quan trong kho tri thức để trả lời câu hỏi này. "
        "Bạn có thể thử dùng từ khóa khác hoặc xem thêm tài liệu từ nguồn y tế chính thống.\n\n"
        f"{MEDICAL_DISCLAIMER}"
    )


def ensure_medical_disclaimer(answer: str) -> str:
    normalized_answer = (answer or "").strip()
    if not normalized_answer:
        return MEDICAL_DISCLAIMER

    lowered = normalized_answer.lower()
    if (
        ("lưu ý:" in lowered or "luu y:" in lowered)
        and ("tham khảo" in lowered or "tham khao" in lowered)
        and ("bác sĩ" in lowered or "bac si" in lowered)
    ):
        return normalized_answer
    return f"{normalized_answer}\n\n{MEDICAL_DISCLAIMER}"


def _build_context_text(contexts: list[dict[str, Any]]) -> str:
    rows = []
    for index, context_item in enumerate(contexts):
        metadata = context_item.get("metadata") or {}
        title = str(context_item.get("title") or metadata.get("title") or f"Context {index + 1}")
        collection_name = str(context_item.get("collection") or metadata.get("collection") or "")
        source_url = str(context_item.get("source_url") or metadata.get("source_url") or metadata.get("url") or "")
        page = context_item.get("page") or metadata.get("page_start") or metadata.get("page_numbers") or ""
        score = context_item.get("score") or metadata.get("score")
        text = str(context_item.get("text") or context_item.get("content") or "")

        rows.append(
            "\n".join(
                [
                    f"[{index}] title: {title}",
                    f"collection: {collection_name or 'unknown'}",
                    f"source_url: {source_url or 'N/A'}",
                    f"page: {page or 'N/A'}",
                    f"score: {score if score is not None else 'N/A'}",
                    f"content: {text}",
                ]
            )
        )
    return "\n\n".join(rows)


def _render_professional_system_prompt(template: str, context_text: str) -> str:
    base_template = template.strip() if template else get_prompt(PROMPT_SCOPE_PROFESSIONAL).strip()
    if "{context_text}" in base_template:
        contextual = base_template.replace("{context_text}", context_text)
    else:
        contextual = (
            f"{base_template}\n\n"
            f"CONTEXT:\n{context_text}\n\n"
            "Rules:\n"
            "- Answer based on context.\n"
            "- If not found, say you do not know.\n"
            "- Cite sources like [0], [1]."
        )

    return f"{MANDATORY_MEDICAL_SYSTEM_PROMPT}\n\n{contextual}".strip()


async def generate_professional_answer(
    question: str,
    contexts: list[dict[str, Any]],
    history: list[dict[str, Any]],
    system_prompt_template: str | None = None,
) -> AsyncGenerator[str, None]:
    context_text = _build_context_text(contexts)
    template = (system_prompt_template or get_prompt(PROMPT_SCOPE_PROFESSIONAL)).strip()
    professional_system_prompt = _render_professional_system_prompt(template, context_text)

    messages = build_messages(
        system_prompt=professional_system_prompt,
        question=question,
        history=history,
    )

    try:
        stream = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            stream=True,
        )

        for chunk in stream:
            delta = ""
            if chunk.choices and chunk.choices[0].delta:
                delta = chunk.choices[0].delta.content or ""

            if delta:
                yield delta
    except Exception as e:
        logger.exception("Streaming professional answer failed: %s", str(e))
        raise


def generate_casual_answer(
    question: str,
    history: list[dict[str, Any]],
    system_prompt: str | None = None,
) -> str:
    casual_system_prompt = (system_prompt or get_prompt(PROMPT_SCOPE_CASUAL)).strip()

    messages = build_messages(
        system_prompt=casual_system_prompt,
        question=question,
        history=history,
    )

    return client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
    ).choices[0].message.content


def generate_web_answer(
    question: str,
    contexts: list[dict[str, Any]],
    history: list[dict[str, Any]],
    system_prompt_template: str | None = None,
) -> str:
    context_text = _build_context_text(contexts)

    template = (system_prompt_template or get_prompt(PROMPT_SCOPE_PROFESSIONAL)).strip()
    web_system_prompt = _render_professional_system_prompt(template, context_text)

    messages = build_messages(
        system_prompt=web_system_prompt,
        question=question,
        history=history,
    )

    return client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
    ).choices[0].message.content
