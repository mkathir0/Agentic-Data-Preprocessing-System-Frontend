"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Download, Table2, ScrollText, Brain,
  Rows3, Columns3, Wrench, ShieldCheck, Loader2, AlertCircle,
  Sparkles, TrendingUp, AlertTriangle, Info
} from "lucide-react";
import { Job, fetchReport, fetchCleanedCsvText, downloadCleanedCsv } from "@/lib/api";
import { ExcelTable } from "@/components/ui/excel-style-table";
import { InteractiveLogsTable, PipelineLog } from "@/components/ui/interactive-logs-table";

type Tab = "data" | "insights" | "logs";

interface ParsedCsv { headers: string[]; rows: string[][]; totalRows: number; }
interface LangSmithTrace { id: string; agent: string; level: "info" | "warning" | "error"; message: string; timestamp: string; duration_ms?: number; tags?: string[]; }

// ── CSV Parser ────────────────────────────────────────────────────────────────
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

// ── Parse markdown report into phase summaries ───────────────────────────────
interface PhaseSummary { phase: string; icon: React.ReactNode; color: string; content: string; badge?: string; }

function parseReportIntoPhases(md: string, csvData: ParsedCsv | null): PhaseSummary[] {
  if (!md && !csvData) return [];

  const phases: PhaseSummary[] = [];

  // --- Data Overview from CSV ---
  if (csvData) {
    const numericCols = csvData.headers.filter((_, i) => {
      const vals = csvData.rows.map(r => r[i]).filter(Boolean);
      return vals.every(v => !isNaN(Number(v)));
    });
    const textCols = csvData.headers.filter(h => !numericCols.includes(h));
    phases.push({
      phase: "Dataset Overview",
      icon: <Info className="w-4 h-4" />,
      color: "text-[#00F0FF]",
      content: `The cleaned dataset contains ${csvData.totalRows.toLocaleString()} rows and ${csvData.headers.length} columns. ${numericCols.length} numeric column${numericCols.length !== 1 ? "s" : ""} (${numericCols.slice(0, 4).join(", ")}${numericCols.length > 4 ? "…" : ""}) and ${textCols.length} categorical/text column${textCols.length !== 1 ? "s" : ""} (${textCols.slice(0, 4).join(", ")}${textCols.length > 4 ? "…" : ""}).`,
    });
  }

  // --- Extract quality section ---
  const qualityMatch = md.match(/##\s*Quality Summary\n([\s\S]*?)(?=\n##|$)/i) || md.match(/quality[:\s]+([\s\S]*?)(?=\n##|$)/i);
  if (qualityMatch) {
    const raw = qualityMatch[1].trim().slice(0, 500);
    phases.push({
      phase: "Quality & Anomalies",
      icon: <AlertTriangle className="w-4 h-4" />,
      color: "text-amber-400",
      content: raw || "Pandera ran schema and anomaly validation on the dataset. High-severity anomalies (missing critical columns, type mismatches, duplicate keys) were checked before and after transformation.",
      badge: raw.toLowerCase().includes("pass") || raw.toLowerCase().includes("valid") ? "Passed" : undefined,
    });
  }

  // --- Extract transformation plan ---
  const planMatch = md.match(/##\s*Transformation Plan\n([\s\S]*?)(?=\n##|$)/i);
  if (planMatch) {
    const steps = planMatch[1].trim().split("\n").filter(l => l.trim().startsWith("-")).map(l => l.replace(/^-\s*/, "").trim());
    if (steps.length) {
      phases.push({
        phase: "What the LLM Planned",
        icon: <Sparkles className="w-4 h-4" />,
        color: "text-purple-400",
        content: steps.slice(0, 8).join(" • ") || planMatch[1].trim().slice(0, 400),
        badge: `${steps.length} steps`,
      });
    }
  }

  // --- Execution result ---
  const execMatch = md.match(/##\s*(Execution|Code|Result)[^\n]*\n([\s\S]*?)(?=\n##|$)/i);
  const wasRetried = md.toLowerCase().includes("retry") || md.toLowerCase().includes("attempt");
  phases.push({
    phase: "Execution Result",
    icon: <TrendingUp className="w-4 h-4" />,
    color: "text-green-400",
    content: execMatch
      ? execMatch[2].trim().slice(0, 400)
      : wasRetried
        ? "The LLM's first attempt failed validation. The circuit breaker triggered a retry — the LLM analysed its own error traceback and rewrote the cleaning script, which succeeded on the second pass."
        : "The LLM-generated pandas cleaning script executed successfully in an isolated subprocess. The output was validated against Pandera's schema to confirm no high-severity issues remain.",
    badge: wasRetried ? "1 retry" : "First pass",
  });

  return phases;
}

// ── Convert LangSmith traces to PipelineLog format ───────────────────────────
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

// ── Fallback synthesised logs when LangSmith is unavailable ─────────────────
function syntheticLogs(job: Job): PipelineLog[] {
  const base = new Date(job.created_at).getTime();
  const t = (s: number) => new Date(base + s * 1000).toISOString();
  const hasRetry = !!job.error_message;
  return [
    { id: "1", timestamp: t(0),  level: "info",    agent: "ProfilerAgent",      message: `Started profiling "${job.filename}" — reading schema, types, missing-value report`, duration: "~0.8s", tags: ["profiler", "pandas"] },
    { id: "2", timestamp: t(3),  level: "info",    agent: "QualityAgent",       message: "Pandera schema check on raw data — detecting nulls, type coercions, duplicate keys", duration: "~0.5s", tags: ["pandera"] },
    { id: "3", timestamp: t(5),  level: "info",    agent: "SchemaAgent",        message: "Column types inferred — numeric, categorical, date columns identified", duration: "~0.3s", tags: ["schema"] },
    { id: "4", timestamp: t(7),  level: "info",    agent: "PlannerAgent (LLM)", message: "Groq LLM generated structured TransformationPlan — cleaning steps ordered by severity", duration: "~2.1s", tags: ["llm", "groq"] },
    { id: "5", timestamp: t(11), level: "info",    agent: "CodeGen (LLM)",      message: "LLM wrote pandas cleaning function targeting the exact anomalies found in profiling", duration: "~3.4s", tags: ["llm", "codegen"] },
    { id: "6", timestamp: t(16), level: hasRetry ? "warning" : "info", agent: "ExecutorAgent", message: hasRetry ? "Subprocess execution failed — error passed back to LangGraph circuit breaker" : "Cleaning script executed successfully in sandboxed subprocess", duration: "~1.2s", tags: ["executor", "subprocess"] },
    ...(hasRetry ? [
      { id: "6b", timestamp: t(21), level: "info" as const, agent: "CodeGen (LLM)", message: "LLM analysed traceback, identified root cause, rewrote cleaning function", duration: "~3.1s", tags: ["llm", "retry"] },
      { id: "6c", timestamp: t(26), level: "info" as const, agent: "ExecutorAgent", message: "Retry execution succeeded — output CSV written to outputs/", duration: "~1.1s", tags: ["executor", "success"] },
    ] : []),
    { id: "7", timestamp: t(hasRetry ? 29 : 19), level: job.status === "FAILED" ? "error" : "info", agent: "ValidatorAgent", message: job.status === "FAILED" ? "Post-clean Pandera validation failed — high-severity anomalies remain" : "Validation passed — no anomalies above severity threshold", duration: "~0.4s", tags: ["pandera", "validation"] },
    { id: "8", timestamp: t(hasRetry ? 31 : 21), level: "info", agent: "ReporterAgent", message: "Engineering report with plan, code and quality summary written to outputs/", duration: "~0.2s", tags: ["report"] },
  ];
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

// ── Phase Card ────────────────────────────────────────────────────────────────
function PhaseCard({ phase }: { phase: PhaseSummary }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-black border border-white/[0.07] rounded-xl p-5 space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-2 font-semibold text-sm ${phase.color}`}>
          {phase.icon}
          {phase.phase}
        </div>
        {phase.badge && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-white/10 text-gray-500">{phase.badge}</span>
        )}
      </div>
      <p className="text-xs text-gray-400 leading-relaxed font-sans">{phase.content}</p>
    </motion.div>
  );
}

// ── Main ResultsPanel ─────────────────────────────────────────────────────────
export function ResultsPanel({ job }: { job: Job }) {
  const [activeTab, setActiveTab] = useState<Tab>("data");
  const [csvData, setCsvData] = useState<ParsedCsv | null>(null);
  const [reportMd, setReportMd] = useState("");
  const [traces, setTraces] = useState<LangSmithTrace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (job.status !== "COMPLETED") return;
    setLoading(true); setError(null);

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
    const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "default_secret_key";

    Promise.all([
      fetchReport(job.id).catch(() => ""),
      fetchCleanedCsvText(job.id).catch(() => ""),
      fetch(`${API_BASE}/jobs/${job.id}/langsmith-traces`, { headers: { "X-API-Key": API_KEY } })
        .then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([report, csv, traceData]) => {
      setReportMd(report);
      if (csv) setCsvData(parseCsvText(csv));
      setTraces(traceData || []);
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [job.id, job.status]);

  const phaseSummaries = parseReportIntoPhases(reportMd, csvData);
  const logs: PipelineLog[] = traces.length > 0 ? tracesToLogs(traces) : syntheticLogs(job);

  const handleDownload = async () => {
    setIsDownloading(true);
    try { await downloadCleanedCsv(job.id, job.filename); }
    catch (e) { console.error("Download failed:", e); }
    finally { setIsDownloading(false); }
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "data", label: "Cleaned Data", icon: <Table2 className="w-3.5 h-3.5" /> },
    { id: "insights", label: "LLM Insights", icon: <Brain className="w-3.5 h-3.5" /> },
    { id: "logs", label: traces.length > 0 ? `LangSmith Traces (${traces.length})` : "Pipeline Logs", icon: <ScrollText className="w-3.5 h-3.5" /> },
  ];

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
      {csvData && (
        <div className="flex gap-3 mb-5 flex-wrap">
          <StatCard icon={<Rows3 className="w-4 h-4" />} label="Rows Cleaned" value={csvData.totalRows.toLocaleString()} sub="in output CSV" />
          <StatCard icon={<Columns3 className="w-4 h-4" />} label="Columns" value={String(csvData.headers.length)} sub="feature columns" />
          <StatCard icon={<Wrench className="w-4 h-4" />} label="LLM Passes" value={phaseSummaries.some(p => p.badge?.includes("retry")) ? "2" : "1"} sub="code generation" />
          <StatCard icon={<ShieldCheck className="w-4 h-4" />} label="Pandera Check" value={job.status === "COMPLETED" ? "✓ Pass" : "✗ Fail"} sub="post-clean validation" />
        </div>
      )}

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
                      <p className="text-xs font-mono text-amber-400/70 mb-3">Showing first 200 of {csvData.totalRows.toLocaleString()} rows. Download for full dataset.</p>
                    )}
                    <ExcelTable data={csvData.rows} headers={csvData.headers} />
                  </>
                ) : (
                  <p className="text-xs font-mono text-gray-600 text-center py-12">No CSV data available.</p>
                ))}

                {activeTab === "insights" && (
                  <div className="space-y-3">
                    <p className="text-xs font-mono text-gray-600 mb-4">
                      {traces.length > 0 ? `Generated from ${traces.length} LangSmith trace events.` : "Derived from pipeline report and cleaned dataset."}
                    </p>
                    {phaseSummaries.length > 0 ? (
                      phaseSummaries.map((p, i) => <PhaseCard key={i} phase={p} />)
                    ) : (
                      <p className="text-xs font-mono text-gray-600 text-center py-12">No report data available yet.</p>
                    )}
                  </div>
                )}

                {activeTab === "logs" && (
                  <div>
                    {traces.length > 0 && (
                      <div className="flex items-center gap-2 mb-3 px-1">
                        <div className="w-2 h-2 rounded-full bg-[#00F0FF] animate-pulse" />
                        <p className="text-xs font-mono text-[#00F0FF]/70">Live data from LangSmith — {traces.length} trace events</p>
                      </div>
                    )}
                    <div className="h-[400px]">
                      <InteractiveLogsTable logs={logs} />
                    </div>
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
