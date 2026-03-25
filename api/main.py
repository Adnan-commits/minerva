"""
FastAPI Gateway for MCP Server

Purpose:
- Expose existing MCP tool workflows via HTTP
- Reuse MCP workers WITHOUT duplicating logic
- Act as a human / system-facing access layer

This gateway does NOT replace MCP.
Claude continues to interact with MCP directly via stdio.
"""
# Must be set before event loop starts — fixes Playwright on Windows
import asyncio
from fileinput import filename
import sys
import os
import re
import json
from unittest import result

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI, HTTPException, Depends, Query, Response, Response
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from prometheus_fastapi_instrumentator import Instrumentator
from fastapi.middleware.cors import CORSMiddleware
from core.llm import stream_research, chat_with_report
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import timedelta
from workers.pdf_worker import PDFExtractor
from workers.pdf_writer import PDFWriter
import tempfile
from fastapi.responses import StreamingResponse
from core.orchestrator import ScrapeOrchestrator
from utils.structured_logger import new_request_id
from utils.logging_config import get_logger
from db.session import init_db, get_db
from db.models import Job

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "minerva")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "minerva@2025")
JWT_SECRET = os.getenv("JWT_SECRET", "minerva-secret-key")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24

# -------------------------------------------------------------------
# App Initialization
# -------------------------------------------------------------------

app = FastAPI(
    title="MCP Gateway API",
    description="HTTP Gateway over MCP tool workflows",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

logger = get_logger("fastapi-gateway")

# Initialize shared MCP components
pdf_extractor = PDFExtractor()
scrape_orchestrator = ScrapeOrchestrator()
pdf_writer = PDFWriter()

# Create database tables on startup
init_db()

# Expose Prometheus metrics at /metrics
Instrumentator().instrument(app).expose(app)

# -------------------------------------------------------------------
# Request Models
# -------------------------------------------------------------------

class PDFExtractRequest(BaseModel):
    file_path: str = Field(
        ...,
        description="Absolute path to the PDF file (must be in allowed directories)"
    )


class URLScrapeRequest(BaseModel):
    url: str = Field(
        ...,
        description="URL to scrape"
    )

class ResearchRequest(BaseModel):
    query: str = Field(..., description="Research query")
    mode: str = Field(default="web", description="web or pdf")
    url: Optional[str] = Field(None, description="Optional specific URL to scrape")
    file_path: Optional[str] = Field(None, description="PDF file path if mode is pdf")

class ExportPDFRequest(BaseModel):
    report: str = Field(..., description="Markdown report content")
    query: str = Field(..., description="Original research query")

class ExportMarkdownRequest(BaseModel):
    report: str = Field(..., description="Markdown report content")
    query: str = Field(..., description="Original research query")
    mode: str = Field(..., description="Research mode used")

class ExportJSONRequest(BaseModel):
    report: str = Field(..., description="Markdown report content")
    query: str = Field(..., description="Original research query")
    mode: str = Field(..., description="Research mode used")

class LoginRequest(BaseModel):
    username: str
    password: str

class ReportChatRequest(BaseModel):
    report: str = Field(..., description="The full markdown report text")
    query: str = Field(..., description="The original research query")
    message: str = Field(..., description="The user's follow-up question")
    history: list = Field(default=[], description="Prior conversation turns: [{role, content}]")

def _save_section(heading, content, sections):
    heading_lower = heading.lower()
    if heading_lower not in ["summary", "introduction", "sources"]:
        sections.append({
            "heading": heading,
            "content": " ".join(content)
        })

@app.get("/")
def root():
    return {
        "service": "MCP FastAPI Gateway",
        "description": "Gateway layer exposing MCP tool workflows",
        "endpoints": ["/health", "/docs", "/pdf/extract", "/pdf/summary", "/web/scrape", "/history"]
    }

# -------------------------------------------------------------------
# Health Check
# -------------------------------------------------------------------

@app.get("/health")
def health_check():
    """
    Basic health endpoint for monitoring and demos
    """
    return {
        "status": "ok",
        "service": "mcp-fastapi-gateway",
        "timestamp": datetime.utcnow().isoformat()
    }

#---Authentication Endpoint------------------------------------------------
@app.post("/auth/login")
def login(request: LoginRequest):
    if request.username != ADMIN_USERNAME or request.password != ADMIN_PASSWORD:
        raise HTTPException(
            status_code=401,
            detail={"error": "Invalid credentials"}
        )
    
    token = jwt.encode(
        {
            "sub": request.username,
            "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS)
        },
        JWT_SECRET,
        algorithm=JWT_ALGORITHM
    )
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "username": request.username
    }

