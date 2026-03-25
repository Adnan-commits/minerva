"""
Use this to run the FastAPI app on Windows instead of calling uvicorn directly.

The ProactorEventLoop policy MUST be set before uvicorn creates its event loop,
which happens before api.main is even imported. Setting it in main.py is too late
when uvicorn is launched from the CLI. This script guarantees correct ordering.

Usage:
    python run.py
"""
import asyncio
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import uvicorn

if __name__ == "__main__":
    uvicorn.run("api.main:app", reload=False)