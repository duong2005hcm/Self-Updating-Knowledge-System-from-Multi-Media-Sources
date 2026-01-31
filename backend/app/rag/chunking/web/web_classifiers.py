def classify_web(url: str) -> str:
    url = url.lower()

    if any(k in url for k in ["docs", "documentation", "guide", "wiki"]):
        return "docs"

    if any(k in url for k in ["shop", "product", "item"]):
        return "ecommerce"

    if any(k in url for k in ["news", "vnexpress", "tuoitre", "zing","thanhnien"]):
        return "news"

    return "docs"
