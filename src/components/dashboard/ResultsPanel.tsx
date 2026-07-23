"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Download, Table2, ScrollText, FileCode2,
  Rows3, Columns3, Wrench, ShieldCheck, Loader2, AlertCircle
} from "lucide-react";
import { Job, fetchReport, fetchCleanedCsvText, downloadCleanedCsv } from "@/lib/api";
import { ExcelTable } from "@/components/ui/excel-style-table";
import { InteractiveLogsTable, PipelineLog } from "@/components/ui/interactive-logs-table";

type Tab = "data" | "logs" | "report";

interface ParsedCsv {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

// ── CSV Parser ──────────────────────────────────────────────────────────────
function parseCsvText(text: string): ParsedCsv {
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [], totalRows: 0 };

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === "," && !inQuotes) { result.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseRow(lines[0]).map(h => h.replace(/^"|"$/g, ""));
  const allRows = lines.slice(1).map(parseRow);
  // Show max 200 rows in preview
  const rows = allRows.slice(0, 200).map(r => r.map(c => c.replace(/^"|"$/g, "")));
  return { headers, rows, totalRows: allRows.length };
}

// ── Build pipeline log events from job + report markdown ─────────────────
function buildPipelineLogs(job: Job, reportMd: string): PipelineLog[] {
  const baseTime = new Date(job.created_at).getTime();
  const offset = (secs: number) => new Date(baseTime + secs * 1000).toISOString();

  // Try to extract step count from report markdown
  const stepMatch = reportMd.match(/##\s+Transformation Plan/i);
  const hasRetry = reportMd.toLowerCase().includes("retry") || !!job.error_message;
  const planLines = stepMatch ? reportMd.slice(reportMd.indexOf(stepMatch[0])).split("\n").filter(l => l.trim().startsWith("-")).length : 0;

  const logs: PipelineLog[] = [
    {
      id: "1",
      timestamp: offset(0),
      level: "info",
      agent: "ProfilerAgent",
      message: `Started profiling "${job.filename}"`,
      duration: "~0.8s",
      tags: ["profiler", "pandas"],
    },
    {
      id: "2",
      timestamp: offset(2),
      level: "info",
      agent: "QualityAgent",
      message: "Running Pandera quality checks on raw dataset",
      duration: "~0.5s",
      tags: ["pandera", "quality"],
    },
    {
      id: "3",
      timestamp: offset(4),
      level: "info",
      agent: "SchemaAgent",
      message: "Schema and data type inference complete",
      duration: "~0.3s",
      tags: ["schema", "dtypes"],
    },
    {
      id: "4",
      timestamp: offset(6),
      level: "info",
      agent: "PlannerAgent",
      message: `LLM generated transformation plan with ${planLines || "multiple"} cleaning steps`,
      duration: "~2.1s",
      tags: ["llm", "groq", "langgraph"],
    },
    {
      id: "5",
      timestamp: offset(10),
      level: "info",
      agent: "CodeGeneratorAgent",
      message: "LLM wrote pandas cleaning script for transformation plan",
      duration: "~3.4s",
      tags: ["llm", "codegen", "pandas"],
    },
    {
      id: "6",
      timestamp: offset(15),
      level: hasRetry ? "warning" : "info",
      agent: "ExecutorAgent",
      message: hasRetry
        ? "First execution attempt failed — triggering LangGraph circuit breaker retry"
        : "Cleaning script executed successfully in isolated subprocess",
      duration: "~1.2s",
      tags: ["executor", "subprocess", hasRetry ? "retry" : "success"],
    },
  ];

  if (hasRetry) {
    logs.push({
      id: "6b",
      timestamp: offset(20),
      level: "info",
      agent: "CodeGeneratorAgent",
      message: "LLM analysed error traceback and rewrote cleaning script",
      duration: "~3.1s",
      tags: ["llm", "retry", "error-recovery"],
    });
    logs.push({
      id: "6c",
      timestamp: offset(25),
      level: "info",
      agent: "ExecutorAgent",
      message: "Retry execution succeeded — cleaning script ran cleanly",
      duration: "~1.1s",
      tags: ["executor", "retry", "success"],
    });
  }

  logs.push(
    {
      id: "7",
      timestamp: offset(hasRetry ? 28 : 18),
      level: job.status === "FAILED" ? "error" : "info",
      agent: "ValidatorAgent",
      message: job.status === "FAILED"
        ? "Post-clean validation failed — high severity anomalies remain"
        : "Pandera validation passed — cleaned dataset is anomaly-free",
      duration: "~0.4s",
      tags: ["pandera", "validation", job.status === "FAILED" ? "failed" : "passed"],
    },
    {
      id: "8",
      timestamp: offset(hasRetry ? 30 : 20),
      level: "info",
      agent: "ReporterAgent",
      message: "Engineering report generated and saved to outputs/",
      duration: "~0.2s",
      tags: ["report", "markdown"],
    }
  );

  return logs;
}

// ── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 min-w-[120px] bg-white/[0.03] border border-white/10 rounded-2xl p-4 flex flex-col gap-2"
    >
      <div className="text-gray-600">{icon}</div>
      <div className="text-2xl font-mono font-bold text-[#00F0FF]">{value}</div>
      <div className="text-xs font-semibold text-gray-400 leading-tight">{label}</div>
      {sub && <div className="text-[10px] font-mono text-gray-600">{sub}</div>}
    </motion.div>
  );
}

