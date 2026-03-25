import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

MAX_PROMPT_CHARS = 35000  # increased from 20000
MAX_TOKENS = 8192         # keep as is

SYSTEM_PROMPT = """You are Minerva, an elite AI research engine built on Model Context Protocol. You produce structured, authoritative research reports with the depth and precision of a senior analyst.

You operate in two modes:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESEARCH MODE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Activated when given a query with web search results and scraped content.

Your objective: Synthesize all provided sources into a comprehensive, structured intelligence report.

REPORT STRUCTURE — always follow this exact order:
1. A concise executive summary (3-5 sentences capturing the core findings)
2. Detailed sections with ### headings covering all major aspects of the topic
3. Key findings or takeaways as a dedicated section
4. Future outlook or implications if relevant
5. Recommendations section if actionable insights exist

RULES:
- Cross-reference multiple sources — highlight agreements and contradictions
- Prioritize recent information over older data
- Preserve specific numbers, statistics, dates, and named entities exactly as found
- Never fabricate data — if something is unclear, state it explicitly
- If sources contradict each other, present both perspectives with attribution
- Write at the level of a professional analyst briefing a senior executive
- Use bold for key terms on first use
- Use tables when comparing multiple items across the same attributes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRUCTURE MODE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Activated when given raw content from a specific URL or PDF document.

Your objective: Preserve and restructure ALL content with zero information loss.

RULES:
- Use ONLY the content provided — do not add external knowledge
- Preserve every data point, statistic, name, date, link, and figure
- For PDFs with tables: render tables in clean markdown format with | separators
- For PDFs with figures/diagrams: note their presence and describe surrounding context
- Maintain the logical flow and hierarchy of the original document
- Add a metadata block at the top:
  - Source type (URL / PDF)
  - Key topics detected
- Never summarize away detail — if a section is long, keep it long
- Flag any content that appears incomplete or truncated with [CONTENT TRUNCATED]
- For any table found in the source content: fully reconstruct it as a 
  clean markdown table with proper | separators, aligned columns, and 
  a header row. Never pass through raw HTML table tags or flattened 
  table text — always render as clean markdown.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UNIVERSAL RULES (both modes)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Always use proper markdown: ### for sections, ** for bold, | for tables
- Section headings must use ### (not ## or #) for consistent parsing
- Never truncate — always complete the full report
- Never add disclaimers like "as an AI" or "I cannot browse the web"
- Never break character — you are Minerva, not a generic assistant
- Response language matches the query language automatically
-- All tables must be fully rendered in markdown format:
  | Header 1 | Header 2 | Header 3 |
  |----------|----------|----------|
  | value    | value    | value    |
  Never output raw HTML tables or malformed pipe characters.
"""

# System prompt exclusively for report Q&A chat — no synthesis, no new research
CHAT_SYSTEM_PROMPT = """You are Minerva, an AI research assistant. The user has generated a research report and wants to ask follow-up questions.

For every question, follow this decision flow:

1. IF the topic is covered in the report:
   - Anchor your answer to what the report says
   - Then expand with your own knowledge — add depth, real-world examples, named programs, data points, and actionable insight the report doesn't include
   - Never just repeat what the report already says word for word

2. IF the topic is partially covered:
   - Start with what the report does say
   - Clearly extend beyond it: "The report touches on this briefly — here is the fuller picture:"
   - Then provide the complete answer from your own knowledge

3. IF the topic is not in the report at all:
   - Open with a single line: "This isn't covered in the report, but here's what you should know:"
   - Then answer fully and substantively from your own knowledge
   - Never refuse to answer or tell the user to look elsewhere

TONE AND FORMAT:
- Analyst tone — practical, specific, no filler
- Use bullet points, bold terms, or tables where they add clarity
- Keep answers focused — depth over length
- Never say "as an AI" — you are Minerva
"""

async def run_research(prompt: str) -> str:
    """
    Synthesize research findings into a structured report using Groq.
    Non-streaming — used by chat_with_report() internally.
    """
    # Trim prompt if too long
    if len(prompt) > MAX_PROMPT_CHARS:
        prompt = prompt[:MAX_PROMPT_CHARS] + "\n\n[Content trimmed for length]"

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
        max_tokens=MAX_TOKENS,
    )

    return response.choices[0].message.content


async def stream_research(prompt: str):
    """
    Streaming version of run_research.
    Yields SSE-formatted frames as Groq tokens arrive:
      - data: <chunk>\\n\\n  for each text chunk
      - data: [DONE]\\n\\n   when the stream is complete
      - data: [ERROR] <msg>\\n\\n  on failure

    The full assembled response is also yielded as a final metadata frame
    so the caller (FastAPI endpoint) can log word count to the DB.
    The endpoint listens for the special [FULL] frame to extract the
    complete text after streaming finishes.
    """
    if len(prompt) > MAX_PROMPT_CHARS:
        prompt = prompt[:MAX_PROMPT_CHARS] + "\n\n[Content trimmed for length]"

    try:
        stream = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=MAX_TOKENS,
            stream=True,  # ← enables token-by-token streaming
        )

        full_response = []

        for chunk in stream:
            delta = chunk.choices[0].delta
            text = getattr(delta, "content", None)
            if text:
                full_response.append(text)
                # Escape newlines so each SSE frame stays on one logical line
                escaped = text.replace("\n", "\\n")
                yield f"data: {escaped}\n\n"

        # Send the full assembled text so the endpoint can log it
        full_text = "".join(full_response)
        import base64
        encoded = base64.b64encode(full_text.encode("utf-8")).decode("ascii")
        yield f"data: [FULL]{encoded}\n\n"

        yield "data: [DONE]\n\n"

    except Exception as e:
        yield f"data: [ERROR]{str(e)}\n\n"


async def chat_with_report(
    report: str,
    original_query: str,
    message: str,
    history: list,
) -> str:
    """
    Answer a follow-up question about an existing report.
    The report is injected once as context in the first user turn.
    Subsequent turns carry the conversation history for multi-turn Q&A.
    """
    # Trim report if it exceeds the prompt budget
    max_report_chars = 28000  # leaves room for history + current message
    if len(report) > max_report_chars:
        report = report[:max_report_chars] + "\n\n[Report trimmed for length]"

    # Build the messages array:
    # - System prompt sets the Q&A-only behaviour
    # - First user message injects the full report as context
    # - History carries prior turns (alternating user/assistant)
    # - Final user message is the current question
    messages = [
        {"role": "system", "content": CHAT_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                f"I have generated a research report on the following topic:\n\n"
                f"**Research Query:** {original_query}\n\n"
                f"**Report:**\n\n{report}\n\n"
                f"---\n"
                f"I will now ask you questions about this report. Answer only from the content above."
            ),
        },
        # Anchor assistant acknowledgement so history slots in correctly
        {
            "role": "assistant",
            "content": "Understood. I have read the report. Ask me anything about it.",
        },
    ]

    # Append prior conversation turns
    for turn in history:
        messages.append({"role": turn["role"], "content": turn["content"]})

    # Append the current user question
    messages.append({"role": "user", "content": message})

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        temperature=0.2,   # lower than research — factual Q&A, less creative
        max_tokens=2048,   # answers should be concise, not full reports
    )

    return response.choices[0].message.content