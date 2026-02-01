import re
from typing import List
from collections import OrderedDict


def generate_multi_queries(question: str, max_queries: int = 4) -> List[str]:
    """Generate multiple query variations from the original question to improve retrieval."""

    queries = OrderedDict()

    # Tier 0 – Original query (must-have)
    queries["original"] = question.strip()

    # Tier 1 – Simplified (remove question words)
    simplified = _simplify_query(question)
    if simplified:
        queries["simplified"] = simplified

    # Tier 2 – Decomposed (only if complex)
    sub_queries = _decompose_question(question)
    if sub_queries:
        queries["decomposed"] = sub_queries[0]

    # Tier 3 – Keyword-only (fallback)
    keywords = _extract_keywords(question)
    if keywords:
        queries["keywords"] = " ".join(keywords[:5])

    return list(queries.values())[:max_queries]



def _decompose_question(question: str) -> List[str]:
    patterns = [
        r'(.+?)\s+và\s+(.+)',
        r'(.+?)\s+hoặc\s+(.+)',
        r'(.+?),\s*(.+)',
    ]

    sub_queries = []
    for pattern in patterns:
        matches = re.findall(pattern, question, re.IGNORECASE)
        for match in matches:
            for part in match:
                if len(part.strip()) > 12:
                    sub_queries.append(part.strip())

    return sub_queries


def _simplify_query(question: str) -> str:
    patterns = [
        r'là gì\s*\?*',
        r'như thế nào\s*\?*',
        r'tại sao\s*\?*',
        r'khi nào\s*\?*',
        r'ở đâu\s*\?*',
        r'ai\s*\?*',
    ]

    simplified = question
    for p in patterns:
        simplified = re.sub(p, '', simplified, flags=re.IGNORECASE)

    simplified = re.sub(r'\s+', ' ', simplified).strip()

    if len(simplified) >= len(question) * 0.5:
        return simplified
    return ""


def _extract_keywords(text: str) -> List[str]:
    stopwords = {'là', 'của', 'và', 'các', 'cho', 'với', 'như', 'từ', 'có'}

    words = re.findall(r'\b[\wÀ-ỹ]{3,}\b', text.lower())
    keywords = [w for w in words if w not in stopwords]

    return list(dict.fromkeys(keywords))
