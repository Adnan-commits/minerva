export default function Capabilities() {
  const coreTools = [
    {
      icon: "🔍",
      title: "Web Search",
      desc: "Query the web intelligently. Returns ranked, relevant results filtered for LLM consumption.",
      tags: [{ label: "Tavily API", teal: true }, { label: "MCP Tool", teal: false }],
    },
    {
      icon: "🌐",
      title: "Web Scraping",
      desc: "Extract content from any URL using static and dynamic rendering with automatic fallback.",
      tags: [{ label: "Playwright", teal: true }, { label: "HTTPX", teal: false }],
    },
    {
      icon: "📄",
      title: "PDF Extraction",
      desc: "Extract full text and metadata from PDF documents. Supports summary and full content modes.",
      tags: [{ label: "PyMuPDF", teal: true }, { label: "MCP Tool", teal: false }],
    },
    {
      icon: "🧠",
      title: "AI Synthesis",
      desc: "LLM-powered synthesis of collected data into structured, section-based research reports.",
      tags: [{ label: "Groq", teal: true }, { label: "LLaMA 3.3 70B", teal: false }],
    },
  ];

  const exportFormats = [
    {
      icon: "📝",
      title: "Markdown",
      desc: "Raw markdown with full heading structure. Ready for Notion, Obsidian, or any editor.",
      tags: [{ label: ".md", teal: true }, { label: "plain text", teal: false }],
    },
    {
      icon: "{}",
      title: "JSON",
      desc: "Structured output with query, summary, and sections parsed into machine-readable format.",
      tags: [{ label: ".json", teal: true }, { label: "structured", teal: false }],
    },
    {
      icon: "📑",
      title: "PDF",
      desc: "Formatted PDF report with title, sections, and justified body text. Print and share ready.",
      tags: [{ label: ".pdf", teal: true }, { label: "ReportLab", teal: false }],
    },
  ];

  const pipelineSteps = [
    { num: "01", title: "Input", desc: "Query, URL, or PDF file provided by the operator." },
    { num: "02", title: "Collect", desc: "Web search fetches sources. Scraper extracts page content. PDF reader pulls text." },
    { num: "03", title: "Synthesize", desc: "LLM processes collected context and generates a structured markdown report." },
    { num: "04", title: "Export", desc: "Report delivered as rendered markdown, raw MD, structured JSON, or PDF download." },
  ];

  const systemSpecs = [
    { value: "4", label: "MCP Tools", sub: "web search, scrape, PDF extract, PDF summary" },
    { value: "3", label: "Export Formats", sub: "PDF, Markdown, JSON — all generated server side" },
    { value: "2", label: "Research Modes", sub: "Web research and PDF document analysis" },
    { value: "24h", label: "Session Duration", sub: "JWT authenticated, auto expiry after 24 hours" },
  ];

  return (
    <div className="page-enter min-h-screen" style={{ backgroundColor: '#0a0f1e', fontFamily: "'JetBrains Mono', monospace" }}>

      {/* Grid background */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: `linear-gradient(rgba(0,212,170,0.02) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(0,212,170,0.02) 1px, transparent 1px)`,
        backgroundSize: '40px 40px'
      }} />

      <div style={{ maxWidth: '100%', padding: '72px 48px 60px', position: 'relative', zIndex: 1 }}>

        {/* Page Header */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs uppercase tracking-widest" style={{ color: '#00d4aa' }}>system</span>
            <span style={{ color: '#1e2d40' }}>/</span>
            <span className="text-xs uppercase tracking-widest" style={{ color: '#64748b' }}>capabilities</span>
          </div>
          <h1 className="font-bold mb-3" style={{ fontSize: '32px', color: '#e2e8f0', letterSpacing: '0.03em' }}>
            What <span style={{ color: '#00d4aa' }}>Minerva</span> Can Do
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.9', maxWidth: '580px' }}>
            Minerva is an AI-powered research engine built on Model Context Protocol.<br />
            Every capability is a tool; composable, observable, and export-ready.
          </p>
        </div>

        {/* Section: Core Tools */}
        <Section label="Core Tools">
          <div className="grid grid-cols-4 gap-4">
            {coreTools.map((tool, i) => (
              <CapCard key={i} {...tool} delay={i * 0.05} />
            ))}
          </div>
        </Section>

        {/* Section: Research Pipeline */}
        <Section label="Research Pipeline">
          <Pipeline steps={pipelineSteps} />
        </Section>

        {/* Section: Export Formats */}
        <Section label="Export Formats">
          <div className="grid grid-cols-3 gap-4">
            {exportFormats.map((fmt, i) => (
              <HorizontalCard key={i} {...fmt} delay={i * 0.05} />
            ))}
          </div>
        </Section>

        {/* Section: System Specs */}
        <Section label="System Specs">
          <div className="grid grid-cols-4 gap-4">
            {systemSpecs.map((spec, i) => (
              <StatCard key={i} {...spec} delay={i * 0.05} />
            ))}
          </div>
        </Section>

      </div>
    </div>
  );
}

