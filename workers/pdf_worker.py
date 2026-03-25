"""
PDF Worker - Multi-engine extraction with intelligent routing.

ENGINES:
- PyMuPDF   : Fast path for simple text-only PDFs
- pdfplumber : Text PDFs containing tables, figures, or complex layouts
- PaddleOCR  : Scanned/image-based PDFs with no extractable text

ROUTING LOGIC:
- Sample first 5 pages to detect PDF type (speed optimized)
- avg_chars_per_page < 50  → Scanned → PaddleOCR (fallback: PyMuPDF)
- avg_chars_per_page >= 50 → Text based
    - tables detected       → pdfplumber (fallback: PyMuPDF)
    - no tables             → PyMuPDF (fast path)

OPTIMIZATIONS:
- Lazy PaddleOCR import — only loaded when needed
- PaddleOCR singleton — initialized once, reused across calls
- Parallel OCR — ThreadPoolExecutor for multi-page processing
- 150 DPI rendering — halves memory, minimal accuracy loss
- 5-page sampling — O(1) detection cost
"""

from pathlib import Path
from typing import Dict, Tuple, Optional, List
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import fitz  # PyMuPDF
import pdfplumber
import html

from utils.logging_config import get_logger

logger = get_logger("pdf_worker")

# PaddleOCR singleton — initialized once on first scanned PDF
_ocr_instance = None

def _get_ocr():
    """Lazy singleton for PaddleOCR — avoids slow startup on every call."""
    global _ocr_instance
    if _ocr_instance is None:
        logger.info("Initializing PaddleOCR singleton...")
        from paddleocr import PaddleOCR
        _ocr_instance = PaddleOCR(
            use_angle_cls=True,
            lang="en",
            use_gpu=False,
            show_log=False,
        )
        logger.info("PaddleOCR singleton ready.")
    return _ocr_instance


# Page limits per engine
PAGE_LIMITS = {
    "pymupdf":     100,
    "pdfplumber":   50,
    "paddleocr":    25,
}

# Chars per page threshold — below this = scanned
SCANNED_THRESHOLD = 50

# Parallel OCR workers
OCR_WORKERS = 4


