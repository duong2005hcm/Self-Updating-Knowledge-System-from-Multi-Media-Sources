import re

def classify_document(profile: dict, sample_text: str) -> str:
    """Phân loại tài liệu dựa trên profile và mẫu text"""
    pages = profile.get("pages")
    destiny = profile.get("chars_per_page")
    
    text_lower = sample_text.lower()
    
# LAW DOCUMENT

    law_keywords = [
        r"điều\s+\d+",
        r"khoản\s+\d+",
        r"theo quy định",
        r"căn cứ pháp lý"
    ]
    if any(re.search(keyword, text_lower) for keyword in law_keywords):
        return "law_document"
    
    papers_keywords = [
        "abstract",
        "introduction",
        "methodology",
        "results",
        "discussion",
        "references"
    ]
    if pages < 50 and any(k in text_lower for k in papers_keywords):
        return "academic_paper"
    
    if pages >= 100:
        return "textbook"
    
    if pages < 40:
        return "short_doc"

    return "unknown"