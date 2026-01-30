from bs4 import BeautifulSoup

def extract_text_html( html : str) -> str:
    """Trích xuất văn bản từ HTML"""
    soup = BeautifulSoup(html, 'html.parser')

    for tag in soup(['script', 'style','canvans','footer','nav']):
        tag.decompose()

    main = soup.find('main') or soup.body or soup.find('header')
    text = main.get_text(separator ='\n')

    return text