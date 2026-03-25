# Minerva — Project Context Document
> Last updated: March 2026
> Purpose: Complete project handoff context for continuing development in a new chat session

---

## 1. Project Identity

**Official Name:** Minerva: An AI-Powered Research Engine Built on Model Context Protocol

**University Title:** Building a Multi-Functional MCP Server for Context-Aware AI Applications

**One-liner:** An MCP-powered research engine that searches the web, scrapes pages, extracts PDFs, and synthesizes collected data into structured reports exportable as PDF, Markdown, or JSON.

**Company:** Aiolos Cloud Solutions (https://aiolos.cloud/index)

**Team:** NextGen Thinker
- Adnan Bardgujar — https://www.linkedin.com/in/adnan-bardgujar-b43b7a25b/
- Saif Madre — https://www.linkedin.com/in/saif-madre-7986872ba/
- Mohd Salique Khan — https://www.linkedin.com/in/mohdsaliquekhan78622/
- Fazal Shaikh — https://www.linkedin.com/in/fazal-shaikh-555404195/

**Production Metrics (as of March 2026):**
- Total Jobs: 168
- Success Rate: 88%
- Avg Duration: 48.59s per research job
- Words Processed: 73,900+

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| MCP Server | Python, FastMCP |
| Web Search | Tavily API |
| Web Scraping | Playwright + HTTPX |
| PDF Extraction | PyMuPDF, pdfplumber, PaddleOCR |
| PDF Writing | ReportLab |
| AI / LLM | Groq — llama-3.3-70b-versatile |
| Backend API | FastAPI |
| Database | SQLite via SQLAlchemy |
| Metrics | Prometheus via prometheus-fastapi-instrumentator |
| Frontend | React + Vite + Tailwind v3 + shadcn/ui + Framer Motion + Recharts |
| Auth | JWT via python-jose + passlib |
| Font | JetBrains Mono (monospace devtool aesthetic) |


## 3. Project Structure

```
unified_mcp_server/
├── server.py                    # MCP server, tool definitions + handlers
├── core/
│   ├── scraper.py               # Playwright/HTTPX scraping logic
│   ├── search.py                # Tavily web search
│   ├── orchestrator.py          # ScrapeOrchestrator
│   └── llm.py                   # Groq LLM synthesis
├── workers/
│   ├── pdf_worker.py            # Multi-engine PDF extraction (PyMuPDF + pdfplumber + PaddleOCR)
│   └── pdf_writer.py            # PDF report generation (ReportLab)
├── api/
│   └── main.py                  # FastAPI gateway — all endpoints
├── db/
│   ├── models.py                # Job table (SQLAlchemy)
│   ├── session.py               # SQLite session
│   └── __init__.py
├── utils/
│   ├── structured_logger.py     # new_request_id()
│   └── logging_config.py
├── frontend/                    # React + Vite app
│   ├── index.html               # Title: Minerva, favicon: minerva.svg
│   ├── public/
│   │   └── minerva.svg          # Teal owl favicon
│   └── src/
│       ├── App.jsx              # Router, ProtectedRoute wrapper
│       ├── main.jsx             # No StrictMode (removed to fix double API calls)
│       ├── index.css            # Global animations: fadeUp, slideUp, slideInLine, pageEnter
│       ├── pages/
│       │   ├── Login.jsx        # Boot sequence + JWT login
│       │   ├── Welcome.jsx      # Landing screen post-login
│       │   ├── Home.jsx         # Research query input
│       │   ├── Results.jsx      # Research output + export
│       │   ├── Dashboard.jsx    # Metrics, charts, job history
│       │   └── Capabilities.jsx # System capabilities showcase
│       ├── components/
│       │   └── layout/
│       │       ├── Navbar.jsx          # Owl logo, teal devtool theme
│       │       └── ProtectedRoute.jsx  # JWT guard
│       └── services/
│           └── api.js           # All API calls
├── .env                         # TAVILY_API_KEY, GROQ_API_KEY, ADMIN_USERNAME, ADMIN_PASSWORD, JWT_SECRET
└── requirements.txt
```

---

## 4. Environment Variables (.env)

```
TAVILY_API_KEY=<your_tavily_key>
GROQ_API_KEY=<your_groq_key>
ADMIN_USERNAME=minerva
ADMIN_PASSWORD=minerva@2025
JWT_SECRET=minerva-secret-key-change-in-production
```

---

## 5. MCP Server Tools (server.py)

Five tools exposed via FastMCP:

| Tool | Description |
|---|---|
| `web_search` | Tavily API search, max_results param (default 5) |
| `scrape_url` | Playwright + HTTPX orchestrator |
| `extract_pdf` | Multi-engine PDF extraction (routes to correct engine) |
| `extract_pdf_summary` | Metadata-only PDF summary |
| `view_extracted_json` | View saved extraction results |

**Security:** PDF tools restricted to Desktop / Documents / Downloads only.

---

## 6. FastAPI Endpoints (api/main.py)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Service info |
| GET | `/health` | Health check |
| GET | `/stats` | Aggregate stats (total, success rate, avg duration, words) |
| GET | `/history` | Job history — params: status, job_type, limit (default 50, max 200) |
| GET | `/metrics` | Prometheus metrics |
| POST | `/auth/login` | JWT login — body: {username, password} |
| POST | `/research` | Core research endpoint — body: {query, mode, url, file_path} |
| POST | `/pdf/extract` | Direct PDF extraction — body: {file_path} |
| POST | `/pdf/summary` | PDF metadata — body: {file_path} |
| POST | `/web/scrape` | Direct URL scrape — body: {url} |
| POST | `/export/pdf` | PDF export — body: {report, query} → FileResponse |
| POST | `/export/markdown` | MD export — body: {report, query, mode} |
| POST | `/export/json` | JSON export — body: {report, query, mode} |
| POST | `/preview/json` | JSON preview (no download) — body: {report, query, mode} |

**CORS:** allow_origins=["http://localhost:5173"], expose_headers=["Content-Disposition"]

**JWT:** 24 hour expiry, HS256 algorithm, single admin user from .env

---

## 7. /research Endpoint Logic

```
if mode == "pdf":
    extract text via pdf_extractor.extract()
    result has "text" key (single string with === Page N === markers)
    check SUMMARY_KEYWORDS → if summary: send to Groq for synthesis
    else: send to Groq with "structure only, preserve all content" prompt

else (web):
    if url provided: scrape directly, skip Tavily search
    else: Tavily search → extract top 2 URLs → scrape each
    send collected data to Groq for synthesis

log job to DB (job_type="research", strategy_used=mode)
```

---

## 8. LLM Configuration (core/llm.py)

```python
MAX_PROMPT_CHARS = 35000   # increased from 20000 — 50% rate limit headroom
MAX_TOKENS = 8192
model = "llama-3.3-70b-versatile"
```

**Two modes in system prompt:**
- RESEARCH MODE: synthesize from search + scrape into structured report
- STRUCTURE MODE: format raw content without summarizing, preserve all

**Key system prompt rules:**
- Always use ### headings (critical for JSON parser)
- Executive summary mandatory in RESEARCH MODE
- Cross-reference sources, highlight contradictions
- Use bold on first use of key terms
- Use tables for comparisons
- Never truncate response

---

## 9. PDF Worker — Multi-Engine Routing (workers/pdf_worker.py)

### Detection Logic
```
Sample first 5 pages with PyMuPDF
avg_chars_per_page < 50  → SCANNED  → PaddleOCR (fallback: PyMuPDF)
avg_chars_per_page >= 50 → TEXT BASED
    tables detected       → COMPLEX  → pdfplumber (fallback: PyMuPDF)
    no tables             → SIMPLE   → PyMuPDF (fast path)
```

### Page Limits Per Engine
| Engine | Page Limit |
|---|---|
| PyMuPDF | 100 |
| pdfplumber | 50 |
| PaddleOCR | 25 |

### Speed Optimizations
- Lazy PaddleOCR import — only loaded when needed
- PaddleOCR singleton — initialized once, reused
- Parallel OCR — ThreadPoolExecutor with 4 workers
- 150 DPI rendering — halves memory vs 300 DPI
- 5-page sampling for detection — O(1) cost

### Table Output Format
Tables from pdfplumber rendered as markdown:
```
| Col1 | Col2 | Col3 |
| val1 | val2 | val3 |
```

Content sorted by Y coordinate to preserve reading order.

### Fallback Chain
```
pdfplumber fails → silently fall back to PyMuPDF
PaddleOCR fails  → silently fall back to PyMuPDF
PyMuPDF fails    → return error response
```

### Output Structure (all engines return same format)
```python
{
    "success": True,
    "text": "full extracted text string",
    "metadata": {
        "filename": "...",
        "file_size_mb": 1.2,
        "pages": 10,
        "word_count": 500,
        "char_count": 3000,
        "text_density": 300.0,
        "extraction_engine": "pymupdf" | "pdfplumber" | "paddleocr",
        "pdf_type": "simple" | "complex" | "scanned",
        "tables_found": 3,
        "extraction_timestamp": "...",
        "was_repaired": False,
        "repair_warnings": None,
        "extraction_errors": None,
        "empty_pages": 0,
        "needs_ocr": False,
        "quality_score": 85.0,
    },
    "error": "",
}
```

---

## 10. PDF Writer (workers/pdf_writer.py)

- ReportLab based
- `_sanitize_filename(query)` → `minerva_{query_name}.pdf`
- `title=query` in SimpleDocTemplate
- TA_JUSTIFY alignment
- `_clean_line()` strips markdown symbols (#, **, *, backticks)
- URL detection → clickable teal links
- Returns `(output_path, filename)` tuple
- Export uses manual `Response` with `Content-Disposition: attachment; filename={filename}` (no quotes — avoids .pdf_ browser bug)

---

## 11. Database Model (db/models.py)

```python
class Job(Base):
    __tablename__ = "jobs"
    id               = Column(Integer, primary_key=True, autoincrement=True)
    request_id       = Column(String, unique=True, nullable=False, index=True)
    job_type         = Column(String, nullable=False)   # scrape, pdf, pdf_summary, research
    input            = Column(String, nullable=False)   # url, file path, or query
    status           = Column(String, nullable=False)   # success, failed
    failure_reason   = Column(String, nullable=True)
    strategy_used    = Column(String, nullable=True)    # web, pdf
    word_count       = Column(Integer, nullable=True)
    duration_seconds = Column(Float, nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow, nullable=False)
```

**Note:** Planned migration to PostgreSQL post-deployment. SQLAlchemy used throughout so only connection string change needed.

---

## 12. Frontend Pages

### Login.jsx
- Boot sequence animation with 9 lines, sequential delays (400ms to 3600ms)
- `bootStarted` ref prevents double execution (StrictMode removed from main.jsx)
- JetBrains Mono font, teal + dark navy theme
- IST timezone clock
- JWT stored in localStorage: `minerva_token`, `minerva_user`
- Redirects to `/welcome` on success

**Boot sequence lines:**
1. Initializing system core
2. Loading MCP server
3. Starting PDF extraction engine
4. Starting web scraping pipeline
5. Connecting to LLM
6. Initializing web search
7. Starting API gateway
8. Connecting to database
9. Awaiting operator authentication [WARN]

### Welcome.jsx
- Operator bar: logged in user + IST clock
- Hero: breadcrumb, title, 2-line description, system status pill, Start Research button
- 4 stats cards: Total Jobs, Success Rate, Avg Duration, Words Processed (from /stats endpoint)
- Recent Activity table: Type, Input, Status, Duration, Time (last 8 jobs from /history)
- Attribution footer: Built at Aiolos Cloud + Developed by NextGen Thinker + 4 dev LinkedIn chips + copyright
- max-width: 100%, padding: 72px 48px

### Home.jsx (Research Query)
- max-width: 7xl, padding: px-8 py-10
- 3-col grid: 2 cols input, 1 col config
- Query textarea + conditional URL or filepath input
- Source Mode: Web Search | PDF Document
- System Status panel: pings /health, shows online/offline/checking
- Execute button: transparent + dashed border when disabled, teal + glow when active

### Results.jsx
- max-width: 7xl, padding: px-8 py-10
- 4-col grid: 1 col execution log, 3 cols output
- Query bar: teal "query" label + separator + query text + mode badge
- Execution log: 5 steps with animated progress
- View switcher: RENDERED | MD | JSON
- Export: ↓ Export (MD/JSON), ↗ PDF (opens new tab)
- Output panel: min-height 600px
- Parameters panel below execution log

### Dashboard.jsx
- Stats cards from /stats endpoint (not calculated from job array)
- Charts Row 1: Pie (Job Type Distribution) + Bar (Success vs Failed) — 2 col grid, height 220px
- Charts Row 2: Line (Duration Over Time) — full width, height 200px
- History table: Type, Input, Status, Strategy, Words, Duration, Time
- Filters: status (success/failed), job_type (scrape/pdf/pdf_summary/research)
- Timezone fix: `new Date(job.created_at + 'Z').toLocaleString()`

### Capabilities.jsx
- 4 sections with section label + horizontal divider
- Section 1 — Core Tools: 4 cards (Web Search, Web Scraping, PDF Extraction, AI Synthesis)
- Section 2 — Research Pipeline: horizontal step flow (01 Input → 02 Collect → 03 Synthesize → 04 Export)
- Section 3 — Export Formats: 3 horizontal cards (MD, JSON, PDF)
- Section 4 — System Specs: 4 stat cards (5 MCP Tools, 3 Export Formats, 2 Research Modes, 24h Session)
- All cards: teal border glow on hover, translateY(-2px) lift
- max-width: 100%, padding: 72px 48px

---

## 13. Design System

### Colors
```
Background:  #0a0f1e  (deep dark navy)
Panel:       #0d1424
Border:      #1e2d40
Accent:      #00d4aa  (sharp teal)
Text:        #e2e8f0
Muted:       #64748b
Error:       #ef4444
Amber:       #f59e0b
```

### Typography
- UI: JetBrains Mono (monospace throughout)
- Loaded via Google Fonts in index.html

### Navbar
- Height: 48px, fixed top
- Owl SVG logo (teal on dark, drawn in SVG coordinates)
- Links: Welcome | Research | Capabilities | Dashboard | Logout
- Active link: teal color + #1e2d40 background
- Logout: red text, border

### Animations (src/index.css)
```css
@keyframes fadeUp       /* page sections */
@keyframes slideUp      /* login panel appearance */
@keyframes slideInLine  /* boot sequence lines */
@keyframes pageEnter    /* page transitions — applied via .page-enter class */
```

### Card Hover Effect (Capabilities page)
```
border-color: rgba(0,212,170,0.5)
box-shadow: 0 0 24px rgba(0,212,170,0.08), 0 0 0 1px rgba(0,212,170,0.1)
transform: translateY(-2px)
```

---

## 14. services/api.js Exports

```javascript
checkHealth()
scrapeURL(url)
extractPDF(filePath)
extractPDFSummary(filePath)
getHistory(params)         // params: {status, job_type, limit}
getStats()
research({query, mode, url, file_path})
exportPDF(report, query)
exportMarkdown(report, query, mode)
exportJSON(report, query, mode)
previewJSON(report, query, mode)
login(username, password)
```

BASE_URL = "http://localhost:8000"
PDF/MD/JSON exports use `{ responseType: "blob" }`
Filename extracted from content-disposition header: `/filename=["']?([^"']+)["']?/`

---

## 15. JSON Parser (main.py)

Both `/preview/json` and `/export/json` use the same parser.

Handles heading styles:
- `===` underline style (report title)
- `###` h3 headings (primary — enforced by system prompt)
- `##` h2 headings (fallback)

`_save_section(heading, content, sections)` — 3 args, no sources param.

Excluded from sections array: summary, introduction, sources, conclusion (go to summary field or ignored)

Output structure:
```json
{
  "query": "...",
  "mode": "web|pdf",
  "generated_at": "2026-03-06 17:18:02 UTC",
  "summary": "extracted from Introduction or Summary section",
  "sections": [
    {"heading": "Section Title", "content": "full section text"}
  ]
}
```

---

## 16. Known Issues & Decisions

| Issue | Decision |
|---|---|
| Double API calls | Removed React.StrictMode from main.jsx |
| PDF filename browser bug | Remove quotes from Content-Disposition header |
| Timezone wrong | Append 'Z' to UTC timestamps, use IST for clocks |
| URL-only research wrong topic | Skip Tavily when URL provided, use direct scrape |
| Stats frozen at 100 | /stats endpoint queries full DB, not job array |
| pdfplumber table order wrong | Sort content blocks by Y coordinate |
| PaddleOCR slow startup | Singleton pattern + lazy import |

---

## 17. Remaining To-Do

### Active
1. **Write PDF as MCP tool** — add `write_pdf` tool to server.py for Claude Desktop
2. **Pagination on history table** — Dashboard job history currently limited to 100

### Post Deployment
3. **PostgreSQL migration** — change connection string in db/session.py, install psycopg2
4. **Grafana integration** — /metrics endpoint is Prometheus-compatible, ready


---

## 18. Running the Project

### Backend
```bash
cd unified_mcp_server
python run.py
# Runs on http://localhost:8000
```

### Frontend
```bash
cd unified_mcp_server/frontend
npm run dev
# Runs on http://localhost:5173
```

### MCP Server (Claude Desktop)
```bash
cd unified_mcp_server
python server.py
```

### Default Credentials
```
Username: minerva
Password: minerva@2025
```

---

## 19. Dependencies (requirements.txt — install order matters)

```
fastapi
uvicorn
python-dotenv
httpx
playwright
pymupdf
tavily-python
groq
sqlalchemy
prometheus-fastapi-instrumentator
python-multipart
reportlab
python-jose[cryptography]
passlib
pillow>=9.0.0
pdfplumber==0.11.0
paddlepaddle==2.6.1
paddleocr==2.7.3
```

**PaddleOCR install order:**
```bash
pip install pillow --break-system-packages
pip install pdfplumber --break-system-packages
pip install paddlepaddle --break-system-packages
pip install paddleocr --break-system-packages
```

---

## 20. Judge Defense Points

- **"Why MCP?"** — MCP combines search + scrape + PDF in a unified pipeline. No off-the-shelf tool does all three. Claude Desktop compatible.
- **"Why Tavily?"** — Purpose-built for LLM use cases. Swappable via single file change in core/search.py.
- **"AI provider agnostic"** — Swapped Gemini to Groq without touching MCP tools. Same swap works for any OpenAI-compatible provider.
- **"Why multi-engine PDF?"** — Real-world PDFs are not uniform. Text-only, scanned, and table-heavy PDFs each need different extraction strategies for fidelity.
- **"robots.txt compliance"** — Ethical scraping, production-level thinking.
- **"Prometheus metrics"** — Production observability awareness, Grafana-ready.
- **"JWT auth"** — Security-aware design, not just a demo tool.
- **"Why SQLite?"** — Appropriate for current scale. PostgreSQL migration planned, SQLAlchemy abstracts the switch.

**Database:** SQLite via SQLAlchemy for current demo scope. SQLAlchemy ORM abstracts the connection layer — PostgreSQL migration requires a single connection string change in db/session.py. SQLite handles all hackathon/presentation workloads without issue; concurrent multi-user write scaling is the only production concern, addressed in the PostgreSQL migration plan.
---

## 21. Streaming Research Output

### How it works
The `/research` endpoint was converted from a blocking response to a
Server-Sent Events (SSE) stream. The LLM tokens are streamed from Groq
and forwarded to the frontend in real time.

**Backend — core/llm.py**
- Added `stream_research(prompt)` — async generator, calls Groq with
  `stream=True`, yields SSE frames:
  - `data: <token>\n\n` — escaped text chunk
  - `data: [FULL]<base64>\n\n` — full assembled response for DB logging
  - `data: [DONE]\n\n` — stream complete
  - `data: [ERROR]<msg>\n\n` — failure

**Backend — api/main.py**
- `/research` now returns `StreamingResponse(media_type="text/event-stream")`
- Prompt building logic is identical to before — only the LLM call changed
- DB logging happens inside the `finally` block after stream ends
- Added `StreamingResponse` to fastapi.responses imports
- `run_research` import removed (unused), replaced by `stream_research`

**Frontend — services/api.js**
- `research()` replaced — now uses native `fetch` + `ReadableStream`
  instead of axios (axios does not support SSE)
- Accepts three callbacks: `onChunk(token)`, `onDone(fullText)`,
  `onError(msg)`
- Parses SSE frames manually, unescapes `\\n` back to newlines
- Decodes base64 `[FULL]` frame via `atob()` to recover full text

**Frontend — Results.jsx**
- Added state: `isThinking`, `isStreaming`, `streamedText`, `renderReady`
- `isThinking` — true while backend is building prompt, before first token
  - Shows three bouncing teal dots + "Thinking..." label
- `isStreaming` — true while tokens are arriving
  - Renders `<pre>` raw text for visible typewriter effect
  - Blinking teal cursor appended after last token
- On stream end — 400ms delay, then `done` flips, rendered markdown
  fades in with 600ms easeIn transition

---

## 22. Talk with Report / Ask Minerva

A post-report Q&A feature. After a report is generated, the user can
open a chat panel to ask follow-up questions grounded in the report.

**Backend — core/llm.py**
- Added `CHAT_SYSTEM_PROMPT` — separate from `SYSTEM_PROMPT`
- Added `chat_with_report(report, original_query, message, history)`
  - Non-streaming, returns plain string
  - Injects full report as context in first user turn
  - Supports multi-turn via `history` array
  - temperature: 0.2, max_tokens: 2048

**Chat system prompt behavior (3-case decision flow):**
1. Topic in report → anchor to report, expand with own knowledge
2. Topic partially covered → state what report says, extend beyond it
3. Topic not in report → flag it in one line, answer fully anyway

**Backend — api/main.py**
- Added `ReportChatRequest` Pydantic model
- Added `POST /chat/report` — calls `chat_with_report()`, returns
  `{"reply": "..."}`, not logged to DB

**Frontend — services/api.js**
- Added `chatWithReport(report, query, message, history)` — standard
  axios POST

**Frontend — Results.jsx**
- Chat panel slides in below output panel via `AnimatePresence`
- Toggle button in output panel header: `⌥ Ask Minerva`
- Multi-turn conversation, in-memory only (cleared on navigation)
- User messages right-aligned (teal border)
- Assistant replies left-aligned, rendered as markdown
- `minerva is thinking...` typing indicator while waiting
- Enter to send, Shift+Enter for newlines
- Clear button resets conversation without closing panel