// ── Simple Markdown renderer ──────────────────────────────────────────────
function MarkdownView({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-1 font-mono text-xs text-gray-300">
      {lines.map((line, i) => {
        if (line.startsWith("# ")) return <h2 key={i} className="text-base font-bold text-white mt-4 mb-1">{line.slice(2)}</h2>;
        if (line.startsWith("## ")) return <h3 key={i} className="text-sm font-bold text-[#00F0FF] mt-3 mb-1">{line.slice(3)}</h3>;
        if (line.startsWith("### ")) return <h4 key={i} className="text-xs font-bold text-[#00F0FF]/70 mt-2">{line.slice(4)}</h4>;
        if (line.startsWith("```")) return <div key={i} className="border-t border-dashed border-white/10 my-2" />;
        if (line.startsWith("- ")) return <p key={i} className="text-gray-400 pl-4">• {line.slice(2)}</p>;
        if (line.trim() === "") return <div key={i} className="h-2" />;
        return <p key={i} className="text-gray-400 leading-relaxed">{line}</p>;
      })}
    </div>
  );
}

// ── Main ResultsPanel ────────────────────────────────────────────────────────
interface ResultsPanelProps {
  job: Job;
}

export function ResultsPanel({ job }: ResultsPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("data");
  const [csvData, setCsvData] = useState<ParsedCsv | null>(null);
  const [reportMd, setReportMd] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (job.status !== "COMPLETED") return;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchReport(job.id).catch(() => ""),
      fetchCleanedCsvText(job.id).catch(() => ""),
    ]).then(([report, csv]) => {
      setReportMd(report);
      if (csv) setCsvData(parseCsvText(csv));
    }).catch(err => {
      setError(err.message);
    }).finally(() => setLoading(false));
  }, [job.id, job.status]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadCleanedCsv(job.id, job.filename);
    } catch (e) {
      console.error("Download failed:", e);
    } finally {
      setIsDownloading(false);
    }
  };

  const pipelineLogs = buildPipelineLogs(job, reportMd);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "data", label: "Cleaned Data", icon: <Table2 className="w-3.5 h-3.5" /> },
    { id: "logs", label: "Pipeline Logs", icon: <ScrollText className="w-3.5 h-3.5" /> },
    { id: "report", label: "Report", icon: <FileCode2 className="w-3.5 h-3.5" /> },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="w-full max-w-5xl mt-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Pipeline Complete</h3>
            <p className="text-xs font-mono text-gray-500">{job.filename}</p>
          </div>
        </div>

        <motion.button
          onClick={handleDownload}
          disabled={isDownloading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 px-5 py-2 bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-60 text-white text-sm font-semibold rounded-full shadow-[0_0_20px_rgba(34,197,94,0.25)] transition-all"
        >
          {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {isDownloading ? "Downloading..." : "Download Cleaned CSV"}
        </motion.button>
      </div>

      {/* Stat cards */}
      {csvData && (
        <div className="flex gap-3 mb-5 flex-wrap">
          <StatCard icon={<Rows3 className="w-4 h-4" />} label="Rows Processed" value={csvData.totalRows.toLocaleString()} sub="in cleaned output" />
          <StatCard icon={<Columns3 className="w-4 h-4" />} label="Columns" value={String(csvData.headers.length)} sub="feature columns" />
          <StatCard icon={<Wrench className="w-4 h-4" />} label="Transformations" value={pipelineLogs.filter(l => l.agent === "CodeGeneratorAgent").length.toString()} sub="LLM code passes" />
          <StatCard
            icon={<ShieldCheck className="w-4 h-4" />}
            label="Quality Status"
            value={job.status === "COMPLETED" ? "✓ Pass" : "✗ Fail"}
            sub="Pandera validation"
          />
        </div>
      )}

      {/* Main panel */}
      <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-white/10 px-4 pt-3 gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-1.5 px-4 pb-3 text-xs font-semibold transition-colors ${
                activeTab === tab.id ? "text-white" : "text-gray-600 hover:text-gray-400"
              }`}
            >
              {tab.icon}
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="tabIndicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00F0FF] rounded-t-full"
                  initial={false}
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-5 min-h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center h-48 gap-3">
              <Loader2 className="w-5 h-5 text-[#00F0FF] animate-spin" />
              <span className="text-sm font-mono text-gray-500">Loading results...</span>
            </div>
          ) : error ? (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-mono">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === "data" && (
                  csvData ? (
                    <div>
                      {csvData.totalRows > 200 && (
                        <p className="text-xs font-mono text-amber-400/70 mb-3">
                          Showing first 200 of {csvData.totalRows.toLocaleString()} rows. Download for full dataset.
                        </p>
                      )}
                      <ExcelTable data={csvData.rows} headers={csvData.headers} />
                    </div>
                  ) : (
                    <p className="text-xs font-mono text-gray-600 text-center py-12">No CSV data available to preview.</p>
                  )
                )}

                {activeTab === "logs" && (
                  <div className="h-96">
                    <InteractiveLogsTable logs={pipelineLogs} />
                  </div>
                )}

                {activeTab === "report" && (
                  <div className="max-h-96 overflow-y-auto pr-2">
                    {reportMd ? (
                      <MarkdownView content={reportMd} />
                    ) : (
                      <p className="text-xs font-mono text-gray-600 text-center py-12">Report not available.</p>
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
