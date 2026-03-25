import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../services/api";

const BOOT_LINES = [
  { label: "Initializing system core",        status: "ok",   delay: 400  },
  { label: "Loading MCP server",              status: "ok",   delay: 800  },
  { label: "Starting PDF extraction engine",  status: "ok",   delay: 1200 },
  { label: "Starting web scraping pipeline",  status: "ok",   delay: 1600 },
  { label: "Connecting to LLM",              status: "ok",   delay: 2100 },
  { label: "Initializing web search",         status: "ok",   delay: 2500 },
  { label: "Starting API gateway",            status: "ok",   delay: 2900 },
  { label: "Connecting to database",          status: "ok",   delay: 3200 },
  { label: "Awaiting operator authentication",status: "warn", delay: 3600 },
];

export default function Login() {
  const navigate = useNavigate();
  const [bootLines, setBootLines] = useState([]);
  const [progress, setProgress] = useState(0);
  const [booting, setBooting] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [accessGranted, setAccessGranted] = useState(false);
  const [time, setTime] = useState("");
  const bootStarted = useRef(false);
  // Clock
  useEffect(() => {
    const tick = () => {
      const t = new Date().toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      setTime(t + " IST");
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Boot sequence
  useEffect(() => {
    if (localStorage.getItem("minerva_token")) {
      navigate("/");
      return;
    }

    if (bootStarted.current) return;
    bootStarted.current = true;

    BOOT_LINES.forEach((line, i) => {
      setTimeout(() => {
        setBootLines((prev) => [...prev, line]);
        setProgress(Math.round(((i + 1) / BOOT_LINES.length) * 100));
        if (i === BOOT_LINES.length - 1) {
          setTimeout(() => setBooting(false), 600);
        }
      }, line.delay);
    });
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError("All fields required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await login(username, password);
      localStorage.setItem("minerva_token", res.data.access_token);
      localStorage.setItem("minerva_user", res.data.username);
      setAccessGranted(true);
      setTimeout(() => navigate("/welcome"), 1000);
    } catch (err) {
      setError("Authentication failed — invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: '#0a0f1e', fontFamily: "'JetBrains Mono', monospace" }}>

      {/* Grid background */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: `linear-gradient(rgba(0,212,170,0.03) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(0,212,170,0.03) 1px, transparent 1px)`,
        backgroundSize: '40px 40px'
      }} />

      {/* Corner decorations */}
      {['tl', 'tr', 'bl', 'br'].map((pos) => (
        <div key={pos} className="fixed w-14 h-14 opacity-40 pointer-events-none" style={{
          top: pos.includes('t') ? 20 : 'auto',
          bottom: pos.includes('b') ? 20 : 'auto',
          left: pos.includes('l') ? 20 : 'auto',
          right: pos.includes('r') ? 20 : 'auto',
          borderTop: pos.includes('t') ? '1px solid #00d4aa' : 'none',
          borderBottom: pos.includes('b') ? '1px solid #00d4aa' : 'none',
          borderLeft: pos.includes('l') ? '1px solid #00d4aa' : 'none',
          borderRight: pos.includes('r') ? '1px solid #00d4aa' : 'none',
        }} />
      ))}

      {/* System bar */}
      <div className="fixed top-0 left-0 right-0 h-7 flex items-center justify-between px-5 border-b z-50"
        style={{ backgroundColor: '#0d1424', borderColor: '#1e2d40', fontSize: '10px', color: '#64748b' }}>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#00d4aa' }} />
            MINERVA_SYS v1.0.0
          </span>
          <span style={{ color: '#1e2d40' }}>|</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#f59e0b' }} />
            AUTH_REQUIRED
          </span>
        </div>
        <span>{time}</span>
      </div>

      {/* Main content */}
      <div className="w-full max-w-md mt-7 relative z-10">

        {/* Boot panel */}
        {booting && (
          <div className="rounded-lg border p-6" style={{ backgroundColor: '#0d1424', borderColor: '#1e2d40' }}>
            <div className="flex items-center justify-between mb-4 pb-3 border-b" style={{ borderColor: '#1e2d40' }}>
              <span className="text-xs uppercase tracking-widest" style={{ color: '#64748b' }}>
                System Initialization
              </span>
              <div className="flex items-center gap-1.5 text-xs" style={{ color: '#00d4aa' }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#00d4aa' }} />
                BOOTING
              </div>
            </div>

            <div className="space-y-1 min-h-40">
              {bootLines.map((line, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs"
                  style={{
                    animation: 'slideInLine 0.3s ease forwards',
                  }}
                >
                  <span className="w-10 font-bold flex-shrink-0" style={{
                    color: line.status === 'ok' ? '#00d4aa' : '#f59e0b'
                  }}>
                    [{line.status === 'ok' ? 'OK' : 'WARN'}]
                  </span>
                  <span style={{ color: '#e2e8f0' }}>{line.label}</span>
                </div>
              ))}
            </div>

            {/* Progress */}
            <div className="mt-4 pt-3 border-t" style={{ borderColor: '#1e2d40' }}>
              <div className="flex justify-between text-xs mb-1.5" style={{ color: '#64748b' }}>
                <span>LOADING MODULES</span>
                <span>{progress}%</span>
              </div>
              <div className="h-0.5 rounded-full overflow-hidden" style={{ backgroundColor: '#1e2d40' }}>
                <div className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${progress}%`,
                    backgroundColor: '#00d4aa',
                    boxShadow: '0 0 8px rgba(0,212,170,0.5)'
                  }} />
              </div>
            </div>
          </div>
        )}

        {/* Login panel */}
        {!booting && (
          <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: '#0d1424', borderColor: '#1e2d40', animation: 'slideUp 0.5s ease forwards' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b"
              style={{ backgroundColor: '#080d18', borderColor: '#1e2d40' }}>
              <div className="flex items-center gap-2.5">
                {/* Owl */}
                <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
                  <rect width="28" height="28" rx="6" fill="#00d4aa"/>
                  <ellipse cx="14" cy="16" rx="7" ry="8" fill="#0a0f1e"/>
                  <ellipse cx="14" cy="10" rx="6" ry="5.5" fill="#0a0f1e"/>
                  <polygon points="9,6 10.5,9 8,9" fill="#0a0f1e"/>
                  <polygon points="19,6 17.5,9 20,9" fill="#0a0f1e"/>
                  <circle cx="11.5" cy="10" r="2.2" fill="#00d4aa"/>
                  <circle cx="11.5" cy="10" r="1.1" fill="#0a0f1e"/>
                  <circle cx="16.5" cy="10" r="2.2" fill="#00d4aa"/>
                  <circle cx="16.5" cy="10" r="1.1" fill="#0a0f1e"/>
                  <polygon points="14,11.5 12.8,13 15.2,13" fill="#00d4aa"/>
                  <ellipse cx="8" cy="16" rx="2.5" ry="4" fill="#0d1424"/>
                  <ellipse cx="20" cy="16" rx="2.5" ry="4" fill="#0d1424"/>
                </svg>
                <span className="text-sm font-semibold uppercase tracking-widest" style={{ color: '#e2e8f0' }}>
                  Minerva
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded font-mono"
                  style={{ backgroundColor: '#1e2d40', color: '#00d4aa' }}>
                  Secure Access
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                {accessGranted ? (
                  <span className="flex items-center gap-1.5" style={{ color: '#00d4aa' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#00d4aa' }} />
                    GRANTED
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5" style={{ color: '#ef4444' }}>
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#ef4444' }} />
                    LOCKED
                  </span>
                )}
              </div>
            </div>

            <div className="p-5">

              {/* System info cards */}
              <div className="grid grid-cols-2 gap-2 mb-5">
                {[
                  { label: "System", value: "MCP Gateway" },
                  { label: "Auth Mode", value: "Operator" },
                  { label: "Status", value: "Online" },
                  { label: "Version", value: "v1.0.0" },
                ].map((item) => (
                  <div key={item.label} className="rounded border p-2"
                    style={{ backgroundColor: '#080d18', borderColor: '#1e2d40' }}>
                    <div className="text-xs uppercase tracking-wider mb-1" style={{ color: '#64748b', fontSize: '9px' }}>
                      {item.label}
                    </div>
                    <div className="text-xs" style={{ color: '#00d4aa' }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Operator ID */}
              <div className="mb-3">
                <label className="block mb-1.5 uppercase tracking-widest"
                  style={{ color: '#64748b', fontSize: '9px' }}>
                  Operator ID
                </label>
                <div className="flex items-center rounded border overflow-hidden"
                  style={{ backgroundColor: '#080d18', borderColor: username ? '#00d4aa' : '#1e2d40' }}>
                  <span className="px-3 h-9 flex items-center border-r text-xs"
                    style={{ color: '#00d4aa', borderColor: '#1e2d40' }}>$</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="enter username"
                    className="flex-1 bg-transparent outline-none px-3 h-9 text-xs font-mono"
                    style={{ color: '#e2e8f0', caretColor: '#00d4aa' }}
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Access Key */}
              <div className="mb-4">
                <label className="block mb-1.5 uppercase tracking-widest"
                  style={{ color: '#64748b', fontSize: '9px' }}>
                  Access Key
                </label>
                <div className="flex items-center rounded border overflow-hidden"
                  style={{ backgroundColor: '#080d18', borderColor: password ? '#00d4aa' : '#1e2d40' }}>
                  <span className="px-3 h-9 flex items-center border-r text-xs"
                    style={{ color: '#00d4aa', borderColor: '#1e2d40' }}>*</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="enter password"
                    className="flex-1 bg-transparent outline-none px-3 h-9 text-xs font-mono"
                    style={{ color: '#e2e8f0', caretColor: '#00d4aa' }}
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="text-xs px-3 py-2 rounded border mb-4 font-mono"
                  style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.05)' }}>
                  ❌ {error}
                </div>
              )}

              {/* Button */}
              <button
                onClick={handleLogin}
                disabled={loading || accessGranted}
                className="w-full h-9 rounded text-xs font-bold uppercase tracking-widest transition-all font-mono"
                style={{
                  backgroundColor: accessGranted ? '#00b894' : loading ? '#1e2d40' : '#00d4aa',
                  color: loading ? '#64748b' : '#0a0f1e',
                  cursor: loading || accessGranted ? 'not-allowed' : 'pointer',
                }}
              >
                {accessGranted ? '✓  Access Granted' : loading ? '⟳  Verifying...' : '▶  Authenticate'}
              </button>
            </div>

            {/* Footer */}
            <div className="flex justify-between px-5 py-2 border-t text-xs"
              style={{ borderColor: '#1e2d40', color: '#64748b', fontSize: '9px' }}>
              <span>MINERVA_AUTH_MODULE</span>
              <span>{time}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}