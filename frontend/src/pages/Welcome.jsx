import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getHistory, getStats } from "../services/api";

export default function Welcome() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState(null);
  const [time, setTime] = useState("");
  const username = localStorage.getItem("minerva_user") || "operator";

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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [histRes, statsRes] = await Promise.all([
        getHistory({ limit: 8 }),
        getStats(),
      ]);
      const jobData = Array.isArray(histRes.data) ? histRes.data : histRes.data.jobs ?? [];
      setJobs(jobData);
      setStats(statsRes.data);
    } catch (err) {
      console.error("Failed to fetch welcome data", err);
    }
  };

  const formatTime = (ts) => {
    const date = new Date(ts + "Z");
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const formatWords = (n) => {
    if (!n) return "0";
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return n.toString();
  };

  return (
    <div className="page-enter min-h-screen" style={{ backgroundColor: '#0a0f1e', fontFamily: "'JetBrains Mono', monospace" }}>
      <div style={{ maxWidth: '100%', padding: '72px 48px 40px' }}>

        {/* Operator bar */}
        <div className="flex items-center gap-2 mb-6 text-xs"
          style={{ color: '#64748b' }}>
          <span>Logged in as</span>
          <span style={{ color: '#00d4aa' }}>{username}</span>
          <span style={{ color: '#1e2d40' }}>|</span>
          <span>{time}</span>
        </div>

        {/* Hero */}
        <div className="flex items-start justify-between mb-7 pb-6 border-b"
          style={{ borderColor: '#1e2d40', animation: 'fadeUp 0.5s ease 0.05s both' }}>
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-xs uppercase tracking-widest" style={{ color: '#00d4aa' }}>system</span>
              <span style={{ color: '#1e2d40' }}>/</span>
              <span className="text-xs uppercase tracking-widest" style={{ color: '#64748b' }}>welcome</span>
            </div>
            <h1 className="text-3xl font-bold mb-3" style={{ color: '#e2e8f0', letterSpacing: '0.03em' }}>
              Welcome to <span style={{ color: '#00d4aa' }}>Minerva</span>
            </h1>
            <p className="text-xs mb-1" style={{ color: '#e2e8f0', lineHeight: '1.8', maxWidth: '520px' }}>
              An MCP-powered research engine that searches the web, scrapes pages and extracts PDFs.
            </p>
            <p className="text-xs" style={{ color: '#64748b', lineHeight: '1.8', maxWidth: '520px' }}>
              Synthesizes collected data into structured reports — exportable as PDF, Markdown, or JSON.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2.5 flex-shrink-0 ml-6">
            <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded border"
              style={{
                color: '#00d4aa',
                borderColor: 'rgba(0,212,170,0.2)',
                backgroundColor: 'rgba(0,212,170,0.05)'
              }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#00d4aa' }} />
              All systems operational
            </div>
            <button
              onClick={() => navigate("/")}
              className="px-5 py-2.5 rounded text-xs font-bold uppercase tracking-widest transition-all"
              style={{ backgroundColor: '#00d4aa', color: '#0a0f1e' }}
              onMouseEnter={e => e.target.style.backgroundColor = '#00b894'}
              onMouseLeave={e => e.target.style.backgroundColor = '#00d4aa'}
            >
              ▶ &nbsp;Start Research
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6"
          style={{ animation: 'fadeUp 0.5s ease 0.1s both' }}>
          {[
            { label: "Total Jobs", value: stats?.total ?? "—", sub: "since deployment" },
            { label: "Success Rate", value: stats ? `${stats.success_rate}%` : "—", sub: "above threshold" },
            { label: "Avg Duration", value: stats ? `${stats.avg_duration}s` : "—", sub: "per research job" },
            { label: "Words Processed", value: stats ? formatWords(stats.total_words) : "—", sub: "content extracted" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border p-4"
              style={{ backgroundColor: '#0d1424', borderColor: '#1e2d40' }}>
              <div className="text-xs uppercase tracking-widest mb-2" style={{ color: '#64748b', fontSize: '11px' }}>
                {s.label}
              </div>
              <div className="font-bold mb-1" style={{ fontSize: '26px', color: '#e2e8f0' }}>
                {s.value}
              </div>
              <div style={{ fontSize: '11px', color: '#00d4aa' }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Recent Activity */}
        <div style={{ animation: 'fadeUp 0.5s ease 0.15s both' }}>
          <div className="text-xs uppercase tracking-widest mb-3" style={{ color: '#64748b', fontSize: '11px' }}>
            Recent Activity
          </div>
          <div className="rounded-lg border overflow-hidden"
            style={{ backgroundColor: '#0d1424', borderColor: '#1e2d40' }}>

            {/* Table header */}
            <div className="grid gap-3 px-4 py-2 border-b"
              style={{
                gridTemplateColumns: '100px 1fr 80px 80px 120px',
                borderColor: '#1e2d40',
                fontSize: '9px',
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.1em'
              }}>
              <span>Type</span>
              <span>Input</span>
              <span>Status</span>
              <span>Duration</span>
              <span>Time</span>
            </div>

            {/* Rows */}
            {jobs.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs" style={{ color: '#64748b' }}>
                No jobs yet — run your first research query
              </div>
            ) : (
              jobs.map((job) => (
                <div key={job.id}
                  className="grid gap-3 px-4 py-3 border-b items-center transition-colors"
                  style={{
                    gridTemplateColumns: '100px 1fr 80px 80px 120px',
                    borderColor: '#1e2d40',
                    cursor: 'default'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <span className="text-xs uppercase tracking-wider" style={{ color: '#00d4aa' }}>
                    {job.job_type}
                  </span>
                  <span className="text-xs truncate" style={{ color: '#e2e8f0', maxWidth: '260px' }}>
                    {job.input || "—"}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded inline-block"
                    style={{
                      backgroundColor: job.status === 'success' ? 'rgba(0,212,170,0.1)' : 'rgba(239,68,68,0.1)',
                      color: job.status === 'success' ? '#00d4aa' : '#ef4444',
                    }}>
                    {job.status}
                  </span>
                  <span className="text-xs" style={{ color: '#64748b' }}>
                    {job.duration_seconds ? `${job.duration_seconds}s` : "—"}
                  </span>
                  <span className="text-xs" style={{ color: '#64748b' }}>
                    {formatTime(job.created_at)}
                  </span>
                </div>
              ))
            )}

            {/* View all */}
            <div
              className="text-center py-2.5 text-xs cursor-pointer transition-colors border-t"
              style={{ color: '#64748b', borderColor: '#1e2d40' }}
              onClick={() => navigate("/dashboard")}
              onMouseEnter={e => e.currentTarget.style.color = '#00d4aa'}
              onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
            >
              View all in Dashboard →
            </div>
          </div>
        </div>
            {/* Attribution Footer */}
<div className="mt-12 pt-7 border-t" style={{ borderColor: '#1e2d40' }}>

  {/* Top row */}
  <div className="flex items-center justify-between mb-5">
    <div className="flex items-center gap-5">
      <span className="text-xs uppercase tracking-widest" style={{ color: '#64748b' }}>Built at</span>
      <a href="https://aiolos.cloud/index" target="_blank" rel="noreferrer"
        className="flex items-center gap-2 font-semibold transition-opacity hover:opacity-70"
        style={{ color: '#00d4aa', fontSize: '11px', letterSpacing: '0.08em', textDecoration: 'none' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
        </svg>
        Aiolos Cloud Solutions
      </a>
      <div style={{ width: '1px', height: '16px', backgroundColor: '#1e2d40' }} />
      <span className="text-xs uppercase tracking-widest" style={{ color: '#64748b' }}>
        Developed by NextGen Thinkers
      </span>
    </div>
    <span className="text-xs px-2 py-0.5 rounded uppercase tracking-widest"
      style={{ backgroundColor: 'rgba(0,212,170,0.06)', color: '#00d4aa', border: '1px solid rgba(0,212,170,0.15)', fontSize: '9px' }}>
      v1.0.0
    </span>
  </div>

  {/* Divider */}
  <div className="mb-5" style={{ height: '1px', backgroundColor: '#1e2d40', opacity: 0.5 }} />

  {/* Devs row */}
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2 flex-wrap">
      {[
        { name: 'Adnan Bardgujar', initials: 'AB', url: 'https://www.linkedin.com/in/adnan-bardgujar-b43b7a25b/' },
        { name: 'Saif Madre', initials: 'SM', url: 'https://www.linkedin.com/in/saif-madre-7986872ba/' },
        { name: 'Mohd Salique Khan', initials: 'MK', url: 'https://www.linkedin.com/in/mohdsaliquekhan78622/' },
        { name: 'Fazal Shaikh', initials: 'FS', url: 'https://www.linkedin.com/in/fazal-shaikh-555404195/' },
      ].map((dev) => (
        <a key={dev.name} href={dev.url} target="_blank" rel="noreferrer"
          className="flex items-center gap-2 rounded transition-all"
          style={{
            padding: '5px 12px',
            border: '1px solid #1e2d40',
            backgroundColor: '#0d1424',
            textDecoration: 'none',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'rgba(0,212,170,0.4)';
            e.currentTarget.style.boxShadow = '0 0 12px rgba(0,212,170,0.06)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = '#1e2d40';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div className="w-5 h-5 rounded-full flex items-center justify-center font-bold flex-shrink-0"
            style={{ backgroundColor: 'rgba(0,212,170,0.15)', color: '#00d4aa', fontSize: '9px' }}>
            {dev.initials}
          </div>
          <span style={{ fontSize: '10px', color: '#e2e8f0', letterSpacing: '0.03em' }}>{dev.name}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#00d4aa" style={{ opacity: 0.4 }}>
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
        </a>
      ))}
    </div>
    <span style={{ fontSize: '9px', color: '#64748b', opacity: 0.6 }}>
      © 2025 Aiolos Cloud Solutions. All rights reserved.
    </span>
  </div>

</div>
      </div>
    </div>
  );
}
