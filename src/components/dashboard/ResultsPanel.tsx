"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Download, Table2, ScrollText, BarChart3,
  Rows3, Columns3, ShieldCheck, Loader2, AlertCircle,
  FileJson, Copy, Check, Scale, RefreshCw, AlertTriangle,
  Code2, ArrowLeft, Sparkles, Filter, Eye, ChevronRight,
  FileText
} from "lucide-react";
import {
  Job,
  fetchCleanedCsvText,
  fetchRawCsvText,
  fetchReport,
  downloadCleanedCsv,
  downloadJsonBlob,
  downloadPythonScript,
  downloadReport,
  downloadMarkdownBlob
} from "@/lib/api";
import { ExcelTable } from "@/components/ui/excel-style-table";
import { InteractiveLogsTable, PipelineLog } from "@/components/ui/interactive-logs-table";
import { InsightsReport, InsightsData } from "./InsightsReport";

type Tab = "data" | "recipe" | "insights" | "expectations" | "report" | "logs";

interface ParsedCsv {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

interface LangSmithTrace {
  id: string;
  agent: string;
  level: "info" | "warning" | "error";
  message: string;
  timestamp: string;
  duration_ms?: number | null;
  status?: "pending" | "completed" | "error";
  tags?: string[];
}

// ── CSV Parser ──────────────────────────────────────────────────────────────
function parseCsvText(text: string): ParsedCsv {
  const lines = text.trim().split("\n").filter(Boolean);
  if (!lines.length) return { headers: [], rows: [], totalRows: 0 };
  const parseRow = (line: string) => {
    const res: string[] = [];
    let cur = "";
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') inQ = !inQ;
      else if (ch === "," && !inQ) {
        res.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    res.push(cur.trim());
    return res;
  };
  const headers = parseRow(lines[0]).map((h) => h.replace(/^"|"$/g, ""));
  const all = lines.slice(1).map(parseRow);
  return {
    headers,
    rows: all.slice(0, 200).map((r) => r.map((c) => c.replace(/^"|"$/g, ""))),
    totalRows: all.length,
  };
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.03, y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="flex-1 min-w-[140px] bg-black border border-white/[0.08] rounded-xl p-4 flex flex-col gap-1.5 shadow-sm"
    >
      <div className="text-gray-500">{icon}</div>
      <div className="text-lg font-mono font-bold text-[#00F0FF]">{value}</div>
      <div className="text-xs font-semibold text-gray-300">{label}</div>
      {sub && <div className="text-[10px] font-mono text-gray-500 truncate">{sub}</div>}
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
    duration: t.duration_ms != null ? `${(t.duration_ms / 1000).toFixed(2)}s` : undefined,
    tags: t.tags ?? [],
  }));
}

