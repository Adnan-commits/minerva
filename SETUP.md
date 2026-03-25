# Minerva — Setup Guide

Complete first-time installation and startup guide. Follow each section in order.

---

## Prerequisites

Make sure the following are installed on your machine before starting.

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.10+ | Check with `python --version` |
| Node.js | 18+ | Check with `node --version` |
| npm | 9+ | Comes with Node.js |
| Git | Any | For cloning the repo |

You will also need API keys for two external services:

- **Tavily** — web search API. Get a free key at [tavily.com](https://tavily.com)
- **Groq** — LLM inference API. Get a free key at [console.groq.com](https://console.groq.com)

---

## Step 1 — Clone the Repository

```bash
git clone <repository-url>
cd <repository-folder>
```

---

## Step 2 — Configure Environment Variables

Copy the example environment file and fill in your API keys.

```bash
cp .env.example .env
```

Open `.env` and set the following values:

```env
TAVILY_API_KEY=your_tavily_key_here
GROQ_API_KEY=your_groq_key_here
ADMIN_USERNAME=minerva
ADMIN_PASSWORD=minerva@2025
JWT_SECRET=minerva-secret-key-change-in-production
```

> ⚠️ `ADMIN_USERNAME` and `ADMIN_PASSWORD` are the login credentials for the Minerva UI. Change these before any shared or production deployment.

> ⚠️ `JWT_SECRET` should be changed to a long random string in any environment beyond local development.

---

## Step 3 — Install Python Dependencies

Navigate to the project root and install the base requirements first.

```bash
cd unified_mcp_server
pip install -r requirements.txt
```

### PaddleOCR — Install in This Exact Order

PaddleOCR has strict dependency ordering. Installing out of order causes runtime failures. Run these four commands separately, one at a time:

```bash
pip install pillow --break-system-packages
pip install pdfplumber==0.11.0 --break-system-packages
pip install paddlepaddle==2.6.1 --break-system-packages
pip install paddleocr==2.7.3 --break-system-packages
```

> ℹ️ The `--break-system-packages` flag is required on systems with externally managed Python environments (Ubuntu 22.04+, macOS with Homebrew Python). If you are using a virtual environment, you can omit it.

### Install Playwright Browser

Minerva uses Playwright for JavaScript-rendered page scraping. After installing the Python package, you must also install the Chromium browser binary:

```bash
playwright install chromium
```

---

## Step 4 — Install Frontend Dependencies

```bash
cd unified_mcp_server/frontend
npm install
```

---

## Step 5 — Start the Backend

From the project root:

```bash
cd unified_mcp_server
python run.py
```

The API will be available at `http://localhost:8000`.

Verify it is running:

```bash
curl http://localhost:8000/health
```

This returns the system status — confirming the backend is up and all services are reachable.

---

## Step 6 — Start the Frontend

In a separate terminal:

```bash
cd unified_mcp_server/frontend
npm run dev
```

The UI will be available at `http://localhost:5173`.

Open it in your browser and log in with:

```
Username: minerva
Password: minerva@2025
```

---

## Step 7 — (Optional) MCP Server for Claude Desktop

If you want to use Minerva's tools directly inside Claude Desktop, run the MCP server in a separate terminal:

```bash
cd unified_mcp_server
python server.py
```

Then register it in your Claude Desktop MCP configuration. The five tools available are: `web_search`, `scrape_url`, `extract_pdf`, `extract_pdf_summary`, `view_extracted_json`.

---

## Startup Sequence Summary

For day-to-day development, you need two terminals running:

| Terminal | Command | URL |
|---|---|---|
| 1 — Backend | `cd unified_mcp_server && python run.py` | http://localhost:8000 |
| 2 — Frontend | `cd unified_mcp_server/frontend && npm run dev` | http://localhost:5173 |

The MCP server (`python server.py`) is only needed for Claude Desktop integration.

---

## Common Issues

### `playwright install` not found
The Playwright CLI is installed with the Python package. If the command is not found, try:
```bash
python -m playwright install chromium
```

### PaddleOCR import errors at runtime
This is almost always a dependency ordering issue. Uninstall all four PaddleOCR-related packages and reinstall them in the exact order listed in Step 3.

### Frontend shows `Network Error` or cannot reach API
Confirm the backend is running on port `8000`. The frontend is hardcoded to `http://localhost:8000` in `frontend/src/services/api.js`. CORS is configured for `http://localhost:5173` only — do not change the frontend dev server port without updating `api/main.py` as well.

### `.env` not picked up
Ensure the `.env` file is in the `unified_mcp_server/` directory, not the repo root. The backend reads it from the same directory as `run.py`.

---

*For architecture details, endpoint reference, and developer context — see `Minerva_Context.md`.*
