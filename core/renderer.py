import asyncio
import httpx
from playwright.async_api import async_playwright
from utils.structured_logger import StructuredLogger
from pathlib import Path

logger = StructuredLogger("renderer")

SCREENSHOT_DIR = Path("screenshots")
SCREENSHOT_DIR.mkdir(exist_ok=True)


class StaticRenderer:
    async def render(self, url: str, request_id: str) -> str:
        logger.info("static_render_start", request_id=request_id, url=url)
        async with httpx.AsyncClient(timeout=10, headers={"User-Agent": "MCPBot/1.0"}) as client:
            r = await client.get(url)
            logger.info("static_render_done", request_id=request_id, bytes=len(r.text))
            return r.text


class BrowserRenderer:
    async def render(self, url: str, request_id: str, slow: bool = False) -> str:
        logger.info("browser_render_start", request_id=request_id, url=url, slow=slow)

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(user_agent="MCPBot/1.0")
            page = await context.new_page()

            try:
                await page.goto(url, wait_until="domcontentloaded")
                await self._wait_for_content(page, request_id, slow)

                if await self._detect_captcha(page):
                    screenshot = await self._take_screenshot(page, request_id, "captcha")
                    raise RuntimeError(f"captcha_detected:{screenshot}")

                html = await page.content()

                if len(html) < 500:
                    screenshot = await self._take_screenshot(page, request_id, "empty")
                    raise RuntimeError(f"rendered_html_too_small:{screenshot}")

                logger.info("browser_render_done", request_id=request_id, bytes=len(html))
                return html

            except Exception as e:
                try:
                    screenshot = await self._take_screenshot(page, request_id, "error")
                except Exception:
                    screenshot = None
                logger.error("browser_render_failed", request_id=request_id, error=str(e), screenshot=screenshot)
                raise

            finally:
                await context.close()
                await browser.close()

    async def _wait_for_content(self, page, request_id: str, slow: bool):
        async def text_len():
            return await page.evaluate("document.body.innerText.length")

        last = -1
        stable = 0
        timeout = 20 if slow else 12

        for i in range(timeout):
            size = await text_len()
            logger.info("render_poll", request_id=request_id, second=i, text_len=size)

            if size > 100 and abs(size - last) < 50:
                stable += 1
                if stable >= 2:
                    return
            else:
                stable = 0

            last = size
            await asyncio.sleep(1)

        # If we have any content at all, don't fail — just return what we have
        if await text_len() > 100:
            logger.info("render_poll_timeout_with_content", request_id=request_id)
            return

        raise RuntimeError("content_never_stabilized")

    async def _take_screenshot(self, page, request_id: str, reason: str):
        path = SCREENSHOT_DIR / f"{request_id}_{reason}.png"
        await page.screenshot(path=str(path), full_page=True)
        return str(path)

    async def _detect_captcha(self, page) -> bool:
        content = (await page.content()).lower()
        signals = [
         "verify you are human",
        "checking your browser",
        "complete the security check",
        "please enable javascript and cookies",
        "ray id",                          # Cloudflare challenge specific
        "cf-challenge",                    # Cloudflare challenge specific
        "recaptcha/api.js",                # actual reCAPTCHA script loading
        "hcaptcha.com/1/api.js",           # actual hCAPTCHA script loading
        "why do i have to complete a captcha",  # Cloudflare captcha page heading
        ]
        return any(s in content for s in signals)