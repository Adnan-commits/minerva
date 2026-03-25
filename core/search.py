import os
from tavily import TavilyClient
from dotenv import load_dotenv

load_dotenv()

async def web_search(query: str, max_results: int = 5) -> str:
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        raise ValueError("TAVILY_API_KEY not found in environment variables")
    
    client = TavilyClient(api_key=api_key)
    response = client.search(query=query, max_results=max_results)

    results = []
    for i, r in enumerate(response["results"], 1):
        results.append(
            f"Result {i}:\n"
            f"  Title: {r['title']}\n"
            f"  URL: {r['url']}\n"
            f"  Summary: {r['content']}\n"
        )

    return "\n---\n".join(results)
