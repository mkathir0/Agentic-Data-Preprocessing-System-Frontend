"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Download, Table2, ScrollText, BarChart3,
  Rows3, Columns3, Wrench, ShieldCheck, Loader2, AlertCircle,
  ScanSearch, Brain, Code2, CheckCheck
} from "lucide-react";
import { Job, fetchCleanedCsvText, downloadCleanedCsv } from "@/lib/api";
import { ExcelTable } from "@/components/ui/excel-style-table";
import { InteractiveLogsTable, PipelineLog } from "@/components/ui/interactive-logs-table";

type Tab = "data" | "insights" | "logs";

interface ParsedCsv { headers: string[]; rows: string[][]; totalRows: number; }

import { InsightsReport, InsightsData } from "./InsightsReport";

interface LangSmithTrace {
  id: string; agent: string; level: "info" | "warning" | "error";
  message: string; timestamp: string; duration_ms?: number; tags?: string[];
}

// ── CSV Parser ──────────────────────────────────────────────────────────────
function parseCsvText(text: string): ParsedCsv {
  const lines = text.trim().split("\n").filter(Boolean);
  if (!lines.length) return { headers: [], rows: [], totalRows: 0 };
  const parseRow = (line: string) => {
    const res: string[] = []; let cur = ""; let inQ = false;
    for (const ch of line) {
      if (ch === '"') inQ = !inQ;
      else if (ch === "," && !inQ) { res.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    res.push(cur.trim());
    return res;
  };
  const headers = parseRow(lines[0]).map(h => h.replace(/^"|"$/g, ""));
  const all = lines.slice(1).map(parseRow);
  return { headers, rows: all.slice(0, 200).map(r => r.map(c => c.replace(/^"|"$/g, ""))), totalRows: all.length };
}

// ── Markdown-aware line renderer ────────────────────────────────────────────
function RichLine({ text }: { text: string }) {
  // Bold **text**
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
        if (part.startsWith("`") && part.endsWith("`"))
          return <code key={i} className="font-mono text-[10px] bg-white/5 px-1 py-0.5 rounded text-[#00F0FF]/90">{part.slice(1, -1)}</code>;
        // Handle italic *text*
        if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**"))
          return <em key={i} className="text-gray-300 italic">{part.slice(1, -1)}</em>;
        return part;
      })}
    </span>
  );
}



// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="flex-1 min-w-[110px] bg-black border border-white/[0.08] rounded-xl p-4 flex flex-col gap-1.5"
    >
      <div className="text-gray-600">{icon}</div>
      <div className="text-xl font-mono font-bold text-[#00F0FF]">{value}</div>
      <div className="text-xs font-semibold text-gray-400">{label}</div>
      {sub && <div className="text-[10px] font-mono text-gray-600">{sub}</div>}
    </motion.div>
  );
}

// ── Convert LangSmith traces to PipelineLog format ────────────────────────────
function tracesToLogs(traces: LangSmithTrace[]): PipelineLog[] {
  return traces.map((t, i) => ({
    id: t.id || String(i),
    timestamp: t.timestamp,
    level: t.level,
    agent: t.agent,
    message: t.message,
    duration: t.duration_ms ? `${(t.duration_ms / 1000).toFixed(2)}s` : undefined,
    tags: t.tags ?? [],
  }));
}

