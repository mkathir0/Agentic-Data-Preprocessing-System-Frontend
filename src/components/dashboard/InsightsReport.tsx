import React from "react";
import { motion } from "framer-motion";
import { ShieldAlert, TrendingDown, ArrowRight, ShieldCheck, HelpCircle, FileSearch, Code2 } from "lucide-react";

export interface InsightsData {
  job_id: string;
  filename: string;
  profiler_data: any;
  plan_data: any;
  validation_report: any;
  retry_count: number;
}

export function InsightsReport({ data }: { data: InsightsData }) {
  if (!data.validation_report) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <ShieldAlert className="w-8 h-8 text-amber-400/60" />
        <p className="text-sm font-mono text-gray-500">
          No rich validation report available. Run a new job.
        </p>
      </div>
    );
  }

  const vr = data.validation_report;
  const plan = data.plan_data || {};
  const actions = plan.actions || [];
  
  return (
    <div className="space-y-6">
      {/* 1. Profiling & Assumptions */}
      <section className="bg-black border border-white/[0.07] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-[#00F0FF]">
          <FileSearch className="w-4 h-4" />
          <h3 className="text-sm font-semibold">1. Data Profiling & Assumptions</h3>
        </div>
        <p className="text-xs text-gray-400">
          {plan.dataset_summary || "No summary available."}
        </p>
        {plan.global_assumptions && plan.global_assumptions.length > 0 && (
          <div className="bg-white/[0.03] p-3 rounded-lg border border-white/[0.05]">
            <h4 className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-2">Global Assumptions</h4>
            <ul className="list-disc list-inside text-xs text-gray-400 space-y-1">
              {plan.global_assumptions.map((ass: string, i: number) => (
                <li key={i}>{ass}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* 2. Pipeline Plan */}
      <section className="bg-black border border-white/[0.07] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-purple-400">
            <Code2 className="w-4 h-4" />
            <h3 className="text-sm font-semibold">2. Cleaning Plan & Logic</h3>
          </div>
          <span className="text-[10px] font-mono bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded border border-purple-500/20">
            {data.retry_count} Retries
          </span>
        </div>
        <div className="space-y-2">
          {actions.map((act: any, i: number) => (
            <div key={i} className="flex flex-col gap-1 text-xs p-2 bg-white/[0.02] rounded border border-white/[0.02]">
              <div className="flex items-center justify-between">
                <span className="text-gray-300 font-semibold">{act.action_type} <span className="font-mono text-[10px] text-gray-500">{act.column ? `on ${act.column}` : "(global)"}</span></span>
                <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded ${act.confidence === "high" ? "bg-green-500/10 text-green-400" : act.confidence === "medium" ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"}`}>
                  {act.confidence} confidence
                </span>
              </div>
              <p className="text-gray-400">{act.explanation}</p>
              {act.assumption && (
                <div className="flex gap-1.5 items-start mt-1 text-amber-400/80">
                  <HelpCircle className="w-3 h-3 mt-0.5" />
                  <span className="italic">{act.assumption}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 3. Stats Diff Table */}
      {vr.stats_diff && vr.stats_diff.length > 0 && (
        <section className="bg-black border border-white/[0.07] rounded-xl p-5 space-y-4 overflow-x-auto">
          <div className="flex items-center gap-2 text-blue-400">
            <TrendingDown className="w-4 h-4" />
            <h3 className="text-sm font-semibold">3. Statistical Distribution Changes</h3>
          </div>
          <table className="w-full text-xs text-left whitespace-nowrap">
            <thead>
              <tr className="border-b border-white/[0.07] text-gray-500 font-mono">
                <th className="pb-2 font-medium">Column</th>
                <th className="pb-2 font-medium text-center">Nulls (Before → After)</th>
                <th className="pb-2 font-medium text-center">Mean (Before → After)</th>
                <th className="pb-2 font-medium text-center">Imputed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {vr.stats_diff.map((diff: any, i: number) => (
                <tr key={i} className="text-gray-300">
                  <td className="py-2 font-mono text-[11px]">{diff.column}</td>
                  <td className="py-2 text-center">
                    {Math.round(diff.before.null_pct * 100)}% <ArrowRight className="inline w-3 h-3 mx-1 text-gray-600" /> {Math.round(diff.after.null_pct * 100)}%
                  </td>
                  <td className="py-2 text-center font-mono text-[10px]">
                    {diff.before.mean?.toFixed(2) ?? "-"} <ArrowRight className="inline w-3 h-3 mx-1 text-gray-600" /> {diff.after.mean?.toFixed(2) ?? "-"}
                  </td>
                  <td className="py-2 text-center text-amber-400/80">
                    {diff.imputation_pct > 0 ? `${(diff.imputation_pct * 100).toFixed(1)}%` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 4. Validation & Escalations */}
      <section className="bg-black border border-white/[0.07] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-400">
            <ShieldCheck className="w-4 h-4" />
            <h3 className="text-sm font-semibold">4. 7-Layer Validation Summary</h3>
          </div>
          <span className="text-xs font-mono text-gray-500">
            {vr.total_passed} / {vr.total_checks} Checks Passed
          </span>
        </div>
        
        {vr.escalation_flags && vr.escalation_flags.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-[10px] font-mono text-red-400 uppercase tracking-wider mb-1">Action Required</h4>
            {vr.escalation_flags.map((flag: any, i: number) => (
              <div key={i} className={`flex gap-3 text-xs p-3 rounded-lg border ${flag.severity === "high" ? "bg-red-500/10 border-red-500/20 text-red-200" : "bg-amber-500/10 border-amber-500/20 text-amber-200"}`}>
                <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold">{flag.severity.toUpperCase()} SEVERITY {flag.column ? `on ${flag.column}` : ""}</div>
                  <div className="opacity-80 mt-0.5">{flag.reason}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-center gap-2 text-green-400 text-sm font-mono">
            <ShieldCheck className="w-4 h-4" /> All checks passed successfully. No escalations.
          </div>
        )}
      </section>
    </div>
  );
}
