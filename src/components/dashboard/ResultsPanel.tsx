"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Download, Table2, ScrollText, BarChart3,
  Rows3, ShieldCheck, Loader2, AlertCircle,
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

interface CleaningAction {
  action_type?: string;
  column?: string | null;
  confidence?: string;
  explanation?: string;
  assumption?: string | null;
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
      className="flex-1 min-w-[140px] bg-white border border-[#e2e8e2] rounded-xl p-4 flex flex-col gap-1.5 shadow-sm"
    >
      <div className="text-gray-500">{icon}</div>
      <div className="text-lg font-mono font-bold text-[#557966]">{value}</div>
      <div className="text-xs font-semibold text-gray-700">{label}</div>
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
  const [activeTab, setActiveTab] = useState<Tab>("report");
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
    const resetTimer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
    }, 0);

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
    return () => window.clearTimeout(resetTimer);
  }, [job.id, job.status]);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const terminal = job.status === "COMPLETED" || job.status === "FAILED";
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
    const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "default_secret_key";
    const resetTimer = window.setTimeout(() => {
      setTraces([]);
      setTraceError(null);
    }, 0);

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
      clearTimeout(resetTimer);
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
  const planActions: CleaningAction[] = Array.isArray(planData?.actions) ? planData.actions : [];
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
      id: "report",
      label: "Run report",
      icon: <FileText className="w-3.5 h-3.5" />,
    },
    {
      id: "data",
      label: "Data preview",
      icon: <Table2 className="w-3.5 h-3.5" />,
      badge: cleanedCsvData ? `${cleanedCsvData.totalRows.toLocaleString()} rows` : undefined,
    },
    {
      id: "recipe",
      label: "Transformations",
      icon: <Code2 className="w-3.5 h-3.5" />,
      badge: planActions.length > 0 ? `${planActions.length} actions` : undefined,
    },
    {
      id: "insights",
      label: "Quality checks",
      icon: <BarChart3 className="w-3.5 h-3.5" />,
    },
    {
      id: "expectations",
      label: `Great Expectations ${gxSuite ? `(${gxSuite.expectations?.length || 0})` : ""}`,
      icon: <FileJson className="w-3.5 h-3.5" />,
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
  const dqImp = vr?.score_improvement !== undefined ? `${vr.score_improvement >= 0 ? "+" : ""}${vr.score_improvement.toFixed(1)} pts` : "—";

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
    : planActions.filter((action) => action.confidence?.toLowerCase() === recipeFilter);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="w-full max-w-6xl mt-3 text-[#26332b]"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e2e8e2] bg-white px-5 py-4 shadow-sm sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {onReset && (
            <button onClick={onReset} title="Process another dataset" className="grid size-9 shrink-0 place-items-center rounded-lg border border-[#e2e8e2] text-[#607064] transition hover:bg-[#f4f7f3]">
              <ArrowLeft className="size-4" />
            </button>
          )}
          <div className={`grid size-9 shrink-0 place-items-center rounded-lg ${hasReviewItems ? "bg-amber-50 text-amber-700" : isFailed ? "bg-red-50 text-red-700" : "bg-[#edf4ee] text-[#557966]"}`}>
            {hasReviewItems ? <AlertTriangle className="size-4" /> : isFailed ? <AlertCircle className="size-4" /> : <CheckCircle2 className="size-4" />}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#839087]">{hasReviewItems ? "Review recommended" : isFailed ? "Run stopped" : "Run complete"}</p>
            <h1 className="mt-0.5 truncate text-sm font-semibold text-[#29362d] sm:text-base">{job.filename}</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setActiveTab("report")} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#dce5dc] bg-white px-3 text-xs font-medium text-[#4e6453] transition hover:bg-[#f7faf6]">
            <FileText className="size-3.5" /> View report
          </button>
          <button onClick={handleDownloadReport} disabled={!reportMarkdown || isDownloadingReport} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#294436] px-3.5 text-xs font-semibold text-white transition hover:bg-[#20392c] disabled:opacity-40">
            {isDownloadingReport ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            Download report
          </button>
          <button onClick={handleDownloadCsv} disabled={isDownloading || !canDownloadCandidate} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#dce5dc] bg-white px-3 text-xs font-medium text-[#4e6453] transition hover:bg-[#f7faf6] disabled:opacity-40">
            {isDownloading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {passedVerification ? "Verified CSV" : "Review candidate"}
          </button>
        </div>
      </div>

      {/* ── Executive Audit / Circuit Breaker Banner ─────────────────────── */}
      {hasReviewItems ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3.5"
        >
          <AlertTriangle className="w-5 h-5 text-amber-700 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-amber-900">
              Autonomous Safety Protocol Active: Human Review Recommended
            </h4>
            <p className="text-xs text-amber-900/80 leading-relaxed font-sans">
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
          className="mb-5 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3.5"
        >
          <AlertCircle className="w-5 h-5 text-red-700 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-red-900">
              Execution Halted
            </h4>
            <p className="text-xs text-red-900/80 leading-relaxed font-sans">
              {job.error_message || "This output has not passed the current integrity checks. Review the report or run the dataset again."}
            </p>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between flex-wrap gap-2"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-emerald-900">
                Integrity and Validation Checks Passed
              </h4>
              <p className="text-xs text-emerald-800/80">
                Output matches the supported cleaning plan and passed the implemented validation checks.
              </p>
            </div>
          </div>
          <span className="text-xs font-medium px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
            Integrity verified
          </span>
        </motion.div>
      )}

      {/* ── Executive Stat Cards ─────────────────────────────────────────── */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Scale className="w-4 h-4 text-[#557966]" />}
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
          icon={<Rows3 className="w-4 h-4 text-[#557966]" />}
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
          label="Repair retries"
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

      <div className="grid gap-4 lg:grid-cols-[218px_minmax(0,1fr)]">
        <aside aria-label="Run sections" className="h-fit rounded-2xl border border-[#e2e8e2] bg-white p-3 shadow-sm lg:sticky lg:top-6">
          <p className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#929b93]">Run sections</p>
          <nav className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-1" aria-label="Run details">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-current={activeTab === tab.id ? "page" : undefined}
                className={`flex min-w-0 items-center gap-2.5 rounded-lg border px-2.5 py-2.5 text-left text-xs font-medium transition ${
                  activeTab === tab.id
                    ? "border-[#dce7dd] bg-[#edf4ee] text-[#3c5e45]"
                    : "border-transparent text-[#748076] hover:border-[#e7ece6] hover:bg-[#f8faf7] hover:text-[#38483c]"
                }`}
              >
                <span className="shrink-0">{tab.icon}</span>
                <span className="min-w-0 flex-1 truncate">{tab.label}</span>
                {tab.badge && <span className="shrink-0 text-[10px] text-[#8b968d]">{tab.badge}</span>}
              </button>
            ))}
          </nav>
          {job.user_instructions && (
            <div className="mt-3 border-t border-[#edf0ec] px-2 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#98a198]">Verified rule</p>
              <p className="mt-1 line-clamp-3 text-[11px] leading-5 text-[#66736a]">{job.user_instructions}</p>
            </div>
          )}
        </aside>

        <section className="min-w-0 overflow-hidden rounded-2xl border border-[#e2e8e2] bg-white shadow-[0_12px_40px_rgba(37,60,50,0.05)]">
          <div className="flex min-h-[76px] flex-wrap items-center justify-between gap-3 border-b border-[#e9ede8] px-5 py-4 sm:px-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#90a095]">{job.filename}</p>
              <h2 className="mt-1 text-base font-semibold tracking-[-0.025em] text-[#29362d]">{tabs.find((tab) => tab.id === activeTab)?.label}</h2>
            </div>
            {activeTab === "report" && reportMarkdown && (
              <button onClick={handleDownloadReport} disabled={isDownloadingReport} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#294436] px-3.5 text-xs font-semibold text-white transition hover:bg-[#20392c] disabled:opacity-40">
                {isDownloadingReport ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                Download report
              </button>
            )}
          </div>
          {/* Tab Content Area */}
        <div className="p-5 min-h-[350px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-56 gap-3">
              <Loader2 className="w-6 h-6 text-[#557966] animate-spin" />
              <span className="text-sm font-mono text-gray-600">Loading dataset and insights...</span>
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
                    <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-[#e8ece7]">
                      <div className="flex items-center bg-[#f3f6f2] border border-[#e2e8e2] p-1 rounded-xl">
                        <button
                          onClick={() => setDataViewMode("cleaned")}
                          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            dataViewMode === "cleaned"
                              ? "bg-[#557966] text-white shadow-sm"
                              : "text-gray-600 hover:text-[#26332b]"
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Cleaned Data ({cleanedCsvData ? cleanedCsvData.totalRows.toLocaleString() : "—"} rows)
                        </button>
                        <button
                          onClick={() => setDataViewMode("raw")}
                          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            dataViewMode === "raw"
                              ? "bg-amber-100 text-amber-900 ring-1 ring-amber-200"
                              : "text-gray-600 hover:text-[#26332b]"
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Original Raw Data ({rawCsvData ? rawCsvData.totalRows.toLocaleString() : "—"} rows)
                        </button>
                      </div>

                      <div className="text-xs font-mono text-gray-500">
                        {dataViewMode === "cleaned" ? (
                          <span className="text-emerald-800 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            Showing transformed output with strict Pandera types
                          </span>
                        ) : (
                          <span className="text-amber-800 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
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
                            <p className="text-xs font-mono text-[#557966]/70">
                              Previewing first 200 of {cleanedCsvData.totalRows.toLocaleString()} rows. Use &quot;Download Cleaned CSV&quot; for full output.
                            </p>
                          )}
                          <ExcelTable data={cleanedCsvData.rows} headers={cleanedCsvData.headers} />
                        </>
                      ) : (
                        <p className="text-xs font-mono text-gray-500 text-center py-12">No cleaned data available.</p>
                      )
                    ) : (
                      rawCsvData ? (
                        <>
                          {rawCsvData.totalRows > 200 && (
                            <p className="text-xs font-mono text-amber-800">
                              Previewing first 200 of {rawCsvData.totalRows.toLocaleString()} raw rows. Contains missing values, formatting anomalies, and untrimmed strings.
                            </p>
                          )}
                          <ExcelTable data={rawCsvData.rows} headers={rawCsvData.headers} />
                        </>
                      ) : (
                        <p className="text-xs font-mono text-gray-500 text-center py-12">Original raw CSV not available.</p>
                      )
                    )}
                  </div>
                )}

                {/* ── TAB 2: AI RECIPE & PYTHON CODE ───────────────────────── */}
                {activeTab === "recipe" && (
                  <div className="space-y-6">
                    {/* Header with quick stats */}
                    <div className="flex items-center justify-between pb-3 border-b border-[#e2e8e2] flex-wrap gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-[#557966]" />
                          <h4 className="text-sm font-semibold text-[#26332b]">Autonomous Cleaning Plan & Generated Code</h4>
                        </div>
                        <p className="text-xs font-mono text-gray-600">
                          {planActions.length} proposed actions • Check the audit to see which actions were applied or deferred
                        </p>
                      </div>

                      {cleaningCode && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleCopyCode}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f4f7f3] hover:bg-[#edf2ed] text-gray-700 hover:text-[#26332b] text-xs font-mono rounded-lg border border-[#e2e8e2] transition-colors"
                          >
                            {copiedCode ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiedCode ? "Copied" : "Copy Python Code"}
                          </button>
                          <button
                            onClick={handleDownloadScript}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#edf4ee] hover:bg-[#e7f0e8] text-[#557966] text-xs font-mono rounded-lg border border-[#dce7dd] transition-colors"
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
                        <h5 className="text-[10px] font-mono text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                          <Filter className="w-3 h-3 text-[#557966]" />
                          Executed Transformation Actions ({filteredActions.length})
                        </h5>

                        <div className="flex gap-1 text-[10px] font-mono">
                          {(["ALL", "high", "medium", "low"] as const).map((lvl) => (
                            <button
                              key={lvl}
                              onClick={() => setRecipeFilter(lvl)}
                              className={`px-2 py-0.5 rounded transition-colors ${
                                recipeFilter === lvl
                                  ? "bg-[#557966] text-white font-semibold"
                                  : "text-gray-500 hover:text-gray-700 bg-[#f4f7f3]"
                              }`}
                            >
                              {lvl.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>

                      {filteredActions.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                          {filteredActions.map((act, idx: number) => (
                            <div
                              key={idx}
                              className="bg-[#f8faf7] border border-[#e5eae4] hover:border-[#dce4dc] rounded-xl p-3 text-xs space-y-1.5 transition-colors"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono font-semibold text-[#26332b] flex items-center gap-1.5 truncate">
                                  <ChevronRight className="w-3.5 h-3.5 text-[#557966] flex-shrink-0" />
                                  <span className="text-[#557966]">{act.action_type}</span>
                                  {act.column ? (
                                    <span className="text-gray-600 font-normal">on <strong className="text-gray-800">{act.column}</strong></span>
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
                              <p className="text-gray-600 text-[11px] leading-relaxed pl-5">
                                {act.explanation}
                              </p>
                              {act.assumption && (
                                <p className="text-amber-800 italic text-[10px] pl-5">
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
                        <h5 className="text-[10px] font-mono text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                          <Code2 className="w-3.5 h-3.5 text-[#557966]" />
                          Generated Python Code (`clean_data(df)`)
                        </h5>
                        <span className="text-[10px] font-mono text-gray-500">
                          Deterministic Pandas Script
                        </span>
                      </div>

                      {cleaningCode ? (
                        <div className="relative rounded-xl border border-[#e1e8e1] bg-[#f8faf7] overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2 bg-[#f1f4f0] border-b border-[#e8ece7] text-xs font-mono text-gray-600">
                            <span className="text-[#557966]">clean_{job.filename.replace(/\.csv$/, "")}.py</span>
                            <span className="text-gray-500 text-[10px]">Python 3.10+ (pandas, numpy)</span>
                          </div>
                          <pre className="p-4 font-mono text-xs text-gray-700 overflow-x-auto max-h-96 leading-relaxed selection:bg-[#dce9de]">
                            {cleaningCode}
                          </pre>
                        </div>
                      ) : (
                        <div className="p-8 text-center bg-[#f8faf7] border border-[#e8ece7] rounded-xl">
                          <Code2 className="w-8 h-8 text-gray-500 mx-auto mb-2" />
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
                            <AlertCircle className="w-8 h-8 text-amber-700/70" />
                            <p className="text-sm font-mono text-gray-500">
                              Legacy report detected — no rich validation data available.
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <AlertCircle className="w-8 h-8 text-amber-700/70" />
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
                        <div className="flex items-center justify-between pb-3 border-b border-[#e2e8e2] flex-wrap gap-2">
                          <div>
                            <h4 className="text-sm font-semibold text-[#26332b]">
                              Great Expectations (GX) Export Suite
                            </h4>
                            <p className="text-xs font-mono text-gray-600">
                              Suite Name: <span className="text-[#557966]">{gxSuite.expectation_suite_name}</span> • {gxSuite.expectations?.length || 0} assertions
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleCopyGxSuite}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f4f7f3] hover:bg-[#edf2ed] text-gray-700 hover:text-[#26332b] text-xs font-mono rounded-lg border border-[#e2e8e2] transition-colors"
                            >
                              {copiedGxSuite ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                              {copiedGxSuite ? "Copied" : "Copy Suite JSON"}
                            </button>
                            <button
                              onClick={handleDownloadGxSuite}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#edf4ee] hover:bg-[#e7f0e8] text-[#557966] text-xs font-mono rounded-lg border border-[#dce7dd] transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Download JSON
                            </button>
                          </div>
                        </div>

                        {/* Expectations list */}
                        <div className="mt-4 space-y-2">
                          <h5 className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">
                            Generated Assertions ({gxSuite.expectations?.length || 0})
                          </h5>
                          <div className="bg-[#f8faf7] border border-[#e5eae4] rounded-xl overflow-x-auto max-h-60 divide-y divide-[#edf0ec]">
                            {gxSuite.expectations?.map((exp, idx) => (
                              <div key={idx} className="p-2.5 flex items-center justify-between text-xs font-mono">
                                <span className="text-[#557966]">{exp.expectation_type}</span>
                                <span className="text-gray-600 text-[11px] truncate max-w-md">
                                  {JSON.stringify(exp.kwargs)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Full JSON code block */}
                        <div className="mt-4">
                          <h5 className="text-[10px] font-mono text-gray-600 uppercase tracking-wider mb-2">
                            Raw Expectation Suite Definition
                          </h5>
                          <pre className="bg-[#f8faf7] border border-[#e2e8e2] rounded-xl p-4 font-mono text-[11px] text-gray-700 overflow-x-auto max-h-80">
                            {JSON.stringify(gxSuite, null, 2)}
                          </pre>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <FileJson className="w-8 h-8 text-gray-500" />
                        <p className="text-sm font-mono text-gray-500">No Great Expectations suite exported yet.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── TAB 5: ENGINEERING REPORT (.MD) ───────────────────────── */}
                {activeTab === "report" && (
                  <section className="space-y-5">
                    <div className="flex flex-col gap-4 rounded-xl border border-[#dfe8df] bg-[#f4f8f3] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                      <div className="flex items-start gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#52735b] shadow-sm ring-1 ring-[#e2e9e1]">
                          <FileText className="size-5" />
                        </span>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6f8573]">Run report</p>
                          <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[#26332b]">Quality & transformation audit</h2>
                          <p className="mt-1 text-xs text-[#7c877e]">{job.filename} · Read the results here or save a Markdown copy.</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                        <button
                          onClick={handleCopyReport}
                          disabled={!reportMarkdown}
                          className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#dce4dc] bg-white px-3 text-xs font-medium text-[#58665b] transition hover:bg-[#f9fbf8] disabled:opacity-40"
                        >
                          {copiedReport ? <Check className="size-3.5 text-[#557966]" /> : <Copy className="size-3.5" />}
                          {copiedReport ? "Copied" : "Copy report"}
                        </button>
                        <button
                          onClick={handleDownloadReport}
                          disabled={!reportMarkdown || isDownloadingReport}
                          className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#294436] px-3.5 text-xs font-semibold text-white transition hover:bg-[#20392c] disabled:opacity-40"
                        >
                          {isDownloadingReport ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                          Download report
                        </button>
                      </div>
                    </div>

                    {reportMarkdown ? (
                      <MarkdownReport source={reportMarkdown} />
                    ) : (
                      <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[#dce3dc] bg-[#fbfcfa] px-6 text-center">
                        <span className="grid size-11 place-items-center rounded-full bg-[#edf3ee] text-[#66806d]"><FileText className="size-5" /></span>
                        <div>
                          <p className="text-sm font-semibold text-[#435047]">Report is not available</p>
                          <p className="mt-1 max-w-sm text-xs leading-5 text-[#8a948b]">The run may not have produced a report artifact. You can still review the quality checks and data preview in the tabs above.</p>
                        </div>
                      </div>
                    )}
                  </section>
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
                        className="text-xs font-mono text-gray-600 hover:text-[#26332b] flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" /> Refresh
                      </button>
                    </div>
                    {traces.length > 0 ? (
                      <>
                        <div className="flex items-center justify-between mb-3 px-1 flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-[#557966] animate-pulse" />
                            <p className="text-xs font-mono text-[#557966]">
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
                        <ScrollText className="w-8 h-8 text-gray-500" />
                        <p className="text-sm font-mono text-gray-500">No LangSmith traces available yet. Refreshing may take a few seconds.</p>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
        </section>
      </div>
    </motion.div>
  );
}

function MarkdownReport({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let index = 0;

  const isTableDivider = (line: string) => /^\s*\|?\s*:?-{3,}/.test(line) && line.includes("|");
  const isBlockStart = (line: string) =>
    /^\s*(#{1,6}\s|```|---+$|[-*+]\s|\d+\.\s|>\s|\|)/.test(line);

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    if (line.startsWith("```") ) {
      const language = line.slice(3).trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push(
        <div key={`code-${index}`} className="overflow-hidden rounded-xl border border-[#e3e8e2] bg-[#f7f9f6]">
          {language && <div className="border-b border-[#e3e8e2] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7a887d]">{language}</div>}
          <pre className="max-h-[420px] overflow-auto p-4 text-xs leading-6 text-[#47534a]"><code>{code.join("\n")}</code></pre>
        </div>
      );
      continue;
    }

    if (/^---+$/.test(line)) {
      blocks.push(<hr key={`rule-${index++}`} className="my-2 border-[#e8ece7]" />);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const depth = heading[1].length;
      const title = inlineMarkdown(heading[2], `heading-${index}`);
      blocks.push(depth === 1
        ? <h1 key={`h-${index}`} className="pb-3 text-2xl font-semibold tracking-[-0.045em] text-[#26332b]">{title}</h1>
        : depth === 2
          ? <h2 key={`h-${index}`} className="border-t border-[#e8ece7] pt-6 text-lg font-semibold tracking-[-0.025em] text-[#34453a]">{title}</h2>
          : <h3 key={`h-${index}`} className="pt-2 text-sm font-semibold text-[#435348]">{title}</h3>);
      index += 1;
      continue;
    }

    if (line.startsWith("|") && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
      const tableRows = [line];
      index += 2;
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        tableRows.push(lines[index].trim());
        index += 1;
      }
      const cells = tableRows.map((row) => row.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()));
      blocks.push(
        <div key={`table-${index}`} className="overflow-x-auto rounded-xl border border-[#e3e8e2]">
          <table className="min-w-full divide-y divide-[#e8ece7] text-left text-xs">
            <thead className="bg-[#f5f8f4] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#77847a]">
              <tr>{cells[0].map((cell, cellIndex) => <th key={cellIndex} className="px-3 py-2.5">{inlineMarkdown(cell, `th-${index}-${cellIndex}`)}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-[#edf0ec] bg-white text-[#566159]">
              {cells.slice(1).map((row, rowIndex) => (
                <tr key={rowIndex} className="align-top hover:bg-[#fafbf9]">
                  {cells[0].map((_, cellIndex) => <td key={cellIndex} className="max-w-[420px] px-3 py-2.5 leading-5">{inlineMarkdown(row[cellIndex] || "", `td-${index}-${rowIndex}-${cellIndex}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (/^[-*+]\s/.test(line) || /^\d+\.\s/.test(line)) {
      const ordered = /^\d+\.\s/.test(line);
      const items: string[] = [];
      while (index < lines.length && (/^\s*[-*+]\s/.test(lines[index]) || /^\s*\d+\.\s/.test(lines[index]))) {
        items.push(lines[index].replace(/^\s*(?:[-*+]\s|\d+\.\s)/, ""));
        index += 1;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(<List key={`list-${index}`} className={`space-y-1.5 pl-5 text-sm leading-6 text-[#59665c] ${ordered ? "list-decimal" : "list-disc"}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{inlineMarkdown(item, `li-${index}-${itemIndex}`)}</li>)}</List>);
      continue;
    }

    if (line.startsWith(">")) {
      blocks.push(<blockquote key={`quote-${index++}`} className="border-l-2 border-[#90a995] pl-4 text-sm italic leading-6 text-[#67766a]">{inlineMarkdown(line.replace(/^>\s?/, ""), `quote-${index}`)}</blockquote>);
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index].trim())) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(<p key={`p-${index}`} className="text-sm leading-7 text-[#5c685f]">{inlineMarkdown(paragraph.join(" "), `p-${index}`)}</p>);
  }

  return <article className="mx-auto max-w-4xl space-y-5 rounded-xl border border-[#e7ebe6] bg-white px-5 py-6 sm:px-9 sm:py-9">{blocks}</article>;
}

function inlineMarkdown(text: string, keyPrefix: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={`${keyPrefix}-${index}`} className="font-semibold text-[#3c4b40]">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={`${keyPrefix}-${index}`} className="rounded bg-[#edf3ee] px-1.5 py-0.5 text-[0.9em] text-[#4f7059]">{part.slice(1, -1)}</code>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={`${keyPrefix}-${index}`}>{part.slice(1, -1)}</em>;
    return <span key={`${keyPrefix}-${index}`}>{part}</span>;
  });
}
