from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Iterable, Optional

MEDICAL_SYNONYM_MAP: dict[str, list[str]] = {
    "cum": ["cum mua", "influenza", "ho hap", "virus cum"],
    "tieu duong": ["dai thao duong", "diabetes"],
    "tim mach": ["huyet ap", "cardiovascular", "benh tim"],
    "cham noi": ["cham phat trien ngon ngu", "roi loan ngon ngu", "tre cham noi", "speech delay"],
    "sot xuat huyet": ["dengue", "sot dengue"],
}


@dataclass
class QueryBundle:
    raw: str
    normalized: str
    stripped: str
    terms: list[str]
    phrases: list[str]


@dataclass
class RelevanceAnalysis:
    score: float
    lexical_score: float
    metadata_score: float
    matched_fields: list[str] = field(default_factory=list)
    overlap_count: int = 0
    overlap_ratio: float = 0.0
    has_phrase_match: bool = False
    reason: str = ""


def collapse_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def normalize_vietnamese_text(value: Optional[str]) -> str:
    return collapse_spaces(value or "").lower()


def remove_vietnamese_diacritics(value: Optional[str]) -> str:
    normalized = normalize_vietnamese_text(value).replace("đ", "d")
    decomposed = unicodedata.normalize("NFD", normalized)
    without_marks = "".join(
        character for character in decomposed if unicodedata.category(character) != "Mn"
    )
    return collapse_spaces(re.sub(r"[^a-z0-9\s]", " ", without_marks))


def tokenize_query(value: Optional[str]) -> list[str]:
    return [
        token
        for token in re.findall(r"[a-z0-9]+", remove_vietnamese_diacritics(value), flags=re.UNICODE)
        if len(token.strip()) >= 2
    ]


def unique_values(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    items: list[str] = []
    for value in values:
        normalized = str(value or "").strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        items.append(normalized)
    return items


def expand_medical_synonyms(query: str) -> list[str]:
    stripped = remove_vietnamese_diacritics(query)
    phrases = [stripped] if stripped else []

    for key, synonyms in MEDICAL_SYNONYM_MAP.items():
        normalized_key = remove_vietnamese_diacritics(key)
        normalized_synonyms = [remove_vietnamese_diacritics(item) for item in synonyms]
        if normalized_key and normalized_key in stripped:
            phrases.extend([normalized_key, *normalized_synonyms])
            continue
        if any(item and item in stripped for item in normalized_synonyms):
            phrases.extend([normalized_key, *normalized_synonyms])

    return unique_values(phrases)


def build_query_bundle(query: str) -> QueryBundle:
    normalized = normalize_vietnamese_text(query)
    stripped = remove_vietnamese_diacritics(normalized)
    phrases = expand_medical_synonyms(normalized)
    terms = unique_values([token for phrase in phrases for token in tokenize_query(phrase)])
    return QueryBundle(
        raw=query,
        normalized=normalized,
        stripped=stripped,
        terms=terms,
        phrases=phrases,
    )


def _field_match_score(bundle: QueryBundle, value: str, *, phrase_boost: float) -> tuple[float, set[str], bool]:
    normalized = remove_vietnamese_diacritics(value)
    if not normalized:
        return 0.0, set(), False

    matched_terms = {
        term
        for term in bundle.terms
        if term in normalized
    }
    phrase_match = any(phrase and phrase in normalized for phrase in bundle.phrases)
    base_score = len(matched_terms) / max(len(bundle.terms), 1) if bundle.terms else 0.0
    score = max(base_score, phrase_boost if phrase_match else 0.0)
    return min(score, 1.0), matched_terms, phrase_match


def compute_lexical_score(bundle: QueryBundle, candidate_text: str) -> float:
    score, _, _ = _field_match_score(bundle, candidate_text, phrase_boost=0.9)
    return score


def analyze_candidate_relevance(
    bundle: QueryBundle,
    *,
    title: str = "",
    summary: str = "",
    content: str = "",
    topic: str = "",
    tags: Optional[Iterable[str]] = None,
    source_name: str = "",
    source_url: str = "",
) -> RelevanceAnalysis:
    tags_text = " ".join(tag for tag in (tags or []) if tag)
    title_score, title_terms, title_phrase = _field_match_score(bundle, title, phrase_boost=1.0)
    summary_score, summary_terms, summary_phrase = _field_match_score(bundle, summary, phrase_boost=0.88)
    content_score, content_terms, content_phrase = _field_match_score(bundle, content, phrase_boost=0.82)
    topic_score, topic_terms, topic_phrase = _field_match_score(bundle, topic, phrase_boost=0.95)
    tag_score, tag_terms, tag_phrase = _field_match_score(bundle, tags_text, phrase_boost=0.92)
    source_score, source_terms, source_phrase = _field_match_score(
        bundle,
        " ".join([source_name, source_url]),
        phrase_boost=0.75,
    )

    metadata_score = min(
        1.0,
        (0.45 * title_score)
        + (0.20 * topic_score)
        + (0.20 * tag_score)
        + (0.15 * source_score),
    )
    lexical_score = min(
        1.0,
        max(
            content_score,
            summary_score,
            (0.55 * content_score)
            + (0.20 * summary_score)
            + (0.25 * max(title_score, topic_score, tag_score)),
        ),
    )

    matched_terms = set().union(
        title_terms,
        summary_terms,
        content_terms,
        topic_terms,
        tag_terms,
        source_terms,
    )
    overlap_count = len(matched_terms)
    overlap_ratio = overlap_count / max(len(bundle.terms), 1)
    matched_fields: list[str] = []
    if title_score > 0:
        matched_fields.append("title")
    if summary_score > 0:
        matched_fields.append("summary")
    if content_score > 0:
        matched_fields.append("content")
    if topic_score > 0:
        matched_fields.append("topic")
    if tag_score > 0:
        matched_fields.append("tag")
    if source_score > 0:
        matched_fields.append("source")

    has_phrase_match = any([title_phrase, summary_phrase, content_phrase, topic_phrase, tag_phrase, source_phrase])
    if title_phrase or topic_phrase or tag_phrase:
        reason = "matched phrase in metadata"
    elif summary_phrase or content_phrase:
        reason = "matched phrase in content"
    elif overlap_count > 0 and "content" in matched_fields:
        reason = "matched query terms in content"
    elif overlap_count > 0:
        reason = "matched query terms in metadata"
    else:
        reason = "low lexical overlap"

    score = min(1.0, (0.75 * lexical_score) + (0.25 * metadata_score))
    return RelevanceAnalysis(
        score=score,
        lexical_score=lexical_score,
        metadata_score=metadata_score,
        matched_fields=matched_fields,
        overlap_count=overlap_count,
        overlap_ratio=overlap_ratio,
        has_phrase_match=has_phrase_match,
        reason=reason,
    )


def is_relevant_to_query(
    bundle: QueryBundle,
    analysis: RelevanceAnalysis,
    *,
    min_score: float = 0.35,
    strong_semantic_score: float = 0.55,
    min_lexical_score: float = 0.15,
    semantic_score: Optional[float] = None,
) -> bool:
    if semantic_score is not None and semantic_score >= strong_semantic_score:
        return True
    if analysis.has_phrase_match:
        return True
    if analysis.overlap_count == 0:
        return False
    if analysis.lexical_score < min_lexical_score:
        return False
    if semantic_score is not None and semantic_score >= min_score and analysis.overlap_ratio > 0:
        return True
    return analysis.score >= min_score or analysis.overlap_ratio >= 0.5