/* ── Sub-components ── */

function Section({ label, children }) {
  return (
    <div className="mb-12">
      <div className="flex items-center gap-4 mb-5">
        <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#64748b' }}>
          {label}
        </span>
        <div className="flex-1" style={{ height: '1px', backgroundColor: '#1e2d40' }} />
      </div>
      {children}
    </div>
  );
}

function CapCard({ icon, title, desc, tags, delay }) {
  return (
    <div
      className="rounded-xl p-6 transition-all duration-300 cursor-default"
      style={{
        backgroundColor: '#0d1424',
        border: '1px solid #1e2d40',
        animation: `fadeUp 0.5s ease ${delay}s both`,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(0,212,170,0.5)';
        e.currentTarget.style.boxShadow = '0 0 24px rgba(0,212,170,0.08), 0 0 0 1px rgba(0,212,170,0.1)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = '#1e2d40';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-4"
        style={{ backgroundColor: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.15)', fontSize: '18px' }}>
        {icon}
      </div>
      <div className="font-bold mb-2 uppercase tracking-wider" style={{ fontSize: '13px', color: '#e2e8f0', letterSpacing: '0.08em' }}>
        {title}
      </div>
      <div className="mb-4" style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.8' }}>
        {desc}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag, i) => (
          <span key={i} style={{
            fontSize: '10px',
            padding: '3px 10px',
            borderRadius: '3px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            backgroundColor: tag.teal ? 'rgba(0,212,170,0.06)' : 'rgba(100,116,139,0.08)',
            color: tag.teal ? '#00d4aa' : '#64748b',
            border: `1px solid ${tag.teal ? 'rgba(0,212,170,0.15)' : 'rgba(100,116,139,0.15)'}`,
          }}>
            {tag.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function HorizontalCard({ icon, title, desc, tags, delay }) {
  return (
    <div
      className="rounded-xl p-5 flex items-start gap-4 transition-all duration-300 cursor-default"
      style={{
        backgroundColor: '#0d1424',
        border: '1px solid #1e2d40',
        animation: `fadeUp 0.5s ease ${delay}s both`,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(0,212,170,0.5)';
        e.currentTarget.style.boxShadow = '0 0 24px rgba(0,212,170,0.08), 0 0 0 1px rgba(0,212,170,0.1)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = '#1e2d40';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.15)', fontSize: '16px' }}>
        {icon}
      </div>
      <div>
        <div className="font-bold mb-1 uppercase tracking-wider" style={{ fontSize: '13px', color: '#e2e8f0', letterSpacing: '0.08em' }}>
          {title}
        </div>
        <div className="mb-3" style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.8' }}>
          {desc}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag, i) => (
            <span key={i} style={{
              fontSize: '10px',
              padding: '3px 10px',
              borderRadius: '3px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              backgroundColor: tag.teal ? 'rgba(0,212,170,0.06)' : 'rgba(100,116,139,0.08)',
              color: tag.teal ? '#00d4aa' : '#64748b',
              border: `1px solid ${tag.teal ? 'rgba(0,212,170,0.15)' : 'rgba(100,116,139,0.15)'}`,
            }}>
              {tag.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Pipeline({ steps }) {
  return (
    <div
      className="rounded-xl overflow-hidden flex transition-all duration-300"
      style={{ backgroundColor: '#0d1424', border: '1px solid #1e2d40' }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(0,212,170,0.5)';
        e.currentTarget.style.boxShadow = '0 0 24px rgba(0,212,170,0.08)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = '#1e2d40';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {steps.map((step, i) => (
        <div key={i} className="flex-1 p-6"
          style={{ borderRight: i < steps.length - 1 ? '1px solid #1e2d40' : 'none' }}>
          <div className="mb-2" style={{ fontSize: '11px', color: '#00d4aa', letterSpacing: '0.1em' }}>
            {step.num}
          </div>
          <div className="font-bold mb-2 uppercase tracking-wider" style={{ fontSize: '13px', color: '#e2e8f0', letterSpacing: '0.08em' }}>
            {step.title}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.8' }}>
            {step.desc}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCard({ value, label, sub, delay }) {
  return (
    <div
      className="rounded-xl p-6 flex items-center gap-4 transition-all duration-300 cursor-default"
      style={{
        backgroundColor: '#0d1424',
        border: '1px solid #1e2d40',
        animation: `fadeUp 0.5s ease ${delay}s both`,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(0,212,170,0.5)';
        e.currentTarget.style.boxShadow = '0 0 24px rgba(0,212,170,0.08), 0 0 0 1px rgba(0,212,170,0.1)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = '#1e2d40';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div className="font-bold flex-shrink-0" style={{ fontSize: '36px', color: '#00d4aa', lineHeight: 1 }}>
        {value}
      </div>
      <div>
        <div className="font-bold mb-1 uppercase tracking-wider" style={{ fontSize: '12px', color: '#e2e8f0', letterSpacing: '0.08em' }}>
          {label}
        </div>
        <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.6' }}>
          {sub}
        </div>
      </div>
    </div>
  );
}