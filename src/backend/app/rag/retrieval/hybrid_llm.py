def keyword_score(query: str, text: str) -> float:
    q_words = set(query.lower().split())
    t_words = set(text.lower().split())

    if not q_words:
        return 0.0

    return len(q_words & t_words) / len(q_words)