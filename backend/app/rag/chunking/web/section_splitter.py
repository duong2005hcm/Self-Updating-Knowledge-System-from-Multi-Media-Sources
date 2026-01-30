import re

def split_by_heading(text: str) -> list[str]:
    sections = re.split(r"\n(?=\d+\.[A-Z][^a-z]{3,100})", text)
    return [s.strip() for s in sections if len(s.strip()) > 200]
