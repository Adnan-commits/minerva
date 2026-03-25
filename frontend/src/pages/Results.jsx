import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { research, exportPDF, exportMarkdown, exportJSON, previewJSON, chatWithReport } from "../services/api";

const STEPS = [
  { id: 1, label: "Initializing query", detail: "Parsing input parameters" },
  { id: 2, label: "Searching the web", detail: "Fetching relevant sources" },
  { id: 3, label: "Scraping sources", detail: "Extracting page content" },
  { id: 4, label: "Analyzing content", detail: "Processing with LLM" },
  { id: 5, label: "Generating report", detail: "Synthesizing findings" },
];

export default function Results() {
  const { state } = useLocation();
  const navigate = useNavigate();

  // Research state
  const [currentStep, setCurrentStep] = useState(0);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState(null);       // final full text — used for exports/chat
  const [error, setError] = useState(null);
  const [selectedView, setSelectedView] = useState(null); // null | 'md' | 'json'
  const [jsonPreview, setJsonPreview] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  // Streaming state
  const [isThinking, setIsThinking] = useState(false);   // true = waiting for first token
  const [streamedText, setStreamedText] = useState("");  // accumulates tokens as they arrive
  const [isStreaming, setIsStreaming] = useState(false);  // true = tokens actively arriving
  const [renderReady, setRenderReady] = useState(false);
  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);
  const chatBottomRef = useRef(null);

  useEffect(() => {
    if (!state?.query) {
      navigate("/");
      return;
    }
    runResearch();
  }, []);

  // Auto-scroll chat to latest message
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, chatLoading]);

  const runResearch = async () => {
    // Step ticker — advances execution log while searching/scraping happens
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setCurrentStep(step);
      if (step >= STEPS.length - 1) clearInterval(interval);
    }, 1500);

    // Show "Thinking..." while backend is building the prompt + waiting for first token
    setIsThinking(true);

    await research(
      {
        query: state.query,
        mode: state.mode,
        url: state.url || "",
        file_path: state.filePath || "",
      },

      // onChunk — called for every token that arrives
      (token) => {
        // First token arriving — switch from Thinking to streaming mode
        setIsThinking(false);
        setIsStreaming(true);
        clearInterval(interval);
        setCurrentStep(STEPS.length);
        setStreamedText((prev) => prev + token);
      },

      // onDone — called once with the complete assembled text (from [FULL] frame)
      (fullText) => {
        setResult(fullText);
        setIsStreaming(false);
        setTimeout(() => {
        setDone(true);
        setRenderReady(true);
        }, 400);
      },

      // onError — called if the stream fails
      (errMsg) => {
        clearInterval(interval);
        setIsThinking(false);
        setIsStreaming(false);
        setError(errMsg || "Research failed. Please try again.");
        setDone(true);
      },
    );
  };

  const handleViewChange = async (view) => {
    setSelectedView(view === "rendered" ? null : view);
    setExportError(null);

    if (view === "json" && !jsonPreview) {
      try {
        const res = await previewJSON(result, state.query, state.mode);
        setJsonPreview(res.data);
      } catch (err) {
        setExportError("Failed to generate JSON preview.");
      }
    }
  };

  const handleOpenPDF = async () => {
    try {
      const res = await exportPDF(result, state.query);
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      setExportError("Failed to open PDF.");
    }
  };

  const handleExport = async () => {
    if (!selectedView || exporting) return;
    setExporting(true);
    setExportError(null);

    try {
      let res;
      if (selectedView === "md") {
        res = await exportMarkdown(result, state.query, state.mode);
        const blob = new Blob([res.data], { type: "text/markdown" });
        const url = window.URL.createObjectURL(blob);
        const contentDisposition = res.headers["content-disposition"];
        const filenameMatch = contentDisposition?.match(/filename=["']?([^"']+)["']?/);
        const filename = filenameMatch ? filenameMatch[1].trim() : "minerva_report.md";
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
      } else if (selectedView === "json") {
        res = await exportJSON(result, state.query, state.mode);
        const blob = new Blob([res.data], { type: "application/json" });
        const url = window.URL.createObjectURL(blob);
        const contentDisposition = res.headers["content-disposition"];
        const filenameMatch = contentDisposition?.match(/filename=["']?([^"']+)["']?/);
        const filename = filenameMatch ? filenameMatch[1].trim() : "minerva_report.json";
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      setExportError(`${selectedView.toUpperCase()} export failed. Please try again.`);
    } finally {
      setExporting(false);
    }
  };

  const handleChatSend = async () => {
    const message = chatInput.trim();
    if (!message || chatLoading || !result) return;

    setChatInput("");
    setChatError(null);

    const updatedHistory = [...chatHistory, { role: "user", content: message }];
    setChatHistory(updatedHistory);
    setChatLoading(true);

    try {
      const res = await chatWithReport(result, state.query, message, chatHistory);
      const reply = res.data.reply;
      setChatHistory((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setChatError("Failed to get a response. Please try again.");
      setChatHistory(chatHistory);
    } finally {
      setChatLoading(false);
    }
  };

  const handleChatKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  };

  const renderOutput = () => {
    // ── 1. Error state ───────────────────────────────────────────────────────
    if (error) {
      return (
        <div
          className="text-sm font-mono p-3 rounded border"
          style={{ color: "#ef4444", borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.05)" }}
        >
          ❌ {error}
        </div>
      );
    }

    // ── 2. Thinking — waiting for first token ────────────────────────────────
    if (isThinking) {
      return (
        <div className="flex items-center gap-3 mt-4">
          {/* Three pulsing dots */}
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0.2, 1, 0.2], y: [0, -4, 0] }}
                transition={{ repeat: Infinity, duration: 1, delay: i * 0.18 }}
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: "#00d4aa" }}
              />
            ))}
          </div>
          <span className="text-sm font-mono" style={{ color: "#64748b" }}>
            Thinking...
          </span>
        </div>
      );
    }

    // ── 3. Streaming — tokens arriving, render live markdown ─────────────────
    if (isStreaming || (streamedText && !done)) {
      return (
      <div>
        <pre
          className="text-sm whitespace-pre-wrap leading-relaxed"
          style={{ color: "#e2e8f0", fontFamily: "JetBrains Mono, monospace" }}
        >
          {streamedText}
        </pre>
      {/* Blinking cursor */}
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ repeat: Infinity, duration: 0.8 }}
          className="inline-block w-0.5 h-4 ml-0.5 align-middle"
          style={{ backgroundColor: "#00d4aa" }}
      />
    </div>
  );
}

    // ── 4. Done — static views ───────────────────────────────────────────────
    if (!done) {
      // Fallback loading state (pre-thinking, very brief)
      return (
        <div className="flex items-center gap-2 mt-4">
          <motion.div
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: "#00d4aa" }}
          />
          <span className="text-sm font-mono" style={{ color: "#64748b" }}>
            Initializing...
          </span>
        </div>
      );
    }

    if (selectedView === "md") {
      return (
        <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed" style={{ color: "#e2e8f0" }}>
          {result}
        </pre>
      );
    }

    if (selectedView === "json") {
      return (
        <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed" style={{ color: "#e2e8f0" }}>
          {jsonPreview ? JSON.stringify(jsonPreview, null, 2) : "Loading preview..."}
        </pre>
      );
    }

    // Default — rendered markdown (post-stream, fully settled)
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="prose prose-invert prose-sm max-w-none"
        style={{ color: "#e2e8f0" }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
      </motion.div>
    );
  };

  return (
    <div className="page-enter max-w-7xl mx-auto px-8 py-10">

      {/* Page Header */}
      <div className="mb-8 border-b pb-6" style={{ borderColor: "#1e2d40" }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono uppercase tracking-widest" style={{ color: "#00d4aa" }}>
            research.engine
          </span>
          <span className="text-xs font-mono" style={{ color: "#1e2d40" }}>/</span>
          <span className="text-xs font-mono" style={{ color: "#64748b" }}>results</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold" style={{ color: "#e2e8f0" }}>
            Research Output
          </h1>
          <button
            onClick={() => navigate("/")}
            className="text-xs font-mono px-3 py-1.5 rounded border transition-colors"
            style={{ borderColor: "#1e2d40", color: "#64748b" }}
          >
            ← New Query
          </button>
        </div>
        <div
          className="mt-4 flex items-center gap-3 px-4 py-3 rounded-lg border"
          style={{ backgroundColor: "#0d1424", borderColor: "#1e2d40" }}
        >
          <span
            className="text-xs font-mono uppercase tracking-widest flex-shrink-0"
            style={{ color: "#00d4aa" }}
          >
            query
          </span>
          <div style={{ width: "1px", height: "14px", backgroundColor: "#1e2d40" }} />
          <span className="text-sm font-mono" style={{ color: "#e2e8f0" }}>
            {state?.query}
          </span>
          <div className="ml-auto flex-shrink-0">
            <span
              className="text-xs px-2 py-0.5 rounded uppercase tracking-wider font-mono"
              style={{
                backgroundColor: "rgba(0,212,170,0.06)",
                color: "#00d4aa",
                border: "1px solid rgba(0,212,170,0.15)",
                fontSize: "11px",
              }}
            >
              {state?.mode === "pdf" ? "PDF Mode" : "Web Mode"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">

        {/* Left — Progress Timeline */}
        <div className="col-span-1">
          <div className="rounded-lg border p-4" style={{ backgroundColor: "#0d1424", borderColor: "#1e2d40" }}>
            <label className="block text-xs font-mono uppercase tracking-wider mb-4" style={{ color: "#64748b" }}>
              Execution Log
            </label>
            <div className="space-y-4">
              {STEPS.map((step, index) => {
                const isComplete = currentStep > index;
                const isActive = currentStep === index;
                const isPending = currentStep < index;

                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0.3 }}
                    animate={{ opacity: isPending ? 0.3 : 1 }}
                    className="flex gap-3"
                  >
                    <div className="flex flex-col items-center">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-mono flex-shrink-0"
                        style={{
                          backgroundColor: isComplete ? "#00d4aa" : isActive ? "#0a1628" : "#1e2d40",
                          border: isActive ? "1px solid #00d4aa" : "none",
                          color: isComplete ? "#0a0f1e" : isActive ? "#00d4aa" : "#64748b",
                        }}
                      >
                        {isComplete ? "✓" : index + 1}
                      </div>
                      {index < STEPS.length - 1 && (
                        <div
                          className="w-px h-6 mt-1"
                          style={{ backgroundColor: isComplete ? "#00d4aa" : "#1e2d40" }}
                        />
                      )}
                    </div>

                    <div className="pb-4">
                      <div
                        className="text-xs font-mono font-medium"
                        style={{ color: isComplete || isActive ? "#e2e8f0" : "#64748b" }}
                      >
                        {step.label}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "#64748b" }}>
                        {step.detail}
                      </div>
                      {isActive && !done && !isStreaming && (
                        <motion.div
                          animate={{ opacity: [1, 0.3, 1] }}
                          transition={{ repeat: Infinity, duration: 1 }}
                          className="text-xs font-mono mt-1"
                          style={{ color: "#00d4aa" }}
                        >
                          running...
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Parameters */}
          <div
            className="rounded-lg border p-4 mt-4"
            style={{ backgroundColor: "#0d1424", borderColor: "#1e2d40" }}
          >
            <label className="block text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#64748b" }}>
              Parameters
            </label>
            <div className="space-y-2">
              {[
                { label: "mode", value: state?.mode },
                { label: "source", value: state?.url || state?.filePath || "auto" },
              ].map((item) => (
                <div key={item.label} className="flex justify-between">
                  <span className="text-xs font-mono" style={{ color: "#64748b" }}>{item.label}</span>
                  <span className="text-xs font-mono truncate max-w-32" style={{ color: "#e2e8f0" }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — Output Panel + Chat Panel */}
        <div className="col-span-2 flex flex-col gap-4">

          {/* Output Panel */}
          <div className="rounded-lg border min-h-96" style={{ backgroundColor: "#0d1424", borderColor: "#1e2d40" }}>

            {/* Panel Header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: "#1e2d40" }}
            >
              <label className="text-xs font-mono uppercase tracking-wider" style={{ color: "#64748b" }}>
                Output
              </label>

              {done && !error && (
                <div className="flex items-center gap-3">
                  {/* View switcher */}
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-mono mr-1" style={{ color: "#64748b" }}>
                      View as
                    </span>
                    {["rendered", "md", "json"].map((view) => (
                      <button
                        key={view}
                        onClick={() => handleViewChange(view)}
                        className="text-xs font-mono px-2.5 py-1 rounded border transition-colors"
                        style={{
                          borderColor:
                            (view === "rendered" ? selectedView === null : selectedView === view)
                              ? "#00d4aa"
                              : "#1e2d40",
                          color:
                            (view === "rendered" ? selectedView === null : selectedView === view)
                              ? "#00d4aa"
                              : "#64748b",
                          backgroundColor:
                            (view === "rendered" ? selectedView === null : selectedView === view)
                              ? "rgba(0,212,170,0.05)"
                              : "transparent",
                        }}
                      >
                        {view.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  {/* Divider */}
                  <div className="w-px h-4" style={{ backgroundColor: "#1e2d40" }} />

                  {/* Export button */}
                  <button
                    onClick={handleExport}
                    disabled={!selectedView || exporting}
                    className="text-xs font-mono px-3 py-1 rounded border transition-colors"
                    style={{
                      borderColor: selectedView && !exporting ? "#00d4aa" : "#1e2d40",
                      color: selectedView && !exporting ? "#00d4aa" : "#64748b",
                      cursor: !selectedView || exporting ? "not-allowed" : "pointer",
                    }}
                  >
                    {exporting ? "exporting..." : "↓ Export"}
                  </button>

                  {/* PDF button */}
                  <button
                    onClick={handleOpenPDF}
                    className="text-xs font-mono px-3 py-1 rounded transition-colors"
                    style={{ backgroundColor: "#00d4aa", color: "#0a0f1e" }}
                  >
                    ↗ PDF
                  </button>

                  {/* Divider */}
                  <div className="w-px h-4" style={{ backgroundColor: "#1e2d40" }} />

                  {/* Ask Minerva Report toggle */}
                  <button
                    onClick={() => setChatOpen((prev) => !prev)}
                    className="text-xs font-mono px-3 py-1 rounded border transition-all"
                    style={{
                      borderColor: chatOpen ? "#00d4aa" : "#1e2d40",
                      color: chatOpen ? "#00d4aa" : "#64748b",
                      backgroundColor: chatOpen ? "rgba(0,212,170,0.06)" : "transparent",
                    }}
                  >
                    {chatOpen ? "✕ Close Chat" : "⌥ Ask Minerva"}
                  </button>
                </div>
              )}
            </div>

            {/* Export Error */}
            {exportError && (
              <div
                className="mx-4 mt-3 text-xs font-mono px-3 py-2 rounded border"
                style={{ color: "#ef4444", borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.05)" }}
              >
                ❌ {exportError}
              </div>
            )}

            {/* Content */}
            <div className="p-4 overflow-auto max-h-screen">
              {renderOutput()}
            </div>
          </div>

          {/* Chat Panel — slides in below the output panel */}
          <AnimatePresence>
            {chatOpen && (
              <motion.div
                key="chat-panel"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.6, ease: "easeIn" }}
                className="rounded-lg border flex flex-col"
                style={{
                  backgroundColor: "#0d1424",
                  borderColor: "#1e2d40",
                  height: "480px",
                }}
              >
                {/* Chat Header */}
                <div
                  className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
                  style={{ borderColor: "#1e2d40" }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono uppercase tracking-wider" style={{ color: "#64748b" }}>
                      Ask Minerva
                    </span>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#00d4aa" }} />
                    <span className="text-xs font-mono" style={{ color: "#64748b" }}>
                      context-aware Q&A
                    </span>
                  </div>
                  {chatHistory.length > 0 && (
                    <button
                      onClick={() => { setChatHistory([]); setChatError(null); }}
                      className="text-xs font-mono transition-colors"
                      style={{ color: "#64748b" }}
                    >
                      clear
                    </button>
                  )}
                </div>

                {/* Message History */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                  {chatHistory.length === 0 && !chatLoading && (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="text-xs font-mono mb-1" style={{ color: "#64748b" }}>
                          Ask anything about the report
                        </div>
                        <div className="text-xs font-mono" style={{ color: "#1e2d40" }}>
                          Answers are grounded in the report content only
                        </div>
                      </div>
                    </div>
                  )}

                  {chatHistory.map((turn, i) => (
                    <div
                      key={i}
                      className={`flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className="max-w-xl text-xs font-mono rounded-lg px-3 py-2 leading-relaxed"
                        style={
                          turn.role === "user"
                            ? {
                                backgroundColor: "rgba(0,212,170,0.07)",
                                border: "1px solid rgba(0,212,170,0.2)",
                                color: "#e2e8f0",
                              }
                            : {
                                backgroundColor: "#0a0f1e",
                                border: "1px solid #1e2d40",
                                color: "#e2e8f0",
                              }
                        }
                      >
                        {turn.role === "user" ? (
                          turn.content
                        ) : (
                          <div className="prose prose-invert prose-xs max-w-none" style={{ color: "#e2e8f0" }}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.content}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Typing indicator */}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div
                        className="text-xs font-mono rounded-lg px-3 py-2"
                        style={{ backgroundColor: "#0a0f1e", border: "1px solid #1e2d40", color: "#64748b" }}
                      >
                        <motion.span
                          animate={{ opacity: [1, 0.3, 1] }}
                          transition={{ repeat: Infinity, duration: 0.9 }}
                        >
                          minerva is thinking...
                        </motion.span>
                      </div>
                    </div>
                  )}

                  {chatError && (
                    <div
                      className="text-xs font-mono px-3 py-2 rounded border"
                      style={{ color: "#ef4444", borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.05)" }}
                    >
                      ❌ {chatError}
                    </div>
                  )}

                  <div ref={chatBottomRef} />
                </div>

                {/* Input Bar */}
                <div
                  className="flex items-end gap-2 px-4 py-3 border-t flex-shrink-0"
                  style={{ borderColor: "#1e2d40" }}
                >
                  <textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={handleChatKeyDown}
                    placeholder="Ask a question about the report... (Enter to send)"
                    rows={2}
                    className="flex-1 resize-none rounded-lg px-3 py-2 text-xs font-mono outline-none transition-colors"
                    style={{
                      backgroundColor: "#0a0f1e",
                      border: "1px solid #1e2d40",
                      color: "#e2e8f0",
                      lineHeight: "1.5",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#00d4aa")}
                    onBlur={(e) => (e.target.style.borderColor = "#1e2d40")}
                  />
                  <button
                    onClick={handleChatSend}
                    disabled={!chatInput.trim() || chatLoading}
                    className="flex-shrink-0 text-xs font-mono px-4 py-2 rounded-lg border transition-all"
                    style={{
                      borderColor: chatInput.trim() && !chatLoading ? "#00d4aa" : "#1e2d40",
                      color: chatInput.trim() && !chatLoading ? "#00d4aa" : "#64748b",
                      backgroundColor:
                        chatInput.trim() && !chatLoading ? "rgba(0,212,170,0.06)" : "transparent",
                      cursor: !chatInput.trim() || chatLoading ? "not-allowed" : "pointer",
                      boxShadow:
                        chatInput.trim() && !chatLoading ? "0 0 12px rgba(0,212,170,0.15)" : "none",
                    }}
                  >
                    {chatLoading ? "..." : "Send →"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </div>
  );
}