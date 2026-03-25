# 🦉 Minerva
### AI-Powered Research Engine · Built on Model Context Protocol

> An MCP-powered research engine that searches the web, scrapes pages, extracts PDFs, and synthesizes collected data into structured reports — exportable as PDF, Markdown, or JSON.

**Developed by NextGen Thinker @ [Aiolos Cloud Solutions](https://aiolos.cloud/index)**

---

## The Problem

Researchers and professionals today must manually search the web, open multiple tabs, read through pages, and extract content from documents — then piece it all together into a coherent report. This process is slow, inconsistent, and difficult to scale.

## How Minerva Solves It

Minerva automates this entire workflow. Given a query, a URL, or a PDF document, it autonomously gathers information from multiple sources and synthesizes it into a structured, export-ready research report using a large language model. The result is delivered in seconds, not hours.

What previously took hours of manual research and writing is reduced to a single query.

**The pipeline:**

1. **Search** — queries the web via Tavily API
2. **Scrape** — extracts content from the top result pages using Playwright + HTTPX
3. **Synthesize** — sends collected data to Groq (llama-3.3-70b-versatile) for structured report generation
4. **Export** — delivers the report as PDF, Markdown, or JSON for any downstream workflow

**PDF mode** — drop in a local PDF and Minerva extracts, structures, and synthesizes it using a multi-engine routing system (PyMuPDF → pdfplumber → PaddleOCR) that automatically detects document type.

**Ask Minerva** — after a report is generated, a chat panel lets you ask follow-up questions grounded in the report context, without re-running the research.

---

## Production Metrics *(as of March 2026)*

| Metric | Value |
|---|---|
| Total Jobs Completed | 168 |
| Success Rate | 88% |
| Avg Job Duration | 48.59s |
| Words Processed | 73,900+ |

---

## Tech Stack

| Layer | Technology |
|---|---|
| MCP Server | Python, FastMCP |
| Web Search | Tavily API |
| Web Scraping | Playwright + HTTPX |
| PDF Extraction | PyMuPDF · pdfplumber · PaddleOCR |
| PDF Writing | ReportLab |
| LLM | Groq — llama-3.3-70b-versatile |
| Backend API | FastAPI |
| Database | SQLite via SQLAlchemy |
| Metrics | Prometheus |
| Frontend | React + Vite + Tailwind v3 + shadcn/ui + Framer Motion |
| Auth | JWT via python-jose + passlib |

---

## Project Structure

```
unified_mcp_server/
├── server.py                    # MCP server — 5 tools exposed via FastMCP
├── core/
│   ├── scraper.py               # Playwright/HTTPX scraping
│   ├── search.py                # Tavily web search
│   ├── orchestrator.py          # ScrapeOrchestrator
│   └── llm.py                   # Groq LLM synthesis + streaming + chat
├── workers/
│   ├── pdf_worker.py            # Multi-engine PDF extraction
│   └── pdf_writer.py            # PDF report generation (ReportLab)
├── api/
│   └── main.py                  # FastAPI gateway — all endpoints
├── db/
│   ├── models.py                # Job table (SQLAlchemy)
│   └── session.py               # SQLite session
├── utils/
│   ├── structured_logger.py
│   └── logging_config.py
└── frontend/                    # React + Vite app
    └── src/
        ├── pages/               # Login, Welcome, Home, Results, Dashboard, Capabilities
        ├── components/
        └── services/api.js      # All API calls
```

---

## Running the Project

### Prerequisites
- Python 3.10+
- Node.js 18+
- API keys: Tavily, Groq (see `.env.example`)

### 1. Configure environment
```bash
cp .env.example .env
# Fill in your TAVILY_API_KEY and GROQ_API_KEY
```

### 2. Install Python dependencies
```bash
pip install -r requirements.txt

# PaddleOCR requires a specific install order:
pip install pillow
pip install pdfplumber==0.11.0
pip install paddlepaddle==2.6.1
pip install paddleocr==2.7.3

# Install Playwright browser
playwright install chromium
```

### 3. Start the backend
```bash
cd unified_mcp_server
python run.py
# API runs on http://localhost:8000
```

### 4. Start the frontend
```bash
cd unified_mcp_server/frontend
npm install
npm run dev
# UI runs on http://localhost:5173
```

### Default credentials
```
Username: minerva
Password: minerva@2025
```

---

## MCP Tools

Five tools exposed via FastMCP — usable directly in Claude Desktop:

| Tool | Description |
|---|---|
| `web_search` | Tavily-powered web search |
| `scrape_url` | Full page scrape via Playwright + HTTPX |
| `extract_pdf` | Multi-engine PDF extraction |
| `extract_pdf_summary` | PDF metadata only (fast) |
| `view_extracted_json` | View previously saved extraction results |

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/login` | JWT login |
| POST | `/research` | Core research — SSE streaming response |
| POST | `/pdf/extract` | Direct PDF extraction |
| POST | `/web/scrape` | Direct URL scrape |
| POST | `/export/pdf` | PDF export |
| POST | `/export/markdown` | Markdown export |
| POST | `/export/json` | JSON export |
| POST | `/chat/report` | Ask Minerva (report Q&A) |
| GET | `/stats` | Aggregate metrics |
| GET | `/history` | Job history |
| GET | `/health` | Health check |
| GET | `/metrics` | Prometheus metrics |

Full endpoint reference with request/response shapes is in `Minerva_Context.md`.

---

## PDF Extraction — Engine Routing

Minerva automatically selects the right extraction engine based on document type:

```
Sample first 5 pages
│
├─ avg < 50 chars/page  →  SCANNED   →  PaddleOCR  (fallback: PyMuPDF)
└─ avg ≥ 50 chars/page
        ├─ tables found  →  COMPLEX   →  pdfplumber (fallback: PyMuPDF)
        └─ no tables     →  SIMPLE    →  PyMuPDF    (fast path)
```

---

## Roadmap

- [ ] `write_pdf` as MCP tool for Claude Desktop
- [ ] Pagination on Dashboard job history table
- [ ] PostgreSQL migration (SQLAlchemy abstracts the switch — connection string change only)
- [ ] Grafana dashboard via existing `/metrics` Prometheus endpoint

---

## Team

**NextGen Thinker @ Aiolos Cloud Solutions**

| Name | LinkedIn |
|---|---|
| Adnan Bardgujar | [linkedin.com/in/adnan-bardgujar-b43b7a25b](https://www.linkedin.com/in/adnan-bardgujar-b43b7a25b/) |
| Saif Madre | [linkedin.com/in/saif-madre-7986872ba](https://www.linkedin.com/in/saif-madre-7986872ba/) |
| Mohd Salique Khan | [linkedin.com/in/mohdsaliquekhan78622](https://www.linkedin.com/in/mohdsaliquekhan78622/) |
| Fazal Shaikh | [linkedin.com/in/fazal-shaikh-555404195](https://www.linkedin.com/in/fazal-shaikh-555404195/) |

---

*For full architecture details, design system, known issues, and developer handoff context — see `Minerva_Context.md`.*
