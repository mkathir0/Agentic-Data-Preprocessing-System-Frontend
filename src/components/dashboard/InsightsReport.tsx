"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  ShieldAlert,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  HelpCircle,
  FileSearch,
  Code2,
  CheckCircle2,
  Layers,
  FileJson,
  Download,
  Copy,
  Check,
  Scale,
  RefreshCw,
  AlertTriangle
} from "lucide-react";
import { downloadJsonBlob, type InsightsData, type ValidationCheck } from "@/lib/api";

type PlannedAction = {
  action_type?: string;
  column?: string | null;
  confidence?: string;
  explanation?: string;
  assumption?: string | null;
};

type PlanData = {
  actions?: PlannedAction[];
  dataset_summary?: string;
  global_assumptions?: string[];
};

export type { InsightsData };

export function InsightsReport({ data }: { data: InsightsData }) {
  const [copiedGx, setCopiedGx] = useState(false);
  const [showGxJson, setShowGxJson] = useState(false);
  const [visibleCheckCount, setVisibleCheckCount] = useState(20);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [visibleFlagCount, setVisibleFlagCount] = useState(10);

  if (!data.validation_report) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <ShieldAlert className="w-8 h-8 text-amber-700/70" />
        <p className="text-sm font-mono text-gray-500">
          No rich validation report available. Run a new job.
        </p>
      </div>
    );
  }

  const vr = data.validation_report;
  const plan = (data.plan_data || {}) as PlanData;
  const actions = plan.actions || [];

  const dqBefore = vr.data_quality_score_before ?? undefined;
  const dqAfter = vr.data_quality_score_after ?? undefined;
  const dqImprovement = vr.score_improvement ?? (
    dqBefore !== undefined && dqAfter !== undefined
      ? +(dqAfter - dqBefore).toFixed(1)
      : undefined
  );

  const compScore = vr.completeness_score ?? undefined;
  const valScore = vr.validity_score ?? undefined;
  const uniqScore = vr.uniqueness_score ?? undefined;
  const consScore = vr.consistency_score ?? undefined;

  const handleCopyGx = () => {
    if (!vr.great_expectations_suite) return;
    navigator.clipboard.writeText(JSON.stringify(vr.great_expectations_suite, null, 2));
    setCopiedGx(true);
    setTimeout(() => setCopiedGx(false), 2000);
  };

  const handleDownloadGx = () => {
    if (!vr.great_expectations_suite) return;
    downloadJsonBlob(vr.great_expectations_suite, `${data.filename.replace(/\.[^/.]+$/, "")}_gx_suite.json`);
  };

  const allChecks = [
    ...(vr.schema_checks || []),
    ...(vr.range_checks || []),
    ...(vr.cross_field_checks || []),
    ...(vr.distributional_checks || []),
    ...(vr.duplicate_checks || []),
    ...(vr.format_checks || []),
    ...(vr.regression_checks || [])
  ];
  const failedChecks = allChecks.filter((check) => !check.passed);

  const categoryNames: Record<string, string> = {
    schema: "Schema & Datatypes",
    range_bounds: "Range & Bounds",
    cross_field: "Cross-Field & Invariants",
    distributional: "Distribution Shifts",
    duplicates: "Duplicates & Keys",
    format: "Format Compliance",
    regression: "Null Regressions"
  };

  const categoryCounts = failedChecks.reduce<Record<string, number>>((acc, check) => {
    const cat = check.category || "other";
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const filteredFailedChecks = selectedCategory === "ALL"
    ? failedChecks
    : failedChecks.filter((check) => check.category === selectedCategory);

  const displayedChecks = filteredFailedChecks.slice(0, visibleCheckCount);
  const displayedFlags = (vr.escalation_flags || []).slice(0, visibleFlagCount);

  return (
    <div className="space-y-6">
      {/* ── Executive 4-Dimensional Data Quality Scorecard ── */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-[#f5f8f4] via-white to-[#edf4ee] border border-[#dce7dd]/30 rounded-2xl p-6 shadow-sm space-y-6"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#e2e8e2]">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[#557966]">
              <Scale className="w-5 h-5 text-[#557966]" />
              <h2 className="text-base font-bold tracking-wide uppercase text-[#26332b] font-mono">
                Executive Data Quality Scorecard
              </h2>
            </div>
            <p className="text-xs text-gray-600">
              Computed mathematically across Completeness, Validity, Uniqueness, and Consistency.
            </p>
          </div>

          {/* Hero Score Badge */}
          <div className="flex items-center gap-3 bg-[#f8faf7] border border-[#e2e8e2] px-4 py-2.5 rounded-xl">
            <div className="text-right">
              <div className="text-[10px] font-mono text-gray-600 uppercase">Baseline → prepared</div>
              <div className="text-sm font-mono text-gray-600">
                <span className="text-gray-500 mr-1.5">{dqBefore !== undefined ? dqBefore.toFixed(1) : "—"}</span>
                <ArrowRight className="inline w-3 h-3 text-gray-500 mx-1.5" />
                <span className="text-2xl font-bold font-mono text-[#557966] mr-1">{dqAfter !== undefined ? dqAfter.toFixed(1) : "—"}</span>
                <span className="text-xs text-gray-600">/ 100</span>
              </div>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg text-emerald-400 font-mono text-xs font-bold flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              {dqImprovement !== undefined ? `${dqImprovement > 0 ? "+" : ""}${dqImprovement.toFixed(1)} pts` : "Not reported"}
            </div>
          </div>
        </div>

        {/* 4 Pillars Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Completeness */}
          <div className="bg-[#f5f7f4] border border-[#e8ece7] rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-700 font-medium">1. Completeness</span>
              <span className="font-mono font-bold text-[#557966]">{compScore !== undefined ? `${compScore.toFixed(1)}%` : "—"}</span>
            </div>
            <div className="w-full bg-[#f4f7f3] h-1.5 rounded-full overflow-hidden mb-2">
              <div className="bg-[#557966] h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, compScore ?? 0)}%` }} />
            </div>
            <span className="text-[10px] text-gray-500 leading-tight">Missing-value coverage in the prepared data</span>
          </div>

          {/* Validity */}
          <div className="bg-[#f5f7f4] border border-[#e8ece7] rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-700 font-medium">2. Validity</span>
              <span className="font-mono font-bold text-emerald-400">{valScore !== undefined ? `${valScore.toFixed(1)}%` : "—"}</span>
            </div>
            <div className="w-full bg-[#f4f7f3] h-1.5 rounded-full overflow-hidden mb-2">
              <div className="bg-emerald-400 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, valScore ?? 0)}%` }} />
            </div>
            <span className="text-[10px] text-gray-500 leading-tight">Pandera contracts & boundary enforcement</span>
          </div>

          {/* Uniqueness */}
          <div className="bg-[#f5f7f4] border border-[#e8ece7] rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-700 font-medium">3. Uniqueness</span>
              <span className="font-mono font-bold text-[#557966]">{uniqScore !== undefined ? `${uniqScore.toFixed(1)}%` : "—"}</span>
            </div>
            <div className="w-full bg-[#f4f7f3] h-1.5 rounded-full overflow-hidden mb-2">
              <div className="bg-[#557966] h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, uniqScore ?? 0)}%` }} />
            </div>
            <span className="text-[10px] text-gray-500 leading-tight">Exact deduplication & PK conflict resolution</span>
          </div>

          {/* Consistency */}
          <div className="bg-[#f5f7f4] border border-[#e8ece7] rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-700 font-medium">4. Consistency</span>
              <span className="font-mono font-bold text-amber-400">{consScore !== undefined ? `${consScore.toFixed(1)}%` : "—"}</span>
            </div>
            <div className="w-full bg-[#f4f7f3] h-1.5 rounded-full overflow-hidden mb-2">
              <div className="bg-amber-400 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, consScore ?? 0)}%` }} />
            </div>
            <span className="text-[10px] text-gray-500 leading-tight">Temporal order & arithmetic invariant checks</span>
          </div>
        </div>
      </motion.section>

      {/* ── Pandera Schema Contract & Circuit Breaker Section ── */}
      <motion.section
        whileHover={{ scale: 1.005, y: -1 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="bg-white border border-[#e5eae4] rounded-xl p-5 space-y-4"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <h3 className="text-sm font-semibold">Pandera Lazy Schema Contract Verification</h3>
          </div>
          <div className="flex items-center gap-2">
            {vr.pandera_schema_passed ? (
              <span className="text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Schema Contract Verified
              </span>
            ) : (
              <span className="text-[11px] font-mono bg-red-500/10 text-red-400 border border-red-500/30 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Contract Violations Detected
              </span>
            )}
            {data.retry_count > 0 && (
              <span className="text-[11px] font-mono bg-[#edf4ee] text-[#557966] border border-[#dce7dd]/30 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3" /> Retry attempts: {data.retry_count}
              </span>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-600 leading-relaxed">
          The validation engine converts inferred types into an explicit Pandera <code className="text-[#557966] bg-[#f4f7f3] px-1 py-0.5 rounded text-[10px]">DataFrameSchema(lazy=True)</code> contract. In-memory validation scans all columns in a single vectorized pass and feeds failure cases back to the LLM self-healing circuit breaker.
        </p>

        {vr.pandera_failure_cases && vr.pandera_failure_cases.length > 0 ? (
          <div className="space-y-2 mt-3">
            <h4 className="text-[10px] font-mono text-amber-400 uppercase tracking-wider">
              Recorded Failure Cases ({vr.pandera_failure_count ?? vr.pandera_failure_cases.length} violations)
            </h4>
            <div className="bg-[#fafbf9] border border-[#e9ede8] rounded-lg overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-[#e9ede8] text-gray-500 font-mono text-[10px]">
                    <th className="p-2.5">Target Column</th>
                    <th className="p-2.5">Constraint Checked</th>
                    <th className="p-2.5">Failure Example</th>
                    <th className="p-2.5 text-center">Violations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0ec] font-mono text-[11px]">
                  {vr.pandera_failure_cases.map((fc, i) => (
                    <tr key={i} className="text-gray-700">
                      <td className="p-2.5 text-[#557966] font-semibold">{fc.column}</td>
                      <td className="p-2.5 text-gray-600">{fc.check}</td>
                      <td className="p-2.5 text-amber-900 font-mono text-[10px]">{fc.failure_case}</td>
                      <td className="p-2.5 text-center text-red-400 font-bold">{fc.violation_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg flex items-center gap-2 text-emerald-400 text-xs font-mono">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            Zero schema violations detected. All columns conform to Pandera strict contracts.
          </div>
        )}
      </motion.section>

      {/* ── Deduplication, Key Conflicts & Fuzzy Matching ── */}
      <motion.section
        whileHover={{ scale: 1.005, y: -1 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="bg-white border border-[#e5eae4] rounded-xl p-5 space-y-4"
      >
        <div className="flex items-center gap-2 text-[#557966]">
          <Layers className="w-4 h-4" />
          <h3 className="text-sm font-semibold">Data Integrity: Deduplication & Key Conflicts</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-[#fafbf9] border border-[#e9ede8] p-3 rounded-lg">
            <div className="text-[10px] font-mono text-gray-500 uppercase">Exact Duplicates Removed</div>
            <div className="text-xl font-mono font-bold text-[#26332b] mt-1">
              {vr.exact_duplicates_removed ?? 0}
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5">Identical multi-column rows dropped</div>
          </div>

          <div className="bg-[#fafbf9] border border-[#e9ede8] p-3 rounded-lg">
            <div className="text-[10px] font-mono text-gray-500 uppercase">Fuzzy Duplicate Clusters</div>
            <div className="text-xl font-mono font-bold text-[#557966] mt-1">
              {vr.fuzzy_duplicate_clusters ?? 0}
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5">Near-match strings (Levenshtein token set ratio &gt;= 85%)</div>
          </div>

          <div className="bg-[#fafbf9] border border-[#e9ede8] p-3 rounded-lg">
            <div className="text-[10px] font-mono text-gray-500 uppercase">Primary Key Collisions</div>
            <div className="text-xl font-mono font-bold text-[#557966] mt-1">
              {vr.key_conflict_count ?? 0}
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5">Identical IDs with conflicting attributes flagged</div>
          </div>
        </div>
      </motion.section>

      {/* ── Great Expectations Interoperability Suite ── */}
      {vr.great_expectations_suite && (
        <motion.section
          whileHover={{ scale: 1.005, y: -1 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="bg-white border border-[#e5eae4] rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-[#557966]">
              <FileJson className="w-4 h-4" />
              <h3 className="text-sm font-semibold">Great Expectations (GX) Interoperability Suite</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyGx}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f4f7f3] hover:bg-[#edf2ed] text-gray-700 hover:text-[#26332b] text-xs font-mono rounded-lg border border-[#e2e8e2] transition-colors"
              >
                {copiedGx ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedGx ? "Copied JSON" : "Copy Suite"}
              </button>
              <button
                onClick={handleDownloadGx}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#edf4ee] hover:bg-[#e7f0e8] text-[#557966] text-xs font-mono rounded-lg border border-[#dce7dd] transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download JSON
              </button>
              <button
                onClick={() => setShowGxJson(!showGxJson)}
                className="text-xs text-gray-600 hover:text-gray-800 underline font-mono ml-1"
              >
                {showGxJson ? "Hide Code" : "Inspect Expectations"}
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-600 leading-relaxed">
            The engine exports all verified Pandera contracts into an enterprise-standard Great Expectations suite JSON (<code className="text-[#26332b] text-[11px] font-mono">{vr.great_expectations_suite.expectations?.length ?? 0} expectations</code>) for immediate downstream integration with CI/CD data pipelines, dbt, or Airflow.
          </p>

          {showGxJson && (
            <motion.pre
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="bg-[#f8faf7] border border-[#e2e8e2] rounded-lg p-4 font-mono text-[11px] text-gray-700 overflow-x-auto max-h-72"
            >
              {JSON.stringify(vr.great_expectations_suite, null, 2)}
            </motion.pre>
          )}
        </motion.section>
      )}

      {/* ── 1. Data Profiling & Assumptions ── */}
      <motion.section
        whileHover={{ scale: 1.005, y: -1 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="bg-white border border-[#e5eae4] rounded-xl p-5 space-y-4"
      >
        <div className="flex items-center gap-2 text-[#557966]">
          <FileSearch className="w-4 h-4" />
          <h3 className="text-sm font-semibold">1. Data Profiling & Domain Assumptions</h3>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">
          {plan.dataset_summary || "Automated profiler inferred data types, null distributions, and domain bounds."}
        </p>
        {plan.global_assumptions && plan.global_assumptions.length > 0 && (
          <div className="bg-[#f8faf7] p-3 rounded-lg border border-[#e9ede8]">
            <h4 className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-2">Global Plan Invariants</h4>
            <ul className="list-disc list-inside text-xs text-gray-600 space-y-1">
              {plan.global_assumptions.map((ass: string, i: number) => (
                <li key={i}>{ass}</li>
              ))}
            </ul>
          </div>
        )}
      </motion.section>

      {/* ── 2. Cleaning Plan & Logic ── */}
      <motion.section
        whileHover={{ scale: 1.005, y: -1 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="bg-white border border-[#e5eae4] rounded-xl p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#557966]">
            <Code2 className="w-4 h-4" />
            <h3 className="text-sm font-semibold">2. Autonomous Cleaning Plan & Code Actions</h3>
          </div>
          <span className="text-[10px] font-mono bg-[#edf4ee] text-[#557966] px-2 py-0.5 rounded border border-[#dce7dd]/20">
            {actions.length} Planned Actions
          </span>
        </div>
        <div className="space-y-2">
          {actions.map((act, i: number) => (
            <div key={i} className="flex flex-col gap-1 text-xs p-2.5 bg-[#fafbf9] rounded-lg border border-[#edf0ec]">
              <div className="flex items-center justify-between">
                <span className="text-gray-800 font-semibold">
                  {act.action_type}{" "}
                  <span className="font-mono text-[10px] text-[#557966]">
                    {act.column ? `on ${act.column}` : "(global dataset operation)"}
                  </span>
                </span>
                <span
                  className={`text-[9px] uppercase px-1.5 py-0.5 rounded ${
                    act.confidence === "high"
                      ? "bg-green-500/10 text-green-400"
                      : act.confidence === "medium"
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {act.confidence} confidence
                </span>
              </div>
              <p className="text-gray-600">{act.explanation}</p>
              {act.assumption && (
                <div className="flex gap-1.5 items-start mt-1 text-amber-800">
                  <HelpCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span className="italic">{act.assumption}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </motion.section>

      {/* ── 3. Statistical Distribution Changes ── */}
      {vr.stats_diff && vr.stats_diff.length > 0 && (
        <motion.section
          whileHover={{ scale: 1.005, y: -1 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="bg-white border border-[#e5eae4] rounded-xl p-5 space-y-4 overflow-x-auto"
        >
          <div className="flex items-center gap-2 text-[#557966]">
            <TrendingUp className="w-4 h-4" />
            <h3 className="text-sm font-semibold">3. Statistical Distribution Changes & Imputation Audit</h3>
          </div>
          <table className="w-full text-xs text-left whitespace-nowrap">
            <thead>
              <tr className="border-b border-[#e5eae4] text-gray-500 font-mono text-[10px]">
                <th className="pb-2 font-medium">Column</th>
                <th className="pb-2 font-medium text-center">Nulls (Before → After)</th>
                <th className="pb-2 font-medium text-center">Mean (Before → After)</th>
                <th className="pb-2 font-medium text-center">Imputation Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0ec]">
              {vr.stats_diff.map((diff, i: number) => (
                <tr key={i} className="text-gray-700">
                  <td className="py-2.5 font-mono text-[11px] text-[#557966]">{diff.column}</td>
                  <td className="py-2.5 text-center font-mono">
                    {Math.round(diff.before.null_pct * 100)}%{" "}
                    <ArrowRight className="inline w-3 h-3 mx-1 text-gray-500" />{" "}
                    <span className="text-emerald-400 font-semibold">{Math.round(diff.after.null_pct * 100)}%</span>
                  </td>
                  <td className="py-2.5 text-center font-mono text-[10px]">
                    {diff.before.mean !== null ? diff.before.mean.toFixed(2) : "-"}{" "}
                    <ArrowRight className="inline w-3 h-3 mx-1 text-gray-500" />{" "}
                    {diff.after.mean !== null ? diff.after.mean.toFixed(2) : "-"}
                  </td>
                  <td className="py-2.5 text-center font-mono text-[11px]">
                    {diff.imputation_pct > 0 ? (
                      <span className={diff.imputation_pct > 0.2 ? "text-amber-400 font-semibold" : "text-gray-600"}>
                        {(diff.imputation_pct * 100).toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-gray-500">0.0%</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.section>
      )}

      {/* ── 4. 7-Layer Validation Summary & Escalations ── */}
      <motion.section
        whileHover={{ scale: 1.005, y: -1 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="bg-white border border-[#e5eae4] rounded-xl p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-400">
            <ShieldCheck className="w-4 h-4" />
            <h3 className="text-sm font-semibold">4. 7-Layer Validation Engine Results</h3>
          </div>
          <span className="text-xs font-mono text-gray-600">
            <strong className="text-emerald-400">{vr.total_passed}</strong> / {vr.total_checks} Checks Passed
          </span>
        </div>

        {/* Escalation Triggers */}
        {vr.escalation_flags && vr.escalation_flags.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-mono text-red-400 uppercase tracking-wider">
                Escalation Circuit Breaker Triggers ({vr.escalation_flags.length})
              </h4>
              {vr.escalation_flags.length > 5 && (
                <button
                  onClick={() => setVisibleFlagCount(prev => prev >= vr.escalation_flags.length ? 5 : vr.escalation_flags.length)}
                  className="text-[11px] font-mono text-red-400 hover:text-red-300 underline"
                >
                  {visibleFlagCount >= vr.escalation_flags.length ? "Collapse triggers" : `Show all ${vr.escalation_flags.length}`}
                </button>
              )}
            </div>
            {displayedFlags.map((flag, i: number) => (
              <div
                key={i}
                className={`flex gap-3 text-xs p-3 rounded-lg border ${
                  flag.severity === "high"
                    ? "bg-red-500/10 border-red-500/20 text-red-200"
                    : "bg-amber-500/10 border-amber-500/20 text-amber-200"
                }`}
              >
                <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold font-mono text-[11px] flex items-center justify-between">
                    <span>{flag.severity.toUpperCase()} PRIORITY ESCALATION</span>
                    {flag.column && (
                      <span className="text-[10px] bg-red-500/20 px-2 py-0.5 rounded text-red-300 font-mono">
                        {flag.column}
                      </span>
                    )}
                  </div>
                  <div className="opacity-90 mt-1 text-xs leading-relaxed">{flag.reason}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Failed Rules & Violations (Grouped & Paginated in batches of 20) */}
        {failedChecks.length > 0 ? (
          <div className="space-y-3 mt-5 pt-4 border-t border-[#e8ece7]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="text-[10px] font-mono text-red-400 uppercase tracking-wider">
                Failed Rules & Violations ({failedChecks.length} Total)
              </h4>
              <span className="text-[11px] font-mono text-gray-600">
                Showing {displayedChecks.length} of {filteredFailedChecks.length}
              </span>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1.5 py-1">
              <button
                onClick={() => { setSelectedCategory("ALL"); setVisibleCheckCount(20); }}
                className={`px-2.5 py-1 rounded-full text-[11px] font-mono transition-colors ${
                  selectedCategory === "ALL"
                    ? "bg-[#557966] text-white font-semibold"
                    : "bg-[#f4f7f3] text-gray-600 hover:bg-[#edf2ed]"
                }`}
              >
                All ({failedChecks.length})
              </button>
              {Object.entries(categoryCounts).map(([cat, count]) => (
                <button
                  key={cat}
                  onClick={() => { setSelectedCategory(cat); setVisibleCheckCount(20); }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-mono transition-colors ${
                    selectedCategory === cat
                      ? "bg-[#557966] text-white font-semibold"
                      : "bg-[#f4f7f3] text-gray-600 hover:bg-[#edf2ed]"
                  }`}
                >
                  {categoryNames[cat] || cat} ({count})
                </button>
              ))}
            </div>

            {/* Cards List in 20 Batches */}
            <div className="space-y-2">
              {displayedChecks.map((check: ValidationCheck, i: number) => (
                <div
                  key={i}
                  className="flex gap-3 text-xs p-3 rounded-lg border bg-red-500/5 border-red-500/20 text-red-200"
                >
                  <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-semibold text-xs text-[#26332b]">
                        {check.name}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#f4f7f3] border border-[#e2e8e2] text-gray-700">
                        {categoryNames[check.category] || check.category}
                      </span>
                    </div>
                    <div className="opacity-80 mt-1 text-xs">{check.details}</div>
                    {check.violations > 0 && (
                      <div className="text-red-800 mt-1.5 font-mono text-[10px]">
                        {check.violations.toLocaleString()} violations detected
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination / Reveal in 20 Batches Controls */}
            <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
              <span className="text-xs font-mono text-gray-500">
                Showing {displayedChecks.length} of {filteredFailedChecks.length} checks
              </span>
              <div className="flex items-center gap-2">
                {filteredFailedChecks.length > visibleCheckCount && (
                  <>
                    <button
                      onClick={() => setVisibleCheckCount(prev => prev + 20)}
                      className="px-3 py-1.5 bg-[#edf4ee] hover:bg-[#e7f0e8] text-[#557966] text-xs font-mono font-medium rounded-lg border border-[#dce7dd] transition-colors"
                    >
                      Reveal Next 20 Errors (+20)
                    </button>
                    <button
                      onClick={() => setVisibleCheckCount(filteredFailedChecks.length)}
                      className="px-3 py-1.5 bg-[#f4f7f3] hover:bg-[#edf2ed] text-gray-700 text-xs font-mono rounded-lg border border-[#e2e8e2] transition-colors"
                    >
                      Show All ({filteredFailedChecks.length})
                    </button>
                  </>
                )}
                {visibleCheckCount > 20 && (
                  <button
                    onClick={() => setVisibleCheckCount(20)}
                    className="px-3 py-1.5 bg-[#f4f7f3] hover:bg-[#edf2ed] text-gray-600 hover:text-[#26332b] text-xs font-mono rounded-lg border border-[#e2e8e2] transition-colors"
                  >
                    Collapse to 20
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : !vr.escalation_flags || vr.escalation_flags.length === 0 ? (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-center gap-2 text-green-400 text-sm font-mono mt-4">
            <ShieldCheck className="w-4 h-4" /> All 7-layer validation checks passed. Zero escalations required.
          </div>
        ) : null}
      </motion.section>
    </div>
  );
}