// ── Main ResultsPanel ─────────────────────────────────────────────────────────
export function ResultsPanel({ job }: { job: Job }) {
  const [activeTab, setActiveTab] = useState<Tab>("data");
  const [csvData, setCsvData] = useState<ParsedCsv | null>(null);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [traces, setTraces] = useState<LangSmithTrace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (job.status !== "COMPLETED") return;
    setLoading(true); setError(null);

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
    const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "default_secret_key";
    const headers = { "X-API-Key": API_KEY };

    Promise.all([
      fetchCleanedCsvText(job.id).catch(() => ""),
      fetch(`${API_BASE}/jobs/${job.id}/insights`, { headers }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API_BASE}/jobs/${job.id}/langsmith-traces`, { headers }).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([csv, insightsData, traceData]) => {
      if (csv) setCsvData(parseCsvText(csv));
      setInsights(insightsData);
      setTraces(traceData || []);
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [job.id, job.status]);

  const logs: PipelineLog[] = traces.length > 0 ? tracesToLogs(traces) : [];

  const handleDownload = async () => {
    setIsDownloading(true);
    try { await downloadCleanedCsv(job.id, job.filename); }
    catch (e) { console.error("Download failed:", e); }
    finally { setIsDownloading(false); }
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "data",     label: "Cleaned Data",   icon: <Table2 className="w-3.5 h-3.5" /> },
    { id: "insights", label: "Insights",        icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: "logs",     label: traces.length > 0 ? `LangSmith Traces (${traces.length})` : "Pipeline Logs", icon: <ScrollText className="w-3.5 h-3.5" /> },
  ];

  // Stats derived from insights
  const rowCount = insights?.profiler_data?.num_rows ?? "—";
  const colCount = csvData ? String(csvData.headers.length) : "—";
  const retries = insights?.retry_count?.toString() ?? "0";
  const validated = insights?.validation_report?.overall_passed ? "✓ Pass" : (insights?.validation_report ? "✗ Fail" : "—");

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="w-full max-w-5xl mt-8"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Pipeline Complete</h3>
            <p className="text-xs font-mono text-gray-500 truncate max-w-xs">{job.filename}</p>
          </div>
        </div>
        <motion.button onClick={handleDownload} disabled={isDownloading}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-60 text-white text-sm font-semibold rounded-full shadow-[0_0_20px_rgba(34,197,94,0.2)] transition-all"
        >
          {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {isDownloading ? "Downloading..." : "Download Cleaned CSV"}
        </motion.button>
      </div>

      {/* Stat cards */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <StatCard icon={<Rows3 className="w-4 h-4" />}    label="Rows in Output"    value={rowCount}    sub="from insights data" />
        <StatCard icon={<Columns3 className="w-4 h-4" />}  label="Columns"           value={colCount}    sub="feature columns" />
        <StatCard icon={<Wrench className="w-4 h-4" />}    label="LLM Retries"       value={retries}     sub="code generation" />
        <StatCard icon={<ShieldCheck className="w-4 h-4" />} label="Validation Engine" value={validated}   sub="7-layer validation" />
      </div>

      {/* Main panel */}
      <div className="bg-[#020202] border border-white/[0.07] rounded-2xl overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-white/[0.07] px-4 pt-3 gap-0.5">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-1.5 px-4 pb-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === tab.id ? "text-white" : "text-gray-600 hover:text-gray-400"
              }`}
            >
              {tab.icon}{tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="tabLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00F0FF] rounded-t-full" initial={false} />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5 min-h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center h-48 gap-3">
              <Loader2 className="w-5 h-5 text-[#00F0FF] animate-spin" />
              <span className="text-sm font-mono text-gray-500">Loading results...</span>
            </div>
          ) : error ? (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-mono">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>

                {activeTab === "data" && (csvData ? (
                  <>
                    {csvData.totalRows > 200 && (
                      <p className="text-xs font-mono text-amber-400/70 mb-3">
                        Showing first 200 of {csvData.totalRows.toLocaleString()} rows — download for full dataset.
                      </p>
                    )}
                    <ExcelTable data={csvData.rows} headers={csvData.headers} />
                  </>
                ) : (
                  <p className="text-xs font-mono text-gray-600 text-center py-12">No CSV data available.</p>
                ))}

                {activeTab === "insights" && (
                  <div className="space-y-3">
                    {insights ? (
                      <>
                        <p className="text-xs font-mono text-gray-600 mb-4 px-1">
                          Real data from pipeline execution — every number is what the agents actually computed.
                        </p>
                        {insights.validation_report ? (
                          <InsightsReport data={insights} />
                        ) : (
                          <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <AlertCircle className="w-8 h-8 text-amber-400/60" />
                            <p className="text-sm font-mono text-gray-500">
                              Legacy report detected — no rich validation data available.
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <AlertCircle className="w-8 h-8 text-amber-400/60" />
                        <p className="text-sm font-mono text-gray-500">
                          No insights available — this job was run before phase data persistence was added.
                        </p>
                        <p className="text-xs font-mono text-gray-600">Re-run the pipeline with a new upload to see real insights.</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "logs" && (
                  <div>
                    {traces.length > 0 ? (
                      <>
                        <div className="flex items-center gap-2 mb-3 px-1">
                          <div className="w-2 h-2 rounded-full bg-[#00F0FF]" />
                          <p className="text-xs font-mono text-[#00F0FF]/70">
                            Live data from LangSmith — {traces.length} trace events
                          </p>
                        </div>
                        <div className="h-[400px]">
                          <InteractiveLogsTable logs={logs} />
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <ScrollText className="w-8 h-8 text-gray-700" />
                        <p className="text-sm font-mono text-gray-500">No LangSmith traces found.</p>
                        <p className="text-xs font-mono text-gray-600">
                          Make sure LANGSMITH_API_KEY is set in the backend .env and tracing is enabled.
                        </p>
                      </div>
                    )}
                  </div>
                )}

              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </motion.div>
  );
}