#-------------Stats Endpoint------------------------------------------------
@app.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    from sqlalchemy import func

    total = db.query(Job).count()
    success = db.query(Job).filter(Job.status == "success").count()
    avg_dur = db.query(func.avg(Job.duration_seconds)).scalar() or 0
    total_words = db.query(func.sum(Job.word_count)).scalar() or 0

    return {
        "total": total,
        "success": success,
        "failed": total - success,
        "success_rate": round((success / total * 100)) if total else 0,
        "avg_duration": round(float(avg_dur), 2),
        "total_words": int(total_words),
    }
# -------------------------------------------------------------------
# PDF Extraction Endpoint
# -------------------------------------------------------------------

@app.post("/pdf/extract")
def extract_pdf(request: PDFExtractRequest, db: Session = Depends(get_db)):
    """
    Extract full text and metadata from a PDF.

    Internally calls the same PDFExtractor used by MCP tools.
    """
    request_id = new_request_id()
    start = datetime.utcnow()
    logger.info(f"PDF extraction requested: {request.file_path} | request_id={request_id}")

    result = pdf_extractor.extract(request.file_path)

    outcome = result.get("metadata", {}).get("outcome")
    duration = round((datetime.utcnow() - start).total_seconds(), 2)
    success = outcome != "FAILED_TECHNICAL"

    # Write job record to database
    db.add(Job(
        request_id=request_id,
        job_type="pdf",
        input=request.file_path,
        status="success" if success else "failed",
        failure_reason=result.get("error") if not success else None,
        strategy_used=None,
        word_count=result.get("metadata", {}).get("word_count"),
        duration_seconds=duration,
    ))
    db.commit()

    if not success:
        logger.error(f"PDF extraction technical failure: {result.get('error')}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": result.get("error"),
                "diagnostics": result.get("metadata", {})
            }
        )

    return {
        "success": True,
        "request_id": request_id,
        "data": result,
        "processed_at": datetime.utcnow().isoformat()
    }

# -------------------------------------------------------------------
# PDF Summary Endpoint
# -------------------------------------------------------------------

@app.post("/pdf/summary")
def extract_pdf_summary(request: PDFExtractRequest, db: Session = Depends(get_db)):
    """
    Extract metadata-only summary from a PDF.
    Faster than full extraction.
    """
    request_id = new_request_id()
    start = datetime.utcnow()
    logger.info(f"PDF summary requested: {request.file_path} | request_id={request_id}")

    result = pdf_extractor.extract_summary(request.file_path)

    success = result.get("success", False)
    duration = round((datetime.utcnow() - start).total_seconds(), 2)

    # Write job record to database
    db.add(Job(
        request_id=request_id,
        job_type="pdf_summary",
        input=request.file_path,
        status="success" if success else "failed",
        failure_reason=result.get("error") if not success else None,
        strategy_used=None,
        word_count=None,
        duration_seconds=duration,
    ))
    db.commit()

    if not success:
        logger.error(f"PDF summary failed: {result.get('error')}")
        raise HTTPException(
            status_code=400,
            detail={
                "error": result.get("error"),
                "diagnostics": result.get("metadata", {})
            }
        )

    return {
        "success": True,
        "request_id": request_id,
        "data": result,
        "processed_at": datetime.utcnow().isoformat()
    }

#--------Eport PDF Endpoint ---------------------------------------------------
@app.post("/export/pdf")
async def export_pdf(request: ExportPDFRequest):
    """Generate and return a PDF from a research report."""
    try:
        safe_name = re.sub(r'[^\w\s-]', '', request.query)
        safe_name = re.sub(r'\s+', '_', safe_name)[:50].strip('_').lower()
        filename = f"minerva_{safe_name}.pdf"  # ← inside here
        output_path = os.path.join(tempfile.gettempdir(), filename)
        pdf_writer.generate(request.report, request.query, output_path)

        from fastapi.responses import Response

        with open(output_path, "rb") as f:
            pdf_bytes = f.read()

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Access-Control-Expose-Headers": "Content-Disposition"
    }
)
    except Exception as e:
        logger.error(f"PDF export failed: {e}")
        raise HTTPException(status_code=500, detail={"error": str(e)})
    
