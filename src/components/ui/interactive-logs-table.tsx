"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Filter, Search } from "lucide-react";
import { useMemo, useState } from "react";

export type LogLevel = "info" | "warning" | "error";

export interface PipelineLog {
  id: string;
  timestamp: string;
  level: LogLevel;
  agent: string;
  message: string;
  duration?: string;
  tags?: string[];
}

type Filters = {
  level: string[];
  agent: string[];
};

const levelStyles: Record<LogLevel, string> = {
  info: "bg-[#00F0FF]/10 text-[#00F0FF]",
  warning: "bg-amber-500/10 text-amber-400",
  error: "bg-red-500/10 text-red-400",
};

function LogRow({ log, expanded, onToggle }: { log: PipelineLog; expanded: boolean; onToggle: () => void }) {
  const formattedTime = new Date(log.timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  return (
    <>
      <motion.button
        onClick={onToggle}
        className="w-full p-3 text-left transition-colors hover:bg-white/[0.03] active:bg-white/5"
      >
        <div className="flex items-center gap-3">
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }} className="flex-shrink-0">
            <ChevronDown className="h-3.5 w-3.5 text-gray-600" />
          </motion.div>

          <span className={`flex-shrink-0 text-xs font-mono px-2 py-0.5 rounded-md capitalize ${levelStyles[log.level]}`}>
            {log.level}
          </span>

          <time className="w-20 flex-shrink-0 font-mono text-xs text-gray-600">{formattedTime}</time>

          <span className="flex-shrink-0 min-w-max text-xs font-mono font-semibold text-[#00F0FF]/70">
            {log.agent}
          </span>

          <p className="flex-1 truncate text-xs text-gray-400">{log.message}</p>

          {log.duration && (
            <span className="flex-shrink-0 font-mono text-xs text-gray-600">{log.duration}</span>
          )}
        </div>
      </motion.button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/5 bg-white/[0.02]"
          >
            <div className="space-y-3 p-4">
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-gray-600">Message</p>
                <p className="rounded-lg bg-black/40 border border-white/5 p-3 font-mono text-xs text-gray-300">{log.message}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                {log.duration && (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-gray-600">Duration</p>
                    <p className="font-mono text-[#00F0FF]">{log.duration}</p>
                  </div>
                )}
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-gray-600">Timestamp</p>
                  <p className="font-mono text-gray-400">{log.timestamp}</p>
                </div>
              </div>
              {log.tags && log.tags.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-600">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {log.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 text-xs font-mono border border-white/10 rounded-md text-gray-500">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function FilterPanel({ filters, onChange, logs }: { filters: Filters; onChange: (f: Filters) => void; logs: PipelineLog[] }) {
  const levels = Array.from(new Set(logs.map(l => l.level)));
  const agents = Array.from(new Set(logs.map(l => l.agent)));

  const toggle = (cat: keyof Filters, val: string) => {
    const cur = filters[cat];
    onChange({ ...filters, [cat]: cur.includes(val) ? cur.filter(e => e !== val) : [...cur, val] });
  };

  const hasActive = filters.level.length + filters.agent.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex h-full flex-col space-y-5 overflow-y-auto bg-black/60 border-r border-white/5 p-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Filters</h3>
        {hasActive && (
          <button onClick={() => onChange({ level: [], agent: [] })} className="text-xs text-[#00F0FF] hover:underline">Clear</button>
        )}
      </div>

      {[{ label: "Level", cat: "level" as const, items: levels }, { label: "Agent", cat: "agent" as const, items: agents }].map(({ label, cat, items }) => (
        <div key={cat} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-600">{label}</p>
          <div className="space-y-1.5">
            {items.map(item => {
              const selected = filters[cat].includes(item);
              return (
                <motion.button
                  key={item}
                  type="button"
                  whileHover={{ x: 2 }}
                  onClick={() => toggle(cat, item)}
                  className={`flex w-full items-center justify-between gap-2 border rounded-lg px-3 py-1.5 text-xs font-mono transition-colors ${
                    selected ? "border-[#00F0FF]/40 bg-[#00F0FF]/10 text-[#00F0FF]" : "border-white/10 text-gray-500 hover:border-white/20"
                  }`}
                >
                  <span className="capitalize">{item}</span>
                  {selected && <Check className="h-3 w-3" />}
                </motion.button>
              );
            })}
          </div>
        </div>
      ))}
    </motion.div>
  );
}

interface InteractiveLogsTableProps {
  logs: PipelineLog[];
}

export function InteractiveLogsTable({ logs }: InteractiveLogsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({ level: [], agent: [] });

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const q = searchQuery.toLowerCase();
      const matchSearch = log.message.toLowerCase().includes(q) || log.agent.toLowerCase().includes(q);
      const matchLevel = filters.level.length === 0 || filters.level.includes(log.level);
      const matchAgent = filters.agent.length === 0 || filters.agent.includes(log.agent);
      return matchSearch && matchLevel && matchAgent;
    });
  }, [filters, searchQuery, logs]);

  const activeFilters = filters.level.length + filters.agent.length;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Search bar */}
      <div className="flex gap-2 mb-3 px-1">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-600" />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-9 pr-3 text-xs font-mono bg-white/5 border border-white/10 rounded-lg text-gray-300 placeholder-gray-600 outline-none focus:border-[#00F0FF]/40 transition-colors"
          />
        </div>
        <button
          onClick={() => setShowFilters(c => !c)}
          className={`relative flex items-center gap-1.5 px-3 h-8 text-xs rounded-lg border transition-colors ${
            showFilters ? "bg-[#00F0FF]/10 border-[#00F0FF]/40 text-[#00F0FF]" : "bg-white/5 border-white/10 text-gray-500 hover:text-gray-300"
          }`}
        >
          <Filter className="h-3.5 w-3.5" />
          {activeFilters > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#00F0FF] text-[10px] font-bold text-black">{activeFilters}</span>
          )}
        </button>
      </div>

      <p className="text-xs font-mono text-gray-600 px-1 mb-2">{filteredLogs.length} of {logs.length} events</p>

      {/* Log area */}
      <div className="flex flex-1 min-h-0 overflow-hidden rounded-xl border border-white/10">
        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.div
              key="filters"
              initial={{ width: 0, opacity: 0 }} animate={{ width: 200, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden flex-shrink-0"
            >
              <FilterPanel filters={filters} onChange={setFilters} logs={logs} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 overflow-y-auto divide-y divide-white/5">
          <AnimatePresence mode="popLayout">
            {filteredLogs.length > 0 ? filteredLogs.map((log, index) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.15, delay: index * 0.03 }}
              >
                <LogRow
                  log={log}
                  expanded={expandedId === log.id}
                  onToggle={() => setExpandedId(c => c === log.id ? null : log.id)}
                />
              </motion.div>
            )) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 text-center text-xs font-mono text-gray-600">
                No logs match your filters.
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