// ── Main ResultsPanel Component ──────────────────────────────────────────────
export function ResultsPanel({
  job,
  onReset,
}: {
  job: Job;
  onReset?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("data");
  const [cleanedCsvData, setCleanedCsvData] = useState<ParsedCsv | null>(null);
  const [rawCsvData, setRawCsvData] = useState<ParsedCsv | null>(null);
  const [dataViewMode, setDataViewMode] = useState<"cleaned" | "raw">("cleaned");
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [traces, setTraces] = useState<LangSmithTrace[]>([]);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [traceRefresh, setTraceRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [reportMarkdown, setReportMarkdown] = useState<string | null>(null);
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);
  const [copiedGxSuite, setCopiedGxSuite] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [recipeFilter, setRecipeFilter] = useState<"ALL" | "high" | "medium" | "low">("ALL");

  useEffect(() => {
    if (job.status !== "COMPLETED" && job.status !== "FAILED") return;
    setLoading(true);
    setError(null);

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
    const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "default_secret_key";
    const headers = { "X-API-Key": API_KEY };

    Promise.all([
      fetchCleanedCsvText(job.id).catch(() => ""),
      fetchRawCsvText(job.id).catch(() => ""),
      fetch(`${API_BASE}/jobs/${job.id}/insights`, { headers })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetchReport(job.id).catch(() => null),
    ])
      .then(([cleanedCsv, rawCsv, insightsData, reportText]) => {
        if (cleanedCsv) setCleanedCsvData(parseCsvText(cleanedCsv));
        if (rawCsv) setRawCsvData(parseCsvText(rawCsv));
        setInsights(insightsData);
        if (reportText) setReportMarkdown(reportText);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [job.id, job.status]);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const terminal = job.status === "COMPLETED" || job.status === "FAILED";
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
    const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "default_secret_key";
    setTraces([]);
    setTraceError(null);

    async function refreshTraces() {
      let complete = false;
      try {
        const response = await fetch(`${API_BASE}/jobs/${job.id}/langsmith-traces`, {
          headers: { "X-API-Key": API_KEY },
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.detail || `Trace request failed (${response.status})`);
        }
        const data: LangSmithTrace[] = await response.json();
        if (!controller.signal.aborted) {
          setTraces(data);
          setTraceError(null);
          complete = data.length > 0 && data.every((trace) => trace.status !== "pending");
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setTraceError(error instanceof Error ? error.message : "Could not load LangSmith traces.");
        }
      } finally {
        attempts += 1;
        // Allow for cloud ingestion delay after completion. Keep the open
        // trace tab current; bound background retries for historical jobs.
        if (!controller.signal.aborted && (!terminal || activeTab === "logs" || (!complete && attempts < 12))) {
          timer = setTimeout(refreshTraces, 5000);
        }
      }
    }
    void refreshTraces();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [job.id, job.status, activeTab, traceRefresh]);

  const logs: PipelineLog[] = traces.length > 0 ? tracesToLogs(traces) : [];

  const handleDownloadCsv = async () => {
    setIsDownloading(true);
    try {
      await downloadCleanedCsv(job.id, job.filename);
    } catch (e) {
      console.error("Download failed:", e);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadReport = async () => {
    setIsDownloadingReport(true);
    try {
      if (reportMarkdown) {
        downloadMarkdownBlob(reportMarkdown, `report_${job.filename.replace(/\.csv$/, "")}.md`);
      } else {
        await downloadReport(job.id, job.filename);
      }
    } catch (e) {
      console.error("Report download failed:", e);
    } finally {
      setIsDownloadingReport(false);
    }
  };

  const handleCopyReport = () => {
    if (!reportMarkdown) return;
    navigator.clipboard.writeText(reportMarkdown);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const vr = insights?.validation_report;
  const gxSuite = vr?.great_expectations_suite;
  const planData = insights?.plan_data;
  const planActions = Array.isArray(planData?.actions) ? planData.actions : [];
  const cleaningCode = insights?.cleaning_code;

  const handleCopyGxSuite = () => {
    if (!gxSuite) return;
    navigator.clipboard.writeText(JSON.stringify(gxSuite, null, 2));
    setCopiedGxSuite(true);
    setTimeout(() => setCopiedGxSuite(false), 2000);
  };

  const handleDownloadGxSuite = () => {
    if (!gxSuite) return;
    downloadJsonBlob(gxSuite, `${job.filename.replace(/\.[^/.]+$/, "")}_gx_suite.json`);
  };

  const handleCopyCode = () => {
    if (!cleaningCode) return;
    navigator.clipboard.writeText(cleaningCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownloadScript = () => {
    if (!cleaningCode) return;
    downloadPythonScript(cleaningCode, job.filename);
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: "data",
      label: "Data Preview",
      icon: <Table2 className="w-3.5 h-3.5" />,
      badge: cleanedCsvData ? `${cleanedCsvData.totalRows.toLocaleString()} rows` : undefined,
    },
    {
      id: "recipe",
      label: "AI Recipe & Code",
      icon: <Code2 className="w-3.5 h-3.5 text-[#00F0FF]" />,
      badge: planActions.length > 0 ? `${planActions.length} actions` : undefined,
    },
    {
      id: "insights",
      label: "Quality & Validation",
      icon: <BarChart3 className="w-3.5 h-3.5" />,
    },
    {
      id: "expectations",
      label: `Great Expectations ${gxSuite ? `(${gxSuite.expectations?.length || 0})` : ""}`,
      icon: <FileJson className="w-3.5 h-3.5" />,
    },
    {
      id: "report",
      label: "Engineering Report (.md)",
      icon: <FileText className="w-3.5 h-3.5 text-emerald-400" />,
    },
    {
      id: "logs",
      label: traces.length > 0 ? `LangSmith Traces (${traces.length})` : "LangSmith Traces",
      icon: <ScrollText className="w-3.5 h-3.5" />,
    },
  ];

  const passedVerification = job.status === "COMPLETED" && vr?.overall_passed === true && vr?.integrity_passed === true;
  const canDownloadCandidate = Boolean(job.cleaned_filepath) && vr?.integrity_passed === true;
  const isFailed = job.status === "FAILED" || !passedVerification;
  const isReviewFlagged = job.current_step === "REVIEW_FLAGGED" || ((vr?.key_conflict_count ?? 0) > 0);
  const hasReviewItems = vr?.integrity_passed === true && (isReviewFlagged || ((vr?.escalation_flags?.length ?? 0) > 0) || (isFailed && cleanedCsvData !== null));

  const rawRowsCount = rawCsvData?.totalRows ?? insights?.profiler_data?.num_rows ?? 0;
  const cleanedRowsCount = cleanedCsvData?.totalRows ?? rawRowsCount;
  const duplicatesDropped = vr?.exact_duplicates_removed ?? (rawRowsCount > cleanedRowsCount ? rawRowsCount - cleanedRowsCount : 0);

  const dqBefore = vr?.data_quality_score_before !== undefined ? `${vr.data_quality_score_before.toFixed(1)}` : "—";
  const dqAfter = vr?.data_quality_score_after !== undefined ? `${vr.data_quality_score_after.toFixed(1)}` : "—";
  const dqImp = vr?.score_improvement !== undefined ? `${vr.score_improvement >= 0 ? "+" : ""}${vr.score_improvement.toFixed(1)}%` : "—";

  const panderaStatus = vr?.pandera_schema_passed !== undefined
    ? vr.pandera_schema_passed
      ? "✓ Verified"
      : "✗ Escalated"
    : vr?.overall_passed
    ? "✓ Verified"
    : isFailed
    ? "✗ Escalated"
    : "—";

  const filteredActions = recipeFilter === "ALL"
    ? planActions
    : planActions.filter((a: any) => a.confidence?.toLowerCase() === recipeFilter);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="w-full max-w-5xl mt-8"
    >
      {/* ── Top Navigation & Action Bar ──────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          {onReset && (
            <motion.button
              onClick={onReset}
              whileHover={{ scale: 1.04, x: -2 }}
              whileTap={{ scale: 0.96 }}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-mono rounded-xl border border-white/10 transition-colors"
              title="Return to upload screen to process another dataset"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#00F0FF]" />
              Process Another File
            </motion.button>
          )}

          <div
            className={`w-8 h-8 rounded-full border flex items-center justify-center ${
              hasReviewItems
                ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                : isFailed
                ? "bg-red-500/10 border-red-500/20 text-red-400"
                : "bg-green-500/10 border-green-500/20 text-green-400"
            }`}
          >
            {hasReviewItems ? <AlertTriangle className="w-4 h-4" /> : isFailed ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">
                {hasReviewItems
                  ? "Cleaned · Human Review Recommended"
                  : isFailed
                  ? "Execution Halted"
                  : "Autonomous Preprocessing Completed"}
              </h3>
              {job.user_instructions && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/20 truncate max-w-xs">
                  Prompt: {job.user_instructions}
                </span>
              )}
            </div>
            <p className="text-xs font-mono text-gray-500 truncate max-w-sm">
              {job.filename}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {cleaningCode && (
            <button
              onClick={handleDownloadScript}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-mono rounded-xl border border-white/10 transition-colors"
              title="Download generated Python cleaning code"
            >
              <Code2 className="w-3.5 h-3.5 text-[#00F0FF]" />
              Export .py Script
            </button>
          )}

          {gxSuite && (
            <button
              onClick={handleDownloadGxSuite}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-mono rounded-xl border border-white/10 transition-colors"
              title="Export Great Expectations JSON suite"
            >
              <FileJson className="w-3.5 h-3.5 text-[#00F0FF]" />
              Export GX Suite
            </button>
          )}

          {reportMarkdown && (
            <button
              onClick={handleDownloadReport}
              disabled={isDownloadingReport}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-mono rounded-xl border border-white/10 transition-colors disabled:opacity-50"
              title="Download generated Markdown quality audit report"
            >
              {isDownloadingReport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 text-emerald-400" />}
              Export Report (.md)
            </button>
          )}

          <motion.button
            onClick={handleDownloadCsv}
            disabled={isDownloading || !canDownloadCandidate}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#00F0FF] hover:bg-[#00D0DD] disabled:opacity-60 text-black text-sm font-semibold rounded-full shadow-[0_0_20px_rgba(0,240,255,0.4)] animate-pulse-glow"
          >
            {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isDownloading ? "Downloading..." : passedVerification ? "Download Verified CSV" : "Download Review Candidate"}
          </motion.button>
        </div>
      </div>

      {/* ── Executive Audit / Circuit Breaker Banner ─────────────────────── */}
      {hasReviewItems ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl flex items-start gap-3.5"
        >
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-amber-200">
              Autonomous Safety Protocol Active: Human Review Recommended
            </h4>
            <p className="text-xs text-amber-300/80 leading-relaxed font-sans">
              This run has unresolved review items. Only supported, verified transformations may be applied; ambiguous values are preserved.
              {vr?.key_conflict_count && vr.key_conflict_count > 0 ? (
                <>
                  {" "}However, the validation engine detected{" "}
                  <strong className="text-amber-100">{vr.key_conflict_count} primary key collisions</strong> (identical IDs with conflicting records).
                  Rather than blindly overwriting or discarding transactions, the self-healing circuit breaker safely preserved these rows for human domain review.
                </>
              ) : vr?.escalation_flags && vr.escalation_flags.length > 0 ? (
                <>
                  {" "}The validation engine flagged{" "}
                  <strong className="text-amber-100">{vr.escalation_flags.length} domain / cross-field anomalies</strong> for verification.
                  Inspect the audit before using the candidate output. It is not approved for production.
                </>
              ) : (
                <>
                  {" "}Validation has not established that this output is safe to use. Review the report or run the dataset again.
                </>
              )}
            </p>
          </div>
        </motion.div>
      ) : isFailed ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 p-4 bg-red-500/10 border border-red-500/25 rounded-2xl flex items-start gap-3.5"
        >
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-red-200">
              Execution Halted
            </h4>
            <p className="text-xs text-red-300/80 leading-relaxed font-sans">
              {job.error_message || "This output has not passed the current integrity checks. Review the report or run the dataset again."}
            </p>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between flex-wrap gap-2"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-emerald-200">
                Integrity and Validation Checks Passed
              </h4>
              <p className="text-xs text-emerald-300/70">
                Output matches the supported cleaning plan and passed the implemented validation checks.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30">
            Zero Violations
          </span>
        </motion.div>
      )}

      {/* ── Executive Stat Cards ─────────────────────────────────────────── */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <StatCard
          icon={<Scale className="w-4 h-4 text-[#00F0FF]" />}
          label="Data Quality Score"
          value={dqAfter !== "—" ? `${dqAfter}/100` : "—"}
          sub={
            dqBefore !== "—" && dqAfter !== "—"
              ? `${dqBefore} → ${dqAfter} (${dqImp})`
              : dqImp !== "—"
              ? dqImp
              : undefined
          }
        />
        <StatCard
          icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
          label="Pandera Contract"
          value={panderaStatus}
          sub="Lazy DataFrameSchema"
        />
        <StatCard
          icon={<Rows3 className="w-4 h-4 text-purple-400" />}
          label="Dataset Volume"
          value={cleanedRowsCount ? `${cleanedRowsCount.toLocaleString()} rows` : "—"}
          sub={
            duplicatesDropped > 0
              ? `-${duplicatesDropped.toLocaleString()} duplicates dropped`
              : `${cleanedCsvData?.headers.length ?? "—"} columns`
          }
        />
        <StatCard
          icon={<RefreshCw className="w-4 h-4 text-amber-400" />}
          label="Self-Healing Retries"
          value={`${job.retry_count ?? insights?.retry_count ?? 0} / 3`}
          sub={
            vr?.key_conflict_count
              ? `${vr.key_conflict_count} PK conflicts`
              : isFailed
              ? "Quarantined for review"
              : "0 schema failures"
          }
        />
      </div>

      {/* ── Actionable Next Steps & Production Handoff ──────────────────── */}
      {passedVerification && (
      <div className="mb-6 bg-gradient-to-r from-blue-950/20 via-[#050505] to-cyan-950/20 border border-[#00F0FF]/20 rounded-2xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-[#00F0FF]" />
            <h4 className="text-sm font-semibold text-white tracking-wide">
              Production Handoff & Recommended Next Steps
            </h4>
          </div>
          <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/20">
            Actionable Next Steps
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Step 1 */}
          <div className="p-3.5 bg-black/40 border border-white/5 rounded-xl flex flex-col justify-between hover:border-[#00F0FF]/30 transition-colors">
            <div>
              <div className="flex items-center gap-2 mb-1.5 text-white font-semibold">
                <Download className="w-3.5 h-3.5 text-[#00F0FF]" />
                1. Analytics / BI Ready
              </div>
              <p className="text-gray-400 text-[11px] leading-relaxed">
                Export the verified CSV for downstream analysis. Review its audit for the exact transformations and remaining domain assumptions.
              </p>
            </div>
            <button
              onClick={handleDownloadCsv}
              disabled={isDownloading || !canDownloadCandidate}
              className="mt-3 text-[11px] font-mono text-[#00F0FF] hover:underline flex items-center gap-1 self-start disabled:opacity-50"
            >
              Download CSV <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* Step 2 */}
          <div className="p-3.5 bg-black/40 border border-white/5 rounded-xl flex flex-col justify-between hover:border-[#00F0FF]/30 transition-colors">
            <div>
              <div className="flex items-center gap-2 mb-1.5 text-white font-semibold">
                <Code2 className="w-3.5 h-3.5 text-purple-400" />
                2. Automated Airflow / ETL
              </div>
              <p className="text-gray-400 text-[11px] leading-relaxed">
                Review and test the generated script against future input contracts before scheduling it in your ETL system.
              </p>
            </div>
            <button
              onClick={handleDownloadScript}
              disabled={!cleaningCode}
              className="mt-3 text-[11px] font-mono text-purple-400 hover:underline flex items-center gap-1 self-start disabled:opacity-50"
            >
              Export Script (.py) <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* Step 3 */}
          <div className="p-3.5 bg-black/40 border border-white/5 rounded-xl flex flex-col justify-between hover:border-[#00F0FF]/30 transition-colors">
            <div>
              <div className="flex items-center gap-2 mb-1.5 text-white font-semibold">
                <FileJson className="w-3.5 h-3.5 text-emerald-400" />
                3. CI/CD Quality Gate
              </div>
              <p className="text-gray-400 text-[11px] leading-relaxed">
                Plug the Great Expectations JSON suite into your GitHub Actions CI/CD or dbt pipeline to automatically catch vendor schema regressions.
              </p>
            </div>
            <button
              onClick={handleDownloadGxSuite}
              disabled={!gxSuite}
              className="mt-3 text-[11px] font-mono text-emerald-400 hover:underline flex items-center gap-1 self-start disabled:opacity-50"
            >
              Export GX Suite (.json) <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* Step 4 */}
          <div className="p-3.5 bg-black/40 border border-white/5 rounded-xl flex flex-col justify-between hover:border-[#00F0FF]/30 transition-colors">
            <div>
              <div className="flex items-center gap-2 mb-1.5 text-white font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                4. Domain Reconciliation
              </div>
              <p className="text-gray-400 text-[11px] leading-relaxed">
                {vr?.key_conflict_count && vr.key_conflict_count > 0
                  ? `Review the ${vr.key_conflict_count} flagged primary key collisions with business stakeholders before merging into production ERP / DB.`
                  : "Inspect before/after distributions and confidence metrics in the audit tab before final production database ingestion."}
              </p>
            </div>
            <button
              onClick={() => setActiveTab("insights")}
              className="mt-3 text-[11px] font-mono text-amber-400 hover:underline flex items-center gap-1 self-start"
            >
              View Quality Audit <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      )}

      {/* ── Main Tabbed Panel ────────────────────────────────────────────── */}
      <div className="bg-[#020202] border border-white/[0.07] rounded-2xl overflow-hidden shadow-2xl">
        {/* Tab Bar */}
        <div className="flex border-b border-white/[0.07] px-4 pt-3 gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-4 pb-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === tab.id ? "text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.badge && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    activeTab === tab.id
                      ? "bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/30"
                      : "bg-white/5 text-gray-500"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTabLine"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00F0FF] rounded-t-full"
                  initial={false}
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content Area */}
        <div className="p-5 min-h-[350px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-56 gap-3">
              <Loader2 className="w-6 h-6 text-[#00F0FF] animate-spin" />
              <span className="text-sm font-mono text-gray-400">Loading dataset and insights...</span>
            </div>
          ) : error ? (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-mono">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
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
                {/* ── TAB 1: DATA PREVIEW (BEFORE VS AFTER TOGGLE) ─────────── */}
                {activeTab === "data" && (
                  <div className="space-y-4">
                    {/* View mode toggle controls */}
                    <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-white/[0.06]">
                      <div className="flex items-center bg-[#0d0d0d] border border-white/10 p-1 rounded-xl">
                        <button
                          onClick={() => setDataViewMode("cleaned")}
                          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            dataViewMode === "cleaned"
                              ? "bg-[#00F0FF] text-black shadow-[0_0_12px_rgba(0,240,255,0.35)]"
                              : "text-gray-400 hover:text-white"
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Cleaned Data ({cleanedCsvData ? cleanedCsvData.totalRows.toLocaleString() : "—"} rows)
                        </button>
                        <button
                          onClick={() => setDataViewMode("raw")}
                          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            dataViewMode === "raw"
                              ? "bg-amber-400 text-black shadow-[0_0_12px_rgba(251,191,36,0.35)]"
                              : "text-gray-400 hover:text-white"
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Original Raw Data ({rawCsvData ? rawCsvData.totalRows.toLocaleString() : "—"} rows)
                        </button>
                      </div>

                      <div className="text-xs font-mono text-gray-500">
                        {dataViewMode === "cleaned" ? (
                          <span className="text-emerald-400/90 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Showing transformed output with strict Pandera types
                          </span>
                        ) : (
                          <span className="text-amber-400/90 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            Viewing original uncleaned raw dataset as uploaded
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Active table view */}
                    {dataViewMode === "cleaned" ? (
                      cleanedCsvData ? (
                        <>
                          {cleanedCsvData.totalRows > 200 && (
                            <p className="text-xs font-mono text-cyan-400/70">
                              Previewing first 200 of {cleanedCsvData.totalRows.toLocaleString()} rows. Use "Download Cleaned CSV" for full output.
                            </p>
                          )}
                          <ExcelTable data={cleanedCsvData.rows} headers={cleanedCsvData.headers} />
                        </>
                      ) : (
                        <p className="text-xs font-mono text-gray-600 text-center py-12">No cleaned data available.</p>
                      )
                    ) : (
                      rawCsvData ? (
                        <>
                          {rawCsvData.totalRows > 200 && (
                            <p className="text-xs font-mono text-amber-400/70">
                              Previewing first 200 of {rawCsvData.totalRows.toLocaleString()} raw rows. Contains missing values, formatting anomalies, and untrimmed strings.
                            </p>
                          )}
                          <ExcelTable data={rawCsvData.rows} headers={rawCsvData.headers} />
                        </>
                      ) : (
                        <p className="text-xs font-mono text-gray-600 text-center py-12">Original raw CSV not available.</p>
                      )
                    )}
                  </div>
                )}

                {/* ── TAB 2: AI RECIPE & PYTHON CODE ───────────────────────── */}
                {activeTab === "recipe" && (
                  <div className="space-y-6">
                    {/* Header with quick stats */}
                    <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] flex-wrap gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-[#00F0FF]" />
                          <h4 className="text-sm font-semibold text-white">Autonomous Cleaning Plan & Generated Code</h4>
                        </div>
                        <p className="text-xs font-mono text-gray-400">
                          {planActions.length} proposed actions • Check the audit to see which actions were applied or deferred
                        </p>
                      </div>

                      {cleaningCode && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleCopyCode}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-mono rounded-lg border border-white/10 transition-colors"
                          >
                            {copiedCode ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiedCode ? "Copied" : "Copy Python Code"}
                          </button>
                          <button
                            onClick={handleDownloadScript}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20 text-[#00F0FF] text-xs font-mono rounded-lg border border-[#00F0FF]/30 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download .py
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Step-by-step Transformation Plan Actions */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="text-[10px] font-mono text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Filter className="w-3 h-3 text-[#00F0FF]" />
                          Executed Transformation Actions ({filteredActions.length})
                        </h5>

                        <div className="flex gap-1 text-[10px] font-mono">
                          {(["ALL", "high", "medium", "low"] as const).map((lvl) => (
                            <button
                              key={lvl}
                              onClick={() => setRecipeFilter(lvl)}
                              className={`px-2 py-0.5 rounded transition-colors ${
                                recipeFilter === lvl
                                  ? "bg-[#00F0FF] text-black font-semibold"
                                  : "text-gray-500 hover:text-gray-300 bg-white/5"
                              }`}
                            >
                              {lvl.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>

                      {filteredActions.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                          {filteredActions.map((act: any, idx: number) => (
                            <div
                              key={idx}
                              className="bg-[#050505] border border-white/[0.07] hover:border-white/[0.15] rounded-xl p-3 text-xs space-y-1.5 transition-colors"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono font-semibold text-white flex items-center gap-1.5 truncate">
                                  <ChevronRight className="w-3.5 h-3.5 text-[#00F0FF] flex-shrink-0" />
                                  <span className="text-[#00F0FF]">{act.action_type}</span>
                                  {act.column ? (
                                    <span className="text-gray-400 font-normal">on <strong className="text-gray-200">{act.column}</strong></span>
                                  ) : (
                                    <span className="text-gray-500 font-normal">(global dataset)</span>
                                  )}
                                </span>
                                <span
                                  className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-mono ${
                                    act.confidence === "high"
                                      ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                      : act.confidence === "medium"
                                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                      : "bg-red-500/10 text-red-400 border border-red-500/20"
                                  }`}
                                >
                                  {act.confidence}
                                </span>
                              </div>
                              <p className="text-gray-400 text-[11px] leading-relaxed pl-5">
                                {act.explanation}
                              </p>
                              {act.assumption && (
                                <p className="text-amber-400/80 italic text-[10px] pl-5">
                                  Assumption: {act.assumption}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs font-mono text-gray-500 py-4 text-center">No actions matching filter.</p>
                      )}
                    </div>

                    {/* Generated Python Code block */}
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between">
                        <h5 className="text-[10px] font-mono text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Code2 className="w-3.5 h-3.5 text-[#00F0FF]" />
                          Generated Python Code (`clean_data(df)`)
                        </h5>
                        <span className="text-[10px] font-mono text-gray-500">
                          Deterministic Pandas Script
                        </span>
                      </div>

                      {cleaningCode ? (
                        <div className="relative rounded-xl border border-white/[0.1] bg-[#050505] overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2 bg-[#0c0c0c] border-b border-white/[0.06] text-xs font-mono text-gray-400">
                            <span className="text-cyan-400">clean_{job.filename.replace(/\.csv$/, "")}.py</span>
                            <span className="text-gray-500 text-[10px]">Python 3.10+ (pandas, numpy)</span>
                          </div>
                          <pre className="p-4 font-mono text-xs text-gray-300 overflow-x-auto max-h-96 leading-relaxed selection:bg-[#00F0FF]/30">
                            {cleaningCode}
                          </pre>
                        </div>
                      ) : (
                        <div className="p-8 text-center bg-[#050505] border border-white/[0.06] rounded-xl">
                          <Code2 className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                          <p className="text-xs font-mono text-gray-500">Python script is compiling or unavailable.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── TAB 3: INSIGHTS & QUALITY REPORT ─────────────────────── */}
                {activeTab === "insights" && (
                  <div className="space-y-3">
                    {insights ? (
                      <>
                        <p className="text-xs font-mono text-gray-500 mb-4 px-1">
                          Verifiable metrics from the 7-layer validation engine and Pandera contract suite.
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
                          No insights available for this dataset.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── TAB 4: GREAT EXPECTATIONS SUITE ──────────────────────── */}
                {activeTab === "expectations" && (
                  <div className="space-y-4">
                    {gxSuite ? (
                      <div>
                        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] flex-wrap gap-2">
                          <div>
                            <h4 className="text-sm font-semibold text-white">
                              Great Expectations (GX) Export Suite
                            </h4>
                            <p className="text-xs font-mono text-gray-400">
                              Suite Name: <span className="text-[#00F0FF]">{gxSuite.expectation_suite_name}</span> • {gxSuite.expectations?.length || 0} assertions
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleCopyGxSuite}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-mono rounded-lg border border-white/10 transition-colors"
                            >
                              {copiedGxSuite ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                              {copiedGxSuite ? "Copied" : "Copy Suite JSON"}
                            </button>
                            <button
                              onClick={handleDownloadGxSuite}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20 text-[#00F0FF] text-xs font-mono rounded-lg border border-[#00F0FF]/30 transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Download JSON
                            </button>
                          </div>
                        </div>

                        {/* Expectations list */}
                        <div className="mt-4 space-y-2">
                          <h5 className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">
                            Generated Assertions ({gxSuite.expectations?.length || 0})
                          </h5>
                          <div className="bg-[#050505] border border-white/[0.07] rounded-xl overflow-x-auto max-h-60 divide-y divide-white/[0.03]">
                            {gxSuite.expectations?.map((exp, idx) => (
                              <div key={idx} className="p-2.5 flex items-center justify-between text-xs font-mono">
                                <span className="text-cyan-400">{exp.expectation_type}</span>
                                <span className="text-gray-400 text-[11px] truncate max-w-md">
                                  {JSON.stringify(exp.kwargs)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Full JSON code block */}
                        <div className="mt-4">
                          <h5 className="text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-2">
                            Raw Expectation Suite Definition
                          </h5>
                          <pre className="bg-[#050505] border border-white/10 rounded-xl p-4 font-mono text-[11px] text-gray-300 overflow-x-auto max-h-80">
                            {JSON.stringify(gxSuite, null, 2)}
                          </pre>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <FileJson className="w-8 h-8 text-gray-700" />
                        <p className="text-sm font-mono text-gray-500">No Great Expectations suite exported yet.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── TAB 5: ENGINEERING REPORT (.MD) ───────────────────────── */}
                {activeTab === "report" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] flex-wrap gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-emerald-400" />
                          <h4 className="text-sm font-semibold text-white">Engineering Quality & Audit Report (.md)</h4>
                        </div>
                        <p className="text-xs font-mono text-gray-400">
                          Complete Markdown audit generated by ReporterAgent • Saved to outputs/report_{job.filename.replace(/\.csv$/, ".md")}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleCopyReport}
                          disabled={!reportMarkdown}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-mono rounded-lg border border-white/10 transition-colors disabled:opacity-50"
                        >
                          {copiedReport ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedReport ? "Copied" : "Copy Markdown"}
                        </button>
                        <button
                          onClick={handleDownloadReport}
                          disabled={!reportMarkdown || isDownloadingReport}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-mono rounded-lg border border-emerald-500/30 transition-colors disabled:opacity-50"
                        >
                          {isDownloadingReport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                          Download .md
                        </button>
                      </div>
                    </div>

                    {reportMarkdown ? (
                      <div className="bg-[#050505] border border-white/10 rounded-xl p-5 font-mono text-[11px] text-gray-300 leading-relaxed overflow-x-auto max-h-[600px] whitespace-pre-wrap select-text">
                        {reportMarkdown}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <FileText className="w-8 h-8 text-gray-700" />
                        <p className="text-sm font-mono text-gray-500">Generating report or report not available yet.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── TAB 6: PIPELINE LOGS & LANGSMITH TRACES ───────────────── */}
                {activeTab === "logs" && (
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <p role={traceError ? "alert" : undefined} className="text-xs font-mono text-amber-400">
                        {traceError || (traces.some((trace) => trace.status === "pending")
                          ? "Some trace completion updates have not yet arrived. Refreshing automatically."
                          : "")}
                      </p>
                      <button type="button" onClick={() => setTraceRefresh((value) => value + 1)}
                        className="text-xs font-mono text-gray-400 hover:text-white flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" /> Refresh
                      </button>
                    </div>
                    {traces.length > 0 ? (
                      <>
                        <div className="flex items-center justify-between mb-3 px-1 flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-[#00F0FF] animate-pulse" />
                            <p className="text-xs font-mono text-[#00F0FF]/90">
                              Agent Execution Traces — {traces.length} trace events captured
                            </p>
                          </div>
                          <span className="text-[10px] font-mono text-gray-500">
                            Endpoint: https://api.smith.langchain.com • ID: agentic-data-preprocessing-pipeline • Env: production
                          </span>
                        </div>
                        <div className="h-[400px]">
                          <InteractiveLogsTable logs={logs} />
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <ScrollText className="w-8 h-8 text-gray-700" />
                        <p className="text-sm font-mono text-gray-500">No LangSmith traces available yet. Refreshing may take a few seconds.</p>
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
