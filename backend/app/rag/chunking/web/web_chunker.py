import requests
from bs4 import BeautifulSoup

def fetch_web_content(url: str) -> str:
    """Lấy nội dung text từ trang web"""
    headers = {
        "User-Agent":"Mozilla/5.0"
    }
    
    resp = requests.get(url , headers = headers , timeout=15)
    resp.raise_for_status()
    return resp.text