#----------------Export Markdown---------------------------
@app.post("/export/markdown")
async def export_markdown(request: ExportMarkdownRequest):
    try:
        safe_name = re.sub(r'[^\w\s-]', '', request.query)
        safe_name = re.sub(r'\s+', '_', safe_name)[:50].strip('_').lower()
        filename = f"minerva_{safe_name}.md"

        header = f"""---
title: Minerva Research Report
query: {request.query}
mode: {request.mode}
generated_at: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC
---

"""
        content = header + request.report

        return Response(
            content=content,
            media_type="text/markdown",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    except Exception as e:
        logger.error(f"Markdown export failed: {e}")
        raise HTTPException(status_code=500, detail={"error": str(e)})

#----------------Export JSON---------------------------
@app.post("/export/json")
async def export_json(request: ExportJSONRequest):
    try:
        safe_name = re.sub(r'[^\w\s-]', '', request.query)
        safe_name = re.sub(r'\s+', '_', safe_name)[:50].strip('_').lower()
        filename = f"minerva_{safe_name}.json"

        # Parse markdown into structured sections
        lines = request.report.split('\n')
        summary = ""
        sections = []
        current_heading = None
        current_content = []

        i = 0
        while i < len(lines):
            line = lines[i].strip()

            # Handle === underline style headings
            if i + 1 < len(lines) and re.match(r'^=+$', lines[i + 1].strip()):
                if current_heading:
                    _save_section(current_heading, current_content, sections)
                    current_content = []
                current_heading = line
                i += 2
                continue

            # Handle --- underline style (skip — it's frontmatter separator)
            if re.match(r'^-{3,}$', line):
                i += 1
                continue

            # Skip frontmatter keys
            if re.match(r'^(title|query|mode|generated_at):', line):
                i += 1
                continue

            # Handle ## and ### headings
            if line.startswith('###') or line.startswith('##') or line.startswith('# '):
                if current_heading:
                    _save_section(current_heading, current_content, sections)
                    current_content = []
                current_heading = re.sub(r'^#+\s*', '', line).strip()
                i += 1
                continue

            if not line:
                i += 1
                continue

            clean = re.sub(r'^[-*•]\s*', '', line)
            clean = re.sub(r'\*\*(.*?)\*\*', r'\1', clean)
            if clean:
                current_content.append(clean)
            i += 1

        # Save last section
        if current_heading:
            _save_section(current_heading, current_content, sections)

        data = json.dumps({
            "query": request.query,
            "mode": request.mode,
            "generated_at": datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S') + " UTC",
            "summary": summary,
            "sections": sections,
            
        }, indent=2)

        # Extract summary from Introduction or Summary section
        summary_section = next(
            (s for s in sections if s["heading"].lower() in ["summary", "introduction"]),
            None
        )
        if summary_section:
            summary = summary_section["content"]
            sections = [s for s in sections if s["heading"].lower() not in ["summary", "introduction"]]

        return Response(
            content=data,
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    except Exception as e:
        logger.error(f"JSON export failed: {e}")
        raise HTTPException(status_code=500, detail={"error": str(e)})
    
#-----Preview Json------------------------
@app.post("/preview/json")
async def preview_json(request: ExportJSONRequest):
    try:
        lines = request.report.split('\n')
        summary = ""
        sections = []
        current_heading = None
        current_content = []

        i = 0
        while i < len(lines):
            line = lines[i].strip()

            # Handle === underline style headings
            if i + 1 < len(lines) and re.match(r'^=+$', lines[i + 1].strip()):
                if current_heading:
                    _save_section(current_heading, current_content, sections)
                    current_content = []
                current_heading = line
                i += 2
                continue

            # Handle --- underline style (skip — it's frontmatter separator)
            if re.match(r'^-{3,}$', line):
                i += 1
                continue

            # Skip frontmatter keys
            if re.match(r'^(title|query|mode|generated_at):', line):
                i += 1
                continue

            # Handle ## and ### headings
            if line.startswith('###') or line.startswith('##') or line.startswith('# '):
                if current_heading:
                    _save_section(current_heading, current_content, sections)
                    current_content = []
                current_heading = re.sub(r'^#+\s*', '', line).strip()
                i += 1
                continue

            if not line:
                i += 1
                continue

            clean = re.sub(r'^[-*•]\s*', '', line)
            clean = re.sub(r'\*\*(.*?)\*\*', r'\1', clean)
            if clean:
                current_content.append(clean)
            i += 1

        # Save last section
        if current_heading:
            _save_section(current_heading, current_content, sections)

        # Extract summary from Introduction or Summary section
        summary_section = next(
            (s for s in sections if s["heading"].lower() in ["summary", "introduction"]),
            None
        )
        if summary_section:
            summary = summary_section["content"]
            sections = [s for s in sections if s["heading"].lower() not in ["summary", "introduction"]]

        return {
            "query": request.query,
            "mode": request.mode,
            "generated_at": datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S') + " UTC",
            "summary": summary,
            "sections": sections,
            
        }
    except Exception as e:
        import traceback
        print(traceback.format_exc())  # add this
        raise HTTPException(status_code=500, detail={"error": str(e)})
        
    
# -------------------------------------------------------------------
# Web Scraping Endpoint
# -------------------------------------------------------------------

@app.post("/web/scrape")
async def scrape_url(request: URLScrapeRequest, db: Session = Depends(get_db)):
    """
    Scrape and extract main content from a URL.

    Uses the same industrial-grade ScrapeOrchestrator
    that is exposed as an MCP tool.
    """
    request_id = new_request_id()
    start = datetime.utcnow()
    logger.info(f"Web scrape requested: {request.url} | request_id={request_id}")

    result = await scrape_orchestrator.scrape(request.url, request_id)

    success = result.get("success", False)
    duration = round((datetime.utcnow() - start).total_seconds(), 2)
    diagnostics = result.get("diagnostics", {})
    quality = result.get("quality") or {}

    # Write job record to database
    db.add(Job(
        request_id=request_id,
        job_type="scrape",
        input=request.url,
        status="success" if success else "failed",
        failure_reason=diagnostics.get("failure_reason") if not success else None,
        strategy_used=diagnostics.get("extractor"),
        word_count=quality.get("word_count"),
        duration_seconds=duration,
    ))
    db.commit()

    if not success:
        logger.error(
            f"Web scrape failed | request_id={request_id} | "
            f"reason={diagnostics.get('failure_reason')}"
        )
        raise HTTPException(
            status_code=400,
            detail=result
        )

    return {
        "success": True,
        "request_id": request_id,
        "data": result,
        "processed_at": datetime.utcnow().isoformat()
    }

# -------------------------------------------------------------------
# History Endpoint
# -------------------------------------------------------------------

@app.get("/history")
def get_history(
    status: Optional[str] = Query(None, description="Filter by status: success or failed"),
    job_type: Optional[str] = Query(None, description="Filter by type: scrape, pdf, pdf_summary"),
    limit: int = Query(50, ge=1, le=200, description="Number of records to return"),
    db: Session = Depends(get_db),
):
    """
    Return past jobs with optional filtering by status and job type.
    Returns the most recent jobs first, up to the specified limit.
    """
    query = db.query(Job).order_by(Job.created_at.desc())

    if status:
        query = query.filter(Job.status == status)
    if job_type:
        query = query.filter(Job.job_type == job_type)

    jobs = query.limit(limit).all()

    return {
        "total": len(jobs),
        "filters": {"status": status, "job_type": job_type},
        "jobs": [
            {
                "id": job.id,
                "request_id": job.request_id,
                "job_type": job.job_type,
                "input": job.input,
                "status": job.status,
                "failure_reason": job.failure_reason,
                "strategy_used": job.strategy_used,
                "word_count": job.word_count,
                "duration_seconds": job.duration_seconds,
                "created_at": job.created_at.isoformat(),
            }
            for job in jobs
        ],
    }


# -------------------------------------------------------------------
# Research Endpoint
@app.post("/research")
async def research(request: ResearchRequest, db: Session = Depends(get_db)):
    """
    Core research endpoint — streams LLM tokens via Server-Sent Events (SSE).
    The frontend reads chunks in real time and renders them as they arrive.
    DB logging happens at stream end once the full response is assembled.
    """
    request_id = new_request_id()
    start = datetime.utcnow()
    logger.info(
        f"Research requested: {request.query} | mode={request.mode} | request_id={request_id}"
    )
 
    async def generate():
        full_text = ""
        failed = False
        error_msg = ""
 
        try:
            # ── Build the prompt — identical logic to the old endpoint ───────
 
            if request.mode == "pdf" and request.file_path:
                pdf_result = pdf_extractor.extract(request.file_path)
 
                if pdf_result.get("error"):
                    yield f"data: [ERROR]{pdf_result.get('error')}\n\n"
                    return
 
                pdf_text = pdf_result.get("text", "").strip()
 
                if not pdf_text:
                    yield "data: [ERROR]PDF appears to be empty or unreadable\n\n"
                    return
 
                SUMMARY_KEYWORDS = [
                    "summarize", "summary", "brief", "overview", "tldr", "short", "concise"
                ]
                is_summary_request = any(
                    word in request.query.lower() for word in SUMMARY_KEYWORDS
                )
 
                if is_summary_request:
                    prompt = f"""The user wants a summary of this document.
 
Here is the content extracted from the PDF document:
 
{pdf_text[:20000]}
 
Provide a concise structured summary with the following sections:
## Summary
## Key Points
## Conclusion"""
                else:
                    prompt = f"""The user wants to extract and read this document: {request.query}
 
Here is the COMPLETE content extracted from the PDF document:
 
{pdf_text[:20000]}
 
Your task:
- DO NOT summarize, shorten, or omit ANY content
- DO NOT add any new information or outside knowledge
- ONLY add markdown structure and formatting to the existing content
- Preserve every word, number, name, date and detail exactly as it appears
- Organize with headers that reflect the document's own structure
- Present 100% of the content — nothing should be left out"""
 
            else:
                # Web mode
                async def search_tool(query: str, max_results: int = 5):
                    from core.search import web_search
                    return await web_search(query, max_results)
 
                async def scrape_tool(url: str):
                    try:
                        result = await scrape_orchestrator.scrape(url, new_request_id())
                        if result is None:
                            return ""
                        content = result.get("content") or {}
                        return (
                            content.get("main_content")
                            or content.get("text")
                            or result.get("text")
                            or ""
                        )
                    except Exception as e:
                        logger.warning(f"scrape_tool failed for {url}: {e}")
                        return ""
 
                scraped_content = ""
                search_results = ""
 
                if request.url:
                    scraped_content = await scrape_tool(request.url)
                    if not scraped_content:
                        yield (
                            f"data: [ERROR]Could not extract content from {request.url}"
                            " — page may be blocked or empty\n\n"
                        )
                        return
                else:
                    search_results = await search_tool(request.query)
                    import re as _re
                    urls = _re.findall(r"URL:\s*(https?://\S+)", search_results)[:3]
                    for u in urls:
                        content = await scrape_tool(u)
                        scraped_content += f"\n\n--- Content from {u} ---\n{content[:5000]}"
 
                if request.url:
                    prompt = f"""The user wants to analyze this specific webpage: {request.url}
 
Here is the full scraped content from that page:
 
{scraped_content[:25000]}
 
Your task:
- DO NOT search the web
- DO NOT use any outside knowledge
- ONLY use the content provided above
- Structure it into a clean, readable report with proper sections
- Preserve the actual data, links, titles and content from the page
- Do not summarize away details — keep the content rich and complete"""
                else:
                    prompt = f"""Research query: {request.query}
 
Search Results:
{search_results}
 
Scraped Content:
{scraped_content[:25000]}
 
Based on the above, provide a structured research report."""
 
            # ── Stream tokens from Groq ───────────────────────────────────────
            import base64
 
            async for chunk in stream_research(prompt):
                yield chunk  # forward each SSE frame to the browser as-is
 
                # Intercept [FULL] frame — contains base64-encoded full response
                if chunk.startswith("data: [FULL]"):
                    encoded = chunk.removeprefix("data: [FULL]").strip()
                    try:
                        full_text = base64.b64decode(encoded).decode("utf-8")
                    except Exception:
                        full_text = ""
 
                # Intercept [ERROR] frame
                if chunk.startswith("data: [ERROR]"):
                    error_msg = chunk.removeprefix("data: [ERROR]").strip()
                    failed = True
 
        except Exception as e:
            error_msg = str(e)
            failed = True
            logger.error(f"Research stream failed: {e} | request_id={request_id}")
            yield f"data: [ERROR]{error_msg}\n\n"
 
        finally:
            # ── Log job to DB after stream finishes ───────────────────────────
            duration = round((datetime.utcnow() - start).total_seconds(), 2)
            db.add(
                Job(
                    request_id=request_id,
                    job_type="research",
                    input=request.query,
                    status="failed" if failed else "success",
                    failure_reason=error_msg if failed else None,
                    strategy_used=request.mode,
                    word_count=len(full_text.split()) if full_text else None,
                    duration_seconds=duration,
                )
            )
            db.commit()
 
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",       # prevents browser caching the stream
            "X-Accel-Buffering": "no",          # disables nginx buffering if proxied
        },
    )
#------------------Chat with Report Endpoint---------------------------
@app.post("/chat/report")
async def chat_report(request: ReportChatRequest):
    """
    Answer a follow-up question about an existing research report.
    Grounded in report content only — no new searches or scraping.
    Not logged to the job DB (chat turn, not a research job).
    """
    try:
        reply = await chat_with_report(
            report=request.report,
            original_query=request.query,
            message=request.message,
            history=request.history,
        )
        return {"reply": reply}
 
    except Exception as e:
        logger.error(f"Report chat failed: {e}")
        raise HTTPException(status_code=500, detail={"error": str(e)})