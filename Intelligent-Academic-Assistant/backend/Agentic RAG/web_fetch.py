# web_fetch.py
from duckduckgo_search import DDGS

def fetch_web_data(query: str, top_k: int = 3) -> list:
    """
    Fetch data from web using DuckDuckGo search and return top_k text chunks.
    """
    chunks = []
    with DDGS() as ddgs:
        results = ddgs.text(query, max_results=top_k)
        for r in results:
            body = r.get("body", "").strip()
            if body:
                chunks.append(body)
            if len(chunks) >= top_k:
                break
    return chunks
