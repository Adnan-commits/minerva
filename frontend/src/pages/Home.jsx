import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { checkHealth } from "../services/api";

export default function Home() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("web");
  const [url, setUrl] = useState("");
  const [filePath, setFilePath] = useState("");
  const navigate = useNavigate();
  const [systemStatus, setSystemStatus] = useState({
  "MCP Server": "checking",
  "Web Scraper": "checking",
  "PDF Engine": "checking",
  "AI Model": "checking",
});

  useEffect(() => {
  const checkSystemHealth = async () => {
    try {
      await checkHealth();
      setSystemStatus({
        "MCP Server": "online",
        "Web Scraper": "online",
        "PDF Engine": "online",
        "AI Model": "online",
      });
    } catch {
      setSystemStatus({
        "MCP Server": "offline",
        "Web Scraper": "offline",
        "PDF Engine": "offline",
        "AI Model": "offline",
      });
    }
  };

  checkSystemHealth();
}, []);

  const handleGenerate = () => {
    const finalQuery =
      query.trim() ||
      (url.trim() ? "Summarize and structure the content from this page" : "");

    if (!finalQuery) return;
    if (mode === "pdf" && !filePath.trim()) return;

    navigate("/results", {
      state: { query: finalQuery, mode, url, filePath },
    });
  };

  const isDisabled =
    (mode === "web" && !query.trim() && !url.trim()) ||
    (mode === "pdf" && !filePath.trim());

  return (
    <div className="page-enter max-w-7xl mx-auto px-8 py-10">

      {/* Page Header */}
      <div className="mb-8 border-b pb-6" style={{ borderColor: '#1e2d40' }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono uppercase tracking-widest" style={{ color: '#00d4aa' }}>
            research.engine
          </span>
          <span className="text-xs font-mono" style={{ color: '#1e2d40' }}>/</span>
          <span className="text-xs font-mono" style={{ color: '#64748b' }}>new_query</span>
        </div>
        <h1 className="text-xl font-semibold" style={{ color: '#e2e8f0' }}>
          Research Query
        </h1>
        <p className="text-sm mt-1" style={{ color: '#64748b' }}>
          Configure your research parameters and execute.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">

        {/* Left — Main Input Panel */}
        <div className="col-span-2 space-y-4">

          {/* Query Input */}
          <div className="rounded-lg border p-4" style={{ backgroundColor: '#0d1424', borderColor: '#1e2d40' }}>
            <label className="block text-xs font-mono uppercase tracking-wider mb-2" style={{ color: '#64748b' }}>
              Query
            </label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter research query — topic, domain, keywords, or question..."
              rows={4}
              className="w-full bg-transparent text-sm resize-none focus:outline-none font-mono"
              style={{ color: '#e2e8f0', caretColor: '#00d4aa' }}
            />
          </div>

          {/* Conditional Inputs */}
          {mode === "web" && (
            <div className="rounded-lg border p-4" style={{ backgroundColor: '#0d1424', borderColor: '#1e2d40' }}>
              <label className="block text-xs font-mono uppercase tracking-wider mb-2" style={{ color: '#64748b' }}>
                Target URL <span style={{ color: '#1e2d40' }}>— optional</span>
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full bg-transparent text-sm focus:outline-none font-mono"
                style={{ color: '#e2e8f0', caretColor: '#00d4aa' }}
              />
            </div>
          )}

          {mode === "pdf" && (
            <div className="rounded-lg border p-4" style={{ backgroundColor: '#0d1424', borderColor: '#1e2d40' }}>
              <label className="block text-xs font-mono uppercase tracking-wider mb-2" style={{ color: '#64748b' }}>
                PDF File Path
              </label>
              <input
                type="text"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="C:/Users/Adnan/Desktop/document.pdf"
                className="w-full bg-transparent text-sm focus:outline-none font-mono"
                style={{ color: '#e2e8f0', caretColor: '#00d4aa' }}
              />
            </div>
          )}

          {/* Execute Button */}
          <button
            onClick={handleGenerate}
            disabled={isDisabled}
            className="w-full py-2.5 rounded-lg text-sm font-semibold font-mono uppercase tracking-wider transition-colors"
            style={{
                backgroundColor: isDisabled ? 'transparent' : '#00d4aa',
                color: isDisabled ? '#1e2d40' : '#0a0f1e',
                border: isDisabled ? '1px dashed #1e2d40' : '1px solid #00d4aa',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                boxShadow: isDisabled ? 'none' : '0 0 16px rgba(0,212,170,0.2)',
              }}
          >
            {isDisabled ? "— awaiting input —" : "▶ Execute Research"}
          </button>
        </div>

        {/* Right — Config Panel */}
        <div className="space-y-4">

          {/* Source Mode */}
          <div className="rounded-lg border p-4" style={{ backgroundColor: '#0d1424', borderColor: '#1e2d40' }}>
            <label className="block text-xs font-mono uppercase tracking-wider mb-3" style={{ color: '#64748b' }}>
              Source Mode
            </label>
            <div className="space-y-2">
              {[
                { value: "web", label: "Web Search", desc: "Search + scrape" },
                { value: "pdf", label: "PDF Document", desc: "Extract + analyze" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setMode(option.value)}
                  className="w-full text-left px-3 py-2.5 rounded border transition-colors"
                  style={{
                    backgroundColor: mode === option.value ? '#0a1628' : 'transparent',
                    borderColor: mode === option.value ? '#00d4aa' : '#1e2d40',
                  }}
                >
                  <div className="text-xs font-mono font-medium"
                    style={{ color: mode === option.value ? '#00d4aa' : '#e2e8f0' }}>
                    {option.label}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>
                    {option.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* System Status */}
          <div className="rounded-lg border p-4" style={{ backgroundColor: '#0d1424', borderColor: '#1e2d40' }}>
            <label className="block text-xs font-mono uppercase tracking-wider mb-3" style={{ color: '#64748b' }}>
              System Status
            </label>
            <div className="space-y-2">
              {Object.entries(systemStatus).map(([label, status]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs font-mono" style={{ color: '#64748b' }}>{label}</span>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        backgroundColor:
                          status === "online" ? "#00d4aa" :
                          status === "offline" ? "#ef4444" :
                          "#f59e0b",
                      }}
                    />
                    <span
                      className="text-xs font-mono"
                      style={{
                        color:
                          status === "online" ? "#00d4aa" :
                          status === "offline" ? "#ef4444" :
                          "#f59e0b",
                      }}
                    >
                      {status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
