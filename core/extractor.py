from lxml import html
from utils.structured_logger import StructuredLogger

logger = StructuredLogger("extractor")

MIN_ARTICLE_TEXT_LEN = 200
MIN_LISTING_TEXT_LEN = 20


class ContentExtractor:
    def extract(self, html_text: str, request_id: str) -> dict:
        logger.info("extract_start", request_id=request_id)

        tree = html.fromstring(html_text)
        candidates = tree.xpath("//article | //main | //section | //div")

        best = None
        best_score = 0

        for node in candidates:
            text = node.text_content().strip()
            if len(text) < MIN_ARTICLE_TEXT_LEN:
                continue

            links = len(node.xpath(".//a"))
            forms = len(node.xpath(".//form"))
            paras = len(node.xpath(".//p"))

            link_density = links / max(len(text), 1)
            if link_density > 0.3:
                score = len(text) * 0.4
            else:
                score = len(text) + paras * 50 - links * 30 - forms * 200

            if score > best_score:
                best_score = score
                best = node

        if best is None:
            # Second-pass fallback for listing pages (e.g. HN, Reddit, table-based sites)
            listing_nodes = tree.xpath("//table//tr | //ol//li | //ul//li")
            listing_texts = [
                node.text_content().strip()
                for node in listing_nodes
                if len(node.text_content().strip()) > MIN_LISTING_TEXT_LEN
            ]

            # Remove entries that are substrings of longer entries (deduplication)
            listing_texts = [
                t for i, t in enumerate(listing_texts)
                if not any(t in other for j, other in enumerate(listing_texts) if i != j)
            ]

            if listing_texts:
                joined_text = "\n".join(listing_texts)
                logger.info("extract_success", request_id=request_id, strategy="listing_fallback", chars=len(joined_text))
                return {
                    "success": True,
                    "strategy": "listing_fallback",
                    "html": "",
                    "text": joined_text,
                }

            logger.error("extract_fail", request_id=request_id, reason="no_content_block")
            return {"success": False, "reason": "no_content_block"}

        cleaned = self._clean(best)
        text = cleaned.text_content().strip()

        logger.info("extract_success", request_id=request_id, chars=len(text))
        return {
            "success": True,
            "strategy": "density_scoring",
            "html": html.tostring(cleaned, encoding="unicode"),
            "text": text,
        }

    def _clean(self, node):
        for bad in node.xpath(".//script|.//style|.//nav|.//footer|.//aside|.//form"):
            bad.getparent().remove(bad)
        return node