import asyncio
import urllib.robotparser
from urllib.parse import urlparse


class RobotsChecker:
    def __init__(self, user_agent="*"):
        self.user_agent = user_agent
        self.parsers = {}

    async def allowed(self, url: str) -> bool:
        domain = urlparse(url).netloc

        if domain not in self.parsers:
            self.parsers[domain] = await asyncio.to_thread(self._fetch_robots, domain)

        return self.parsers[domain].can_fetch(self.user_agent, url)

    def _fetch_robots(self, domain: str) -> urllib.robotparser.RobotFileParser:
        rp = urllib.robotparser.RobotFileParser()
        rp.set_url(f"https://{domain}/robots.txt")
        try:
            rp.read()
        except Exception:
            # If robots.txt is unreachable, fail open — assume allowed
            rp.allow_all = True
        return rp