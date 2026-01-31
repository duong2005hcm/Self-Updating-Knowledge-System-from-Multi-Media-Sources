from bs4 import BeautifulSoup
from readability import Document

def clean_docs(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["nav", "footer", "aside", "script", "style"]):
        tag.decompose()
    return soup.get_text("\n")


def clean_news(html: str) -> str:
    doc = Document(html)
    content = doc.summary(html_partial=True)
    soup = BeautifulSoup(content, "html.parser")

    for tag in soup(["figure", "figcaption", "aside"]):
        tag.decompose()

    paragraphs = [
        p.get_text().strip()
        for p in soup.find_all("p")
        if len(p.get_text().strip()) > 40
    ]
    return "\n".join(paragraphs)


def clean_ecommerce(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")

    title = soup.find("h1")
    desc = soup.find("div", {"class": "description"})

    return {
        "title": title.get_text(strip=True) if title else "",
        "description": desc.get_text("\n", strip=True) if desc else ""
    }
