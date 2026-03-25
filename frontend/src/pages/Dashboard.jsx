import { useState, useEffect } from "react";
import { getHistory, getStats } from "../services/api";
import {
  PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  LineChart, Line
} from "recharts";

const TEAL = "#00d4aa";
const COLORS = ["#00d4aa", "#0891b2", "#6366f1", "#f59e0b"];

export default function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  useEffect(() => {
    fetchHistory();
    fetchStats();
  }, [statusFilter, typeFilter]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.job_type = typeFilter;
      const res = await getHistory(params);
      setJobs(res.data.jobs);
    } catch (err) {
      console.error("Failed to fetch history", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const statsRes = await getStats();
      setStats(statsRes.data);
    } catch (err) {
      console.error("Failed to fetch stats", err);
    }
  };

  // --- Chart data ---
  const jobTypeData = [
    { name: "scrape", value: jobs.filter((j) => j.job_type === "scrape").length },
    { name: "pdf", value: jobs.filter((j) => j.job_type === "pdf").length },
    { name: "pdf_summary", value: jobs.filter((j) => j.job_type === "pdf_summary").length },
    { name: "research/web", value: jobs.filter((j) => j.job_type === "research" && j.strategy_used === "web").length },
    { name: "research/pdf", value: jobs.filter((j) => j.job_type === "research" && j.strategy_used === "pdf").length },
  ].filter((d) => d.value > 0); 

  const statusData = [
    { name: "Success", value: jobs.filter((j) => j.status === "success").length },
    { name: "Failed", value: jobs.filter((j) => j.status === "failed").length },
  ].filter((d) => d.value > 0);

  const durationData = jobs
    .slice(0, 20)
    .reverse()
    .map((j, i) => ({
      index: i + 1,
      duration: j.duration_seconds || 0,
    }));

  return (
    <div className="page-enter max-w-7xl mx-auto px-6 py-10">

      {/* Page Header */}
      <div className="mb-8 border-b pb-6" style={{ borderColor: '#1e2d40' }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono uppercase tracking-widest" style={{ color: '#00d4aa' }}>
            system
          </span>
          <span className="text-xs font-mono" style={{ color: '#1e2d40' }}>/</span>
          <span className="text-xs font-mono" style={{ color: '#64748b' }}>dashboard</span>
        </div>
        <h1 className="text-xl font-semibold" style={{ color: '#e2e8f0' }}>
          System Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: '#64748b' }}>
          Job history, metrics, and system performance.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Jobs", value: stats?.total },
          { label: "Success Rate", value: stats?.success_rate ? `${stats.success_rate}%` : "—" },
          { label: "Avg Duration", value: stats?.avg_duration ? `${stats.avg_duration}s` : "—" },
          { label: "Words Processed", value: stats?.total_words?.toLocaleString() || "—" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border p-4"
            style={{ backgroundColor: '#0d1424', borderColor: '#1e2d40' }}>
            <div className="text-xs font-mono uppercase tracking-wider mb-2"
              style={{ color: '#64748b' }}>
              {stat.label}
            </div>
            <div className="text-2xl font-semibold font-mono"
              style={{ color: '#e2e8f0' }}>
              {loading ? "—" : stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Charts — Row 1: Pie + Bar */}
      <div className="grid grid-cols-2 gap-4 mb-4">

        {/* Job Type Distribution */}
        <div className="rounded-lg border p-5" style={{ backgroundColor: '#0d1424', borderColor: '#1e2d40' }}>
          <div className="flex items-center justify-between mb-5">
            <span className="text-xs font-mono uppercase tracking-widest" style={{ color: '#64748b' }}>
              Job Type Distribution
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ backgroundColor: '#1e2d40', color: '#00d4aa' }}>
              {jobTypeData.reduce((a, b) => a + b.value, 0)} total
            </span>
          </div>
          {jobTypeData.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={200} height={220}>
                <PieChart>
                  <Pie data={jobTypeData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                    dataKey="value" paddingAngle={3}>
                    {jobTypeData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0d1424', border: '1px solid #1e2d40', borderRadius: '6px', fontFamily: 'monospace', fontSize: '11px' }}
                    itemStyle={{ color: '#00d4aa' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2.5 flex-1">
                {jobTypeData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-xs font-mono uppercase" style={{ color: '#64748b' }}>{d.name}</span>
                    </div>
                    <span className="text-xs font-mono font-bold" style={{ color: '#e2e8f0' }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-xs font-mono" style={{ color: '#64748b' }}>no data</div>
          )}
        </div>

        {/* Success vs Failed */}
        <div className="rounded-lg border p-5" style={{ backgroundColor: '#0d1424', borderColor: '#1e2d40' }}>
          <div className="flex items-center justify-between mb-5">
            <span className="text-xs font-mono uppercase tracking-widest" style={{ color: '#64748b' }}>
              Success vs Failed
            </span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs font-mono" style={{ color: '#00d4aa' }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#00d4aa' }} />
                Success
              </span>
              <span className="flex items-center gap-1.5 text-xs font-mono" style={{ color: '#ef4444' }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#ef4444' }} />
                Failed
              </span>
            </div>
          </div>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={statusData} barSize={48} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name"
                  tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'monospace' }}
                  axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'monospace' }}
                  axisLine={false} tickLine={false}
                  gridLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0d1424', border: '1px solid #1e2d40', borderRadius: '6px', fontFamily: 'monospace', fontSize: '11px' }}
                  labelStyle={{ color: '#e2e8f0' }}
                  itemStyle={{ color: '#00d4aa' }}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.name === "Success" ? "#00d4aa" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-56 flex items-center justify-center text-xs font-mono" style={{ color: '#64748b' }}>no data</div>
          )}
        </div>
      </div>

      {/* Charts — Row 2: Duration full width */}
      <div className="rounded-lg border p-5 mb-8" style={{ backgroundColor: '#0d1424', borderColor: '#1e2d40' }}>
        <div className="flex items-center justify-between mb-5">
          <span className="text-xs font-mono uppercase tracking-widest" style={{ color: '#64748b' }}>
            Duration Over Time
          </span>
          <span className="text-xs font-mono px-2 py-0.5 rounded"
            style={{ backgroundColor: '#1e2d40', color: '#64748b' }}>
            last 20 jobs · seconds
          </span>
        </div>
        {durationData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={durationData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
              <XAxis dataKey="index"
                tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'monospace' }}
                axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'monospace' }}
                axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0d1424', border: '1px solid #1e2d40', borderRadius: '6px', fontFamily: 'monospace', fontSize: '11px' }}
                labelStyle={{ color: '#64748b' }}
                itemStyle={{ color: '#00d4aa' }}
                cursor={{ stroke: '#1e2d40' }}
              />
              <Line type="monotone" dataKey="duration" stroke="#00d4aa"
                strokeWidth={2}
                dot={{ fill: '#00d4aa', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, fill: '#00d4aa', boxShadow: '0 0 6px #00d4aa' }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-xs font-mono" style={{ color: '#64748b' }}>no data</div>
        )}
      </div>

      {/* History Table */}
      <div className="rounded-lg border" style={{ backgroundColor: '#0d1424', borderColor: '#1e2d40' }}>

        {/* Table Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: '#1e2d40' }}>
          <label className="text-xs font-mono uppercase tracking-wider"
            style={{ color: '#64748b' }}>
            Job History
          </label>
          {/* Filters */}
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-mono px-2 py-1 rounded border bg-transparent focus:outline-none"
              style={{ borderColor: '#1e2d40', color: '#64748b' }}
            >
              <option value="">All Status</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-xs font-mono px-2 py-1 rounded border bg-transparent focus:outline-none"
              style={{ borderColor: '#1e2d40', color: '#64748b' }}
            >
              <option value="">All Types</option>
              <option value="scrape">Scrape</option>
              <option value="pdf">PDF</option>
              <option value="pdf_summary">PDF Summary</option>
              <option value="research">Research</option>
            </select>
            <button
              onClick={fetchHistory}
              className="text-xs font-mono px-3 py-1 rounded border transition-colors"
              style={{ borderColor: '#1e2d40', color: '#64748b' }}
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr style={{ borderBottom: '1px solid #1e2d40' }}>
                {["Type", "Input", "Status", "Strategy", "Words", "Duration", "Time"].map((col) => (
                  <th key={col} className="text-left px-4 py-2"
                    style={{ color: '#64748b' }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center"
                    style={{ color: '#64748b' }}>
                    loading...
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center"
                    style={{ color: '#64748b' }}>
                    no jobs found
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id}
                    className="border-b transition-colors hover:bg-slate-800/20"
                    style={{ borderColor: '#1e2d40' }}>
                    <td className="px-4 py-3" style={{ color: '#e2e8f0' }}>
                      {job.job_type}
                    </td>
                    <td className="px-4 py-3 max-w-48 truncate" style={{ color: '#64748b' }}
                      title={job.input}>
                      {job.input}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs"
                        style={{
                          backgroundColor: job.status === "success" ? "rgba(0,212,170,0.1)" : "rgba(239,68,68,0.1)",
                          color: job.status === "success" ? "#00d4aa" : "#ef4444",
                        }}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: '#64748b' }}>
                      {job.strategy_used || "—"}
                    </td>
                    <td className="px-4 py-3" style={{ color: '#64748b' }}>
                      {job.word_count?.toLocaleString() || "—"}
                    </td>
                    <td className="px-4 py-3" style={{ color: '#64748b' }}>
                      {job.duration_seconds ? `${job.duration_seconds}s` : "—"}
                    </td>
                    <td className="px-4 py-3" style={{ color: '#64748b' }}>
                      {new Date(job.created_at+ 'Z').toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
