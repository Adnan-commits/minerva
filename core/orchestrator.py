import time
import httpx
from lxml import html as lxml_html
from core.renderer import StaticRenderer, BrowserRenderer
from core.extractor import ContentExtractor
from core.postprocessor import PostProcessor
from utils.structured_logger import StructuredLogger
from utils.robots import RobotsChecker
from utils.retry import retry_async

logger = StructuredLogger("orchestrator")

# Minimum visible word count from probe fetch to classify a page as static.
# Pages below this threshold with JS signals are treated as dynamic.
# Tune this up if light server-rendered pages are being sent to Playwright unnecessarily,
# or down if dynamic pages are being misclassified as static.
STATIC_TEXT_WORD_THRESHOLD = 200

# Minimum word count required to trust probe HTML for direct extraction.
# Guards against error pages and minimal HTML shells returning false successes.
PROBE_RESCUE_MIN_WORDS = 500


class ScrapeOrchestrator:
    def __init__(self):
        self.static_renderer = StaticRenderer()
        self.browser_renderer = BrowserRenderer()
        self.extractor = ContentExtractor()
        self.postprocessor = PostProcessor()
        self.robots = RobotsChecker(user_agent="MCPBot")

    async def scrape(self, url: str, request_id: str) -> dict:
        start = time.time()
        logger.info("scrape_start", request_id=request_id, url=url)

        if not await self.robots.allowed(url):
            logger.error("robots_blocked", request_id=request_id, url=url)
            return {
                "success": False,
                "diagnostics": {
                    "request_id": request_id,
                    "failure_reason": "blocked_by_robots"
                }
            }

        try:
            probe = await retry_async(lambda: self._probe(url, request_id))

            # Probe rescue — attempt extraction directly on probe HTML before
            # touching any renderer. If probe has enough words and extraction
            # succeeds, return immediately. This avoids unnecessary Playwright
            # calls and sidesteps captcha walls on sites that serve good
            # server-side HTML (e.g. BorisFX, many article sites).
            # Guard: text_len > PROBE_RESCUE_MIN_WORDS rejects error pages and
            # empty JS shells that would otherwise produce garbage extractions.
            if probe["text_len"] > PROBE_RESCUE_MIN_WORDS:
                extracted = self.extractor.extract(probe["raw_html"], request_id)
                if extracted["success"]:
                    logger.info(
                        "probe_rescue_success",
                        request_id=request_id,
                        text_len=probe["text_len"],
                    )
                    diagnostics = {
                        "request_id": request_id,
                        "probe_mode": "probe_rescue",
                        "fallback_used": False,
                        "failure_reason": None,
                    }
                    final = self.postprocessor.process(extracted, request_id)
                    final["diagnostics"].update(diagnostics)
                    elapsed = round(time.time() - start, 2)
                    logger.info("scrape_complete", request_id=request_id, duration_sec=elapsed)
                    return final
                else:
                    logger.info(
                        "probe_rescue_failed",
                        request_id=request_id,
                        reason=extracted.get("reason"),
                    )

            # Probe rescue failed or insufficient content — fall through to
            # normal classify/render pipeline
            mode = self._classify(probe)

            diagnostics = {
                "request_id": request_id,
                "probe_mode": mode,
                "fallback_used": False,
                "failure_reason": None,
            }

            if mode == "static":
                html = await retry_async(lambda: self.static_renderer.render(url, request_id))
                extracted = self.extractor.extract(html, request_id)

                if not extracted["success"]:
                    diagnostics["fallback_used"] = True
                    html = await retry_async(lambda: self.browser_renderer.render(url, request_id))
                    extracted = self.extractor.extract(html, request_id)

            elif mode == "dynamic":
                html = await retry_async(lambda: self.browser_renderer.render(url, request_id))
                extracted = self.extractor.extract(html, request_id)

                if not extracted["success"]:
                    diagnostics["fallback_used"] = True
                    html = await retry_async(lambda: self.browser_renderer.render(url, request_id, slow=True))
                    extracted = self.extractor.extract(html, request_id)

                if not extracted.get("success"):
                    return {
                        "success": False,
                        "diagnostics": {
                            **diagnostics,
                            "failure_reason": extracted.get("reason", "extraction_failed"),
                        },
                    }

            else:
                diagnostics["failure_reason"] = "blocked"
                return {"success": False, "diagnostics": diagnostics}

            final = self.postprocessor.process(extracted, request_id)
            final["diagnostics"].update(diagnostics)

            elapsed = round(time.time() - start, 2)
            logger.info("scrape_complete", request_id=request_id, duration_sec=elapsed)

            return final

        except Exception as e:
            error_msg = str(e)
            failure_reason = "retry_exhausted"
            screenshot_path = None

            if "captcha_detected" in error_msg:
                failure_reason = "captcha_detected"
                screenshot_path = error_msg.split("captcha_detected:")[-1]

            elif "rendered_html_too_small" in error_msg:
                failure_reason = "render_failed_empty"
                screenshot_path = error_msg.split("rendered_html_too_small:")[-1]

            elif "content_never_stabilized" in error_msg:
                failure_reason = "render_timeout"

            logger.error(
                "scrape_failed",
                request_id=request_id,
                error=error_msg,
                failure_reason=failure_reason,
                screenshot=screenshot_path
            )

            return {
                "success": False,
                "diagnostics": {
                    "request_id": request_id,
                    "failure_reason": failure_reason,
                    "screenshot": screenshot_path,
                    "error": error_msg
                }
            }

    async def _probe(self, url: str, request_id: str):
        logger.info("probe_start", request_id=request_id, url=url)
        async with httpx.AsyncClient(timeout=5, headers={"User-Agent": "MCPBot/1.0"}) as client:
            r = await client.get(url)
            raw_html = r.text
            probe = {
                "status": r.status_code,
                "html_len": len(raw_html),
                "text_len": len(lxml_html.fromstring(raw_html).text_content().split()),
                "script_count": raw_html.count("<script"),
                "has_root": 'id="root"' in raw_html,
                "raw_html": raw_html,
            }
            # Log without raw_html to keep logs clean
            logger.info("probe_complete", request_id=request_id, **{
                k: v for k, v in probe.items() if k != "raw_html"
            })
            return probe

    def _classify(self, probe: dict) -> str:
        if probe["status"] in (403, 429):
            mode = "blocked"
        elif probe["script_count"] > 5 or probe["has_root"]:
            mode = "dynamic"
        elif probe["text_len"] > STATIC_TEXT_WORD_THRESHOLD:
            mode = "static"
        else:
            # Safe fallback — assumes server-rendered if no other signal matches
            mode = "static"

        logger.info(
            "classify_decision",
            mode=mode,
            text_len=probe["text_len"],
            script_count=probe["script_count"],
            has_root=probe["has_root"],
            threshold=STATIC_TEXT_WORD_THRESHOLD,
        )
        return mode