class PDFExtractor:
    """
    Multi-engine PDF extractor with intelligent routing.
    Public API is identical to previous version — no changes needed
    in main.py or server.py.
    """

    def __init__(self):
        self.allowed_dirs = [
            Path.home() / "Desktop",
            Path.home() / "Documents",
            Path.home() / "Downloads",
        ]
        self.max_size_mb = 10

        logger.info(
            f"PDFExtractor initialized. "
            f"Allowed dirs: {self.allowed_dirs}"
        )

    # ─────────────────────────────────────────────
    # SECURITY
    # ─────────────────────────────────────────────

    def _is_path_allowed(self, path: Path) -> Tuple[bool, str]:
        try:
            resolved_path = path.resolve()
            for allowed_dir in self.allowed_dirs:
                try:
                    resolved_path.relative_to(allowed_dir)
                    return True, ""
                except ValueError:
                    continue
            allowed_list = ", ".join(str(d) for d in self.allowed_dirs)
            return False, f"Access denied. File must be in: {allowed_list}"
        except Exception as e:
            return False, f"Path validation error: {str(e)}"

    # ─────────────────────────────────────────────
    # DETECTION
    # ─────────────────────────────────────────────

    def _detect_pdf_type(self, path: Path) -> Tuple[str, int]:
        """
        Detect PDF type by sampling first 5 pages.

        Returns:
            Tuple of (pdf_type, page_count)
            pdf_type: 'simple' | 'complex' | 'scanned'
        """
        doc = fitz.open(str(path))
        page_count = doc.page_count
        sample_pages = min(5, page_count)

        # Sample text from first N pages
        total_chars = 0
        for i in range(sample_pages):
            total_chars += len(doc[i].get_text().strip())
        doc.close()

        avg_chars = total_chars / sample_pages if sample_pages > 0 else 0
        logger.info(f"Detection: avg_chars_per_page={avg_chars:.1f}, pages={page_count}")

        # Scanned PDF — no extractable text
        if avg_chars < SCANNED_THRESHOLD:
            logger.info(f"PDF type: SCANNED (avg_chars={avg_chars:.1f})")
            return "scanned", page_count

        # Text-based — check for tables using pdfplumber on sample pages
        tables_found = 0
        try:
            with pdfplumber.open(str(path)) as pdf:
                for i in range(sample_pages):
                    tables = pdf.pages[i].extract_tables()
                    if tables:
                        tables_found += len(tables)
        except Exception as e:
            logger.warning(f"pdfplumber table detection failed: {e}")

        if tables_found > 0:
            logger.info(f"PDF type: COMPLEX (tables_found={tables_found})")
            return "complex", page_count

        logger.info("PDF type: SIMPLE")
        return "simple", page_count

    # ─────────────────────────────────────────────
    # ENGINE 1 — PyMuPDF (simple text PDFs)
    # ─────────────────────────────────────────────

    def _extract_with_pymupdf(self, path: Path, page_limit: int) -> Tuple[str, List[str], int]:
        """
        Fast extraction for simple text-only PDFs.

        Returns:
            Tuple of (full_text, extraction_errors, tables_found)
        """
        fitz.TOOLS.reset_mupdf_warnings()
        doc = fitz.open(str(path))

        if doc.page_count == 0:
            doc.close()
            raise ValueError("PDF has no pages")

        if doc.page_count > page_limit:
            doc.close()
            raise ValueError(
                f"Too many pages: {doc.page_count} (maximum: {page_limit})"
            )

        pages_text = []
        extraction_errors = []

        for page_num in range(doc.page_count):
            try:
                page = doc[page_num]
                text = page.get_text()
                if text.strip():
                    pages_text.append(f"=== Page {page_num + 1} ===\n{text}")
                else:
                    extraction_errors.append(
                        f"Page {page_num + 1} has no extractable text"
                    )
            except Exception as e:
                extraction_errors.append(f"Page {page_num + 1}: {str(e)}")

        doc.close()
        return "\n\n".join(pages_text), extraction_errors, 0

    # ─────────────────────────────────────────────
    # ENGINE 2 — pdfplumber (complex: tables + text)
    # ─────────────────────────────────────────────

    def _extract_with_pdfplumber(self, path: Path, page_limit: int) -> Tuple[str, List[str], int]:
        """
        Layout-aware extraction preserving tables as markdown.

        Returns:
            Tuple of (full_text, extraction_errors, tables_found)
        """
        pages_text = []
        extraction_errors = []
        total_tables = 0

        with pdfplumber.open(str(path)) as pdf:
            pages_to_process = min(len(pdf.pages), page_limit)

            for page_num in range(pages_to_process):
                try:
                    page = pdf.pages[page_num]
                    page_content = []

                    # Extract tables first — get their bounding boxes
                    tables = page.extract_tables()
                    table_bboxes = [t.bbox for t in page.find_tables()] if tables else []
                    total_tables += len(tables)

                    # Extract words outside table bounding boxes
                    words = page.extract_words()
                    text_lines = []
                    for word in words:
                        word_bbox = (word['x0'], word['top'], word['x1'], word['bottom'])
                        in_table = any(
                            word_bbox[0] >= tb[0] and word_bbox[2] <= tb[2] and
                            word_bbox[1] >= tb[1] and word_bbox[3] <= tb[3]
                            for tb in table_bboxes
                        )
                        if not in_table:
                            text_lines.append(word['text'])

                    if text_lines:
                        page_content.append(" ".join(text_lines))

                    # Format tables as markdown
                    for table in tables:
                        if not table:
                            continue
                        md_rows = []
                        for row in table:
                            clean_row = [
                                html.unescape(str(cell).strip()) if cell is not None else ""
                                for cell in row
                            ]
                            md_rows.append("| " + " | ".join(clean_row) + " |")
                        if md_rows:
                            page_content.append("\n".join(md_rows))

                    if page_content:
                        pages_text.append(
                            f"=== Page {page_num + 1} ===\n" + "\n\n".join(page_content)
                        )
                    else:
                        extraction_errors.append(
                            f"Page {page_num + 1} has no extractable content"
                        )

                except Exception as e:
                    extraction_errors.append(f"Page {page_num + 1}: {str(e)}")
                    logger.warning(f"pdfplumber error on page {page_num + 1}: {e}")

        return "\n\n".join(pages_text), extraction_errors, total_tables

    # ─────────────────────────────────────────────
    # ENGINE 3 — PaddleOCR (scanned PDFs)
    # ─────────────────────────────────────────────

    def _ocr_single_page(self, args: Tuple) -> Tuple[int, str, Optional[str]]:
        """
        OCR a single page — designed for parallel execution.

        Args:
            args: Tuple of (page_num, pdf_path_str, dpi)

        Returns:
            Tuple of (page_num, extracted_text, error_or_None)
        """
        page_num, pdf_path_str, dpi = args
        try:
            import numpy as np
            doc = fitz.open(pdf_path_str)
            page = doc[page_num]

            # Render at 150 DPI — halves memory vs 300 DPI
            mat = fitz.Matrix(dpi / 72, dpi / 72)
            pix = page.get_pixmap(matrix=mat)
            img_array = np.frombuffer(pix.samples, dtype=np.uint8).reshape(
                pix.height, pix.width, pix.n
            )
            doc.close()

            ocr = _get_ocr()
            result = ocr.ocr(img_array, cls=True)

            if not result or not result[0]:
                return page_num, "", None

            lines = []
            for line in result[0]:
                if line and len(line) >= 2:
                    text = line[1][0]
                    if text.strip():
                        lines.append(text)

            return page_num, "\n".join(lines), None

        except Exception as e:
            return page_num, "", str(e)

    def _extract_with_ocr(self, path: Path, page_limit: int) -> Tuple[str, List[str], int]:
        """
        Parallel OCR extraction for scanned PDFs.

        Returns:
            Tuple of (full_text, extraction_errors, tables_found)
        """
        doc = fitz.open(str(path))
        page_count = min(doc.page_count, page_limit)
        doc.close()

        logger.info(f"OCR: processing {page_count} pages with {OCR_WORKERS} workers")

        # Prepare args for parallel processing
        args_list = [
            (page_num, str(path), 150)
            for page_num in range(page_count)
        ]

        # Results dict to maintain page order
        results = {}
        extraction_errors = []

        with ThreadPoolExecutor(max_workers=OCR_WORKERS) as executor:
            future_to_page = {
                executor.submit(self._ocr_single_page, args): args[0]
                for args in args_list
            }
            for future in as_completed(future_to_page):
                page_num, text, error = future.result()
                if error:
                    extraction_errors.append(f"Page {page_num + 1}: {error}")
                    logger.warning(f"OCR error on page {page_num + 1}: {error}")
                else:
                    results[page_num] = text

        # Reconstruct in page order
        pages_text = []
        for page_num in sorted(results.keys()):
            text = results[page_num]
            if text.strip():
                pages_text.append(f"=== Page {page_num + 1} ===\n{text}")
            else:
                extraction_errors.append(
                    f"Page {page_num + 1} produced no OCR output"
                )

        return "\n\n".join(pages_text), extraction_errors, 0

    # ─────────────────────────────────────────────
    # PUBLIC API
    # ─────────────────────────────────────────────

    def extract(self, pdf_path: str) -> Dict:
        """
        Extract complete text from PDF with intelligent engine routing.
        Public signature unchanged from previous version.
        """
        try:
            path = Path(pdf_path)

            # STEP 1 — Security & file validation
            is_allowed, error_msg = self._is_path_allowed(path)
            if not is_allowed:
                return self._error_response(f"🔒 Security: {error_msg}")

            if not path.exists():
                return self._error_response(f"File not found: {pdf_path}")

            if path.suffix.lower() != ".pdf":
                return self._error_response(f"Not a PDF file: {pdf_path}")

            size_mb = path.stat().st_size / (1024 * 1024)
            if size_mb > self.max_size_mb:
                return self._error_response(
                    f"PDF too large: {size_mb:.1f}MB (maximum: {self.max_size_mb}MB)"
                )

            logger.info(f"Starting extraction: {path.name} ({size_mb:.2f}MB)")

            # STEP 2 — Detect PDF type
            pdf_type, page_count = self._detect_pdf_type(path)

            # STEP 3 — Route to correct engine
            full_text = ""
            extraction_errors = []
            tables_found = 0
            engine_used = "pymupdf"
            page_limit = PAGE_LIMITS["pymupdf"]

            if pdf_type == "scanned":
                page_limit = PAGE_LIMITS["paddleocr"]
                try:
                    logger.info("Routing to PaddleOCR engine")
                    full_text, extraction_errors, tables_found = self._extract_with_ocr(
                        path, page_limit
                    )
                    engine_used = "paddleocr"
                except Exception as e:
                    logger.warning(f"PaddleOCR failed, falling back to PyMuPDF: {e}")
                    page_limit = PAGE_LIMITS["pymupdf"]
                    full_text, extraction_errors, tables_found = self._extract_with_pymupdf(
                        path, page_limit
                    )
                    engine_used = "pymupdf_fallback"

            elif pdf_type == "complex":
                page_limit = PAGE_LIMITS["pdfplumber"]
                try:
                    logger.info("Routing to pdfplumber engine")
                    full_text, extraction_errors, tables_found = self._extract_with_pdfplumber(
                        path, page_limit
                    )
                    engine_used = "pdfplumber"
                except Exception as e:
                    logger.warning(f"pdfplumber failed, falling back to PyMuPDF: {e}")
                    page_limit = PAGE_LIMITS["pymupdf"]
                    full_text, extraction_errors, tables_found = self._extract_with_pymupdf(
                        path, page_limit
                    )
                    engine_used = "pymupdf_fallback"

            else:
                # Simple — fast path
                page_limit = PAGE_LIMITS["pymupdf"]
                logger.info("Routing to PyMuPDF engine (fast path)")
                full_text, extraction_errors, tables_found = self._extract_with_pymupdf(
                    path, page_limit
                )
                engine_used = "pymupdf"

            # STEP 4 — Quality metrics
            word_count = len(full_text.split())
            char_count = len(full_text)
            text_density = char_count / page_count if page_count > 0 else 0
            empty_pages = len(extraction_errors)

            # STEP 5 — Repair diagnostics (PyMuPDF only)
            was_repaired = False
            repair_warnings = None
            if engine_used in ("pymupdf", "pymupdf_fallback"):
                fitz.TOOLS.reset_mupdf_warnings()
                doc = fitz.open(str(path))
                was_repaired = doc.is_repaired
                repair_warnings = fitz.TOOLS.mupdf_warnings() or None
                doc.close()

            metadata = {
                "filename": path.name,
                "file_size_mb": round(size_mb, 2),
                "pages": page_count,
                "word_count": word_count,
                "char_count": char_count,
                "text_density": round(text_density, 2),
                "extraction_engine": engine_used,
                "pdf_type": pdf_type,
                "tables_found": tables_found,
                "extraction_timestamp": datetime.utcnow().isoformat(),
                "was_repaired": was_repaired,
                "repair_warnings": repair_warnings,
                "extraction_errors": extraction_errors or None,
                "empty_pages": empty_pages,
                "needs_ocr": pdf_type == "scanned",
                "quality_score": self._calculate_quality_score(
                    text_density, empty_pages, page_count
                ),
            }

            logger.info(
                f"✓ Extracted {char_count} chars from {path.name} "
                f"(engine={engine_used}, type={pdf_type}, "
                f"tables={tables_found}, quality={metadata['quality_score']:.1f}%)"
            )

            return {
                "success": True,
                "text": full_text,
                "metadata": metadata,
                "error": "",
            }

        except Exception as e:
            logger.error(f"Unexpected extraction error: {e}", exc_info=True)
            return self._error_response(f"Extraction error: {str(e)}")

    def extract_summary(self, pdf_path: str) -> Dict:
        """
        Quick metadata extraction without full text.
        Unchanged from previous version.
        """
        try:
            path = Path(pdf_path)

            is_allowed, error_msg = self._is_path_allowed(path)
            if not is_allowed:
                return self._error_response(f"🔒 Security: {error_msg}")

            if not path.exists():
                return self._error_response(f"File not found: {pdf_path}")

            if path.suffix.lower() != ".pdf":
                return self._error_response(f"Not a PDF file: {pdf_path}")

            size_mb = path.stat().st_size / (1024 * 1024)
            if size_mb > self.max_size_mb:
                return self._error_response(
                    f"PDF too large: {size_mb:.1f}MB (maximum: {self.max_size_mb}MB)"
                )

            fitz.TOOLS.reset_mupdf_warnings()
            doc = fitz.open(str(path))

            metadata = {
                "filename": path.name,
                "file_size_mb": round(size_mb, 2),
                "pages": doc.page_count,
                "title": doc.metadata.get("title"),
                "author": doc.metadata.get("author"),
                "subject": doc.metadata.get("subject"),
                "keywords": doc.metadata.get("keywords"),
                "creator": doc.metadata.get("creator"),
                "producer": doc.metadata.get("producer"),
                "creation_date": doc.metadata.get("creationDate"),
                "modification_date": doc.metadata.get("modDate"),
                "was_repaired": doc.is_repaired,
                "repair_warnings": fitz.TOOLS.mupdf_warnings() or None,
                "extraction_timestamp": datetime.utcnow().isoformat(),
            }

            doc.close()

            return {
                "success": True,
                "metadata": metadata,
                "error": "",
            }

        except Exception as e:
            logger.error(f"Summary extraction failed: {e}", exc_info=True)
            return self._error_response(f"Metadata extraction failed: {str(e)}")

    # ─────────────────────────────────────────────
    # HELPERS
    # ─────────────────────────────────────────────

    def _calculate_quality_score(
        self,
        text_density: float,
        empty_pages: int,
        total_pages: int,
    ) -> float:
        density_score = min(text_density / 20, 50)
        empty_ratio = empty_pages / max(total_pages, 1)
        empty_score = 50 * (1 - empty_ratio)
        return density_score + empty_score

    def _error_response(
        self,
        error: str,
        warnings: Optional[str] = None,
    ) -> Dict:
        return {
            "success": False,
            "error": error,
            "text": "",
            "metadata": {
                "mupdf_warnings": warnings if warnings else None,
            },
        }