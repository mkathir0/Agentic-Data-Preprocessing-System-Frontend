"use client"

import { motion, AnimatePresence } from "framer-motion"

export type JobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"

const PIPELINE_STAGES = [
  { key: "profile", label: "Profiling", sublabel: "node-01" },
  { key: "plan", label: "Planning", sublabel: "node-02" },
  { key: "codegen", label: "Code Gen", sublabel: "node-03" },
  { key: "execute", label: "Execute", sublabel: "node-04" },
  { key: "validate", label: "Validate", sublabel: "node-05" },
]

// Map job progress % to which stage is "active"
function getStageIndex(progress: number, status: JobStatus): number {
  if (status === "COMPLETED" || status === "FAILED") return 5 // all done
  if (progress < 20) return 0
  if (progress < 40) return 1
  if (progress < 60) return 2
  if (progress < 80) return 3
  return 4
}

function AnimatedDot({ path, duration, delay, size, opacity }: { path: string; duration: number; delay: number; size: number; opacity: number }) {
  return (
    <circle r={size} fill="#557966" opacity={opacity}>
      <animateMotion dur={`${duration}s`} repeatCount="indefinite" begin={`${delay}s`} path={path} />
    </circle>
  )
}

function PulsingDot({ cx, cy, color, duration, delay = 0 }: { cx: number; cy: number; color: string; duration: number; delay?: number }) {
  return (
    <motion.circle cx={cx} cy={cy} r={2.8} fill={color}
      animate={{ opacity: [0.15, 1, 0.15] }}
      transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
    />
  )
}

interface EnterpriseAIPipelineProps {
  status?: JobStatus
  progress?: number
  filename?: string
  currentStep?: string | null
}

export default function EnterpriseAIPipeline({ status = "PROCESSING", progress = 0, filename, currentStep }: EnterpriseAIPipelineProps) {
  const activeStage = getStageIndex(progress, status)
  const isCompleted = status === "COMPLETED"
  const isFailed = status === "FAILED"
  const isQueued = status === "PENDING"
  const isRunning = status === "PROCESSING"
  const isReviewFlagged = currentStep === "REVIEW_FLAGGED"

  const paths = {
    p1: "M116,88 L158,88",
    p2: "M268,88 L306,88",
    p3: "M411,88 C425,88 435,50 448,50",
    p4: "M411,88 L448,88",
    p5: "M411,88 C425,88 435,126 448,126",
  }

  // Derive the "current action" message from stage
  const stageMessages: Record<number, string> = {
    0: `Profiling "${filename ?? "dataset"}" — inferring schema, types, missing values...`,
    1: "Groq LLM generating transformation plan based on profiling anomaly report...",
    2: "LLM writing pandas cleaning script tailored to dataset issues...",
    3: "Executing cleaning code in isolated Python subprocess...",
    4: "Pandera verifying lazy schema contract, 4D quality score & 7-layer invariants...",
  }
  const completedMessage = isReviewFlagged
    ? "✓ Preprocessing complete. Cleaned CSV ready; domain edge cases flagged for review."
    : "✓ Pipeline complete. Cleaned CSV and report are ready."
  const failedMessage = "✗ Pipeline failed. Max retries exceeded. Check the report for details."

  const currentMessage = isReviewFlagged
    ? "Output preserved for review. Validation has not approved production use."
    : isQueued
    ? "Upload accepted and queued. If it stays here, start the backend worker: uv run python -m app.worker"
    : isFailed
    ? failedMessage
    : isCompleted
    ? completedMessage
    : (stageMessages[activeStage] ?? "Initializing pipeline...")

  // Node state colors
  const nodeColor = (nodeIndex: number) => {
    if (isFailed && nodeIndex === activeStage) return { fill: "#fbf1ee", stroke: "#ef4444" }
    if (nodeIndex < activeStage || isCompleted) return { fill: "#edf4ee", stroke: "#22c55e" }
    if (nodeIndex === activeStage && !isQueued) return { fill: "#f1f4f0", stroke: "#557966" }
    return { fill: "#f8faf7", stroke: "#e4e9e4" }
  }

  // Status dot color + pulsing
  const dotColor = (nodeIndex: number) => {
    if (isFailed && nodeIndex === activeStage) return "#ef4444"
    if (nodeIndex < activeStage || isCompleted) return "#22c55e"
    if (isQueued && nodeIndex === activeStage) return "#fbbf24"
    if (nodeIndex === activeStage) return "#557966"
    return "#dfe6df"
  }

  const dotPulsing = (nodeIndex: number) => isRunning && nodeIndex === activeStage

  return (
    <div className="bg-white border border-[#e2e8e2] rounded-[14px] overflow-hidden font-sans w-full max-w-[620px] mx-auto shadow-2xl">
      {/* Header */}
      <div className="px-[18px] py-[11px] border-b border-[#e8ece7] flex items-center justify-between">
        <div className="flex items-center gap-[7px]">
          <motion.span
            className={`w-[6px] h-[6px] rounded-full inline-block shadow-[0_0_8px] ${
              isReviewFlagged ? "bg-amber-400 shadow-amber-400/80" :
              isCompleted ? "bg-green-500 shadow-green-500/80" :
              isFailed ? "bg-red-500 shadow-red-500/80" :
              isQueued ? "bg-amber-400 shadow-amber-400/80" : "bg-[#557966] shadow-[#557966]/80"
            }`}
            animate={isRunning ? { opacity: [1, 0.2, 1] } : { opacity: 1 }}
            transition={{ duration: 2, repeat: isRunning ? Infinity : 0, ease: "easeInOut" }}
          />
          <span className="text-[10px] text-[#26332b]/50 tracking-[0.1em] font-mono font-medium">
            AGENT PIPELINE · {isReviewFlagged ? "REVIEW FLAGGED" : isCompleted ? "DONE" : isFailed ? "FAILED" : isQueued ? "QUEUED" : "LIVE"}
          </span>
        </div>
        <span className="text-[10px] text-[#26332b]/[0.28] font-mono">
          {isReviewFlagged ? "validation requires review" : isCompleted ? "5/5 nodes complete" : isFailed ? "pipeline halted" : isQueued ? "waiting for worker" : `${activeStage}/5 nodes · ${progress.toFixed(0)}%`}
        </span>
      </div>

      {/* SVG Pipeline */}
      <svg width="100%" viewBox="0 0 580 172" className="block">
        <defs>
          <marker id="ma" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M2 1.5L7.5 5L2 8.5" fill="none" stroke="rgba(85,121,102,0.7)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        </defs>

        {/* Connection paths */}
        <path d={paths.p1} fill="none" stroke="rgba(85,121,102,0.35)" strokeWidth="1.5" strokeDasharray="3 5" markerEnd="url(#ma)" />
        <path d={paths.p2} fill="none" stroke="rgba(85,121,102,0.35)" strokeWidth="1.5" strokeDasharray="3 5" markerEnd="url(#ma)" />
        <path d={paths.p3} fill="none" stroke="rgba(85,121,102,0.2)" strokeWidth="1.5" strokeDasharray="3 5" />
        <path d={paths.p4} fill="none" stroke="rgba(85,121,102,0.2)" strokeWidth="1.5" strokeDasharray="3 5" />
        <path d={paths.p5} fill="none" stroke="rgba(85,121,102,0.2)" strokeWidth="1.5" strokeDasharray="3 5" />

        {/* Animated dots on connections (only while running) */}
        {isRunning && <>
          <AnimatedDot path={paths.p1} duration={1.05} delay={0} size={2.5} opacity={1} />
          <AnimatedDot path={paths.p1} duration={1.05} delay={0.35} size={1.8} opacity={0.65} />
          <AnimatedDot path={paths.p2} duration={0.88} delay={0.18} size={2.5} opacity={1} />
          <AnimatedDot path={paths.p3} duration={1.3} delay={0.08} size={2.2} opacity={0.9} />
          <AnimatedDot path={paths.p4} duration={1.15} delay={0.28} size={2.2} opacity={0.9} />
          <AnimatedDot path={paths.p5} duration={1.4} delay={0.45} size={2.2} opacity={0.9} />
        </>}

        {/* Trigger Node (File Upload) */}
        <rect x="16" y="66" width="100" height="44" rx="8" fill={isCompleted ? "#edf4ee" : "#f8faf7"} stroke={isCompleted ? "#22c55e" : "#e4e9e4"} strokeWidth="0.5" />
        <text x="66" y="83" textAnchor="middle" fontSize="9.5" fill="#829087" fontFamily="monospace" letterSpacing=".07em">TRIGGER</text>
        <text x="66" y="100" textAnchor="middle" fontSize="12" fill="#35463a" fontFamily="inherit" fontWeight="500">File Upload</text>
        <text x="66" y="122" textAnchor="middle" fontSize="8.5" fill="#9aa49b" fontFamily="monospace">node-00</text>

        {/* Profiler + Quality Node */}
        {(() => { const c = nodeColor(0); return (
          <g>
            <rect x="158" y="66" width="110" height="44" rx="8" fill={c.fill} stroke={c.stroke} strokeWidth={activeStage === 0 && isRunning ? 1 : 0.5} />
            <text x="213" y="83" textAnchor="middle" fontSize="9.5" fill="#829087" fontFamily="monospace" letterSpacing=".07em">AGENT</text>
            <text x="213" y="100" textAnchor="middle" fontSize="12" fill="#35463a" fontFamily="inherit" fontWeight="500">Profiler</text>
            <circle cx={243} cy={76} r={3} fill={dotColor(0)} opacity={dotPulsing(0) ? undefined : 0.9}>
              {dotPulsing(0) && <animate attributeName="opacity" values="0.3;1;0.3" dur="1.9s" repeatCount="indefinite" />}
            </circle>
          </g>
        )})()}

        {/* LLM Agent Node (Planner + Codegen) */}
        {(() => { const stage = Math.min(activeStage, 2); const c = nodeColor(stage); return (
          <g>
            <rect x="306" y="53" width="105" height="70" rx="10" fill={c.fill} stroke={c.stroke} strokeWidth={isRunning && activeStage >= 1 && activeStage <= 2 ? 1 : 0.5} />
            <rect x="318" y="53.5" width="80" height="1" rx="0.5" fill={isCompleted ? "rgba(34,197,94,0.5)" : "rgba(85,121,102,0.5)"} />
            <text x="358" y="78" textAnchor="middle" fontSize="9.5" fill={isCompleted ? "rgba(34,197,94,0.8)" : "rgba(85,121,102,0.8)"} fontFamily="monospace" letterSpacing=".07em">LLM AGENT</text>
            <text x="358" y="97" textAnchor="middle" fontSize="13" fill="#26332b" fontFamily="inherit" fontWeight="600">
              {isCompleted ? "Done" : isFailed ? "Failed" : "Processing"}
            </text>
            {isRunning && activeStage >= 1 && activeStage <= 2 ? (
              <>
                <PulsingDot cx={346} cy={113} color="#557966" duration={1.2} delay={0} />
                <PulsingDot cx={358} cy={113} color="#557966" duration={1.2} delay={0.4} />
                <PulsingDot cx={370} cy={113} color="#557966" duration={1.2} delay={0.8} />
              </>
            ) : (
              <text x="358" y="117" textAnchor="middle" fontSize="9" fill={isCompleted ? "rgba(34,197,94,0.7)" : "#9aa49b"} fontFamily="monospace">
                {isCompleted ? "✓ complete" : "llama-3.3-70b"}
              </text>
            )}
            <text x="358" y="135" textAnchor="middle" fontSize="8.5" fill="rgba(85,121,102,0.55)" fontFamily="monospace">llama-3.3-70b</text>
          </g>
        )})()}

        {/* Output Nodes: Execute / Profile / Validate */}
        {(() => {
          const execC = nodeColor(3); const valC = nodeColor(4);
          return (
            <>
              <rect x="448" y="35" width="116" height="30" rx="7" fill={execC.fill} stroke={execC.stroke} strokeWidth="0.5" />
              <text x="490" y="53.5" textAnchor="middle" fontSize="11" fill="#4d5c51" fontFamily="inherit">Execute</text>
              <circle cx={550} cy={43} r={3} fill={dotColor(3)} opacity={dotPulsing(3) ? undefined : 0.9}>
                {dotPulsing(3) && <animate attributeName="opacity" values="0.3;1;0.3" dur="1.9s" repeatCount="indefinite" />}
              </circle>

              <rect x="448" y="73" width="116" height="30" rx="7" fill={isCompleted ? "#edf4ee" : "#f8faf7"} stroke={isCompleted ? "#22c55e" : "#e9ede8"} strokeWidth="0.5" />
              <text x="490" y="91.5" textAnchor="middle" fontSize="11" fill="#718076" fontFamily="inherit">Report</text>
              <circle cx={550} cy={81} r={3} fill={isCompleted ? "#22c55e" : "#e2e8e2"} opacity={0.9} />

              <rect x="448" y="111" width="116" height="30" rx="7" fill={valC.fill} stroke={valC.stroke} strokeWidth="0.5" />
              <text x="490" y="129.5" textAnchor="middle" fontSize="11" fill="#4d5c51" fontFamily="inherit">Validate</text>
              <circle cx={550} cy={119} r={3} fill={dotColor(4)} opacity={dotPulsing(4) ? undefined : 0.9}>
                {dotPulsing(4) && <animate attributeName="opacity" values="0.3;1;0.3" dur="2.2s" begin="0.35s" repeatCount="indefinite" />}
              </circle>
            </>
          )
        })()}
      </svg>

      {/* Live message strip */}
      <div className="border-t border-[#e8ece7] px-[18px] py-[9px] h-[52px]">
        <div className="flex gap-2 items-start h-full">
          <span className={`font-mono text-[13px] leading-[1.5] shrink-0 ${isCompleted ? "text-green-400/80" : isFailed ? "text-red-400/80" : "text-[#557966]/80"}`}>›</span>
          <div className="relative flex-1 overflow-hidden h-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentMessage}
                initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.25 }}
                className="font-mono text-[11px] text-[#26332b]/[0.6] leading-[1.55] absolute inset-0"
              >
                {currentMessage}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Stats Footer */}
      <div className="border-t border-[#e8ece7] px-[18px] py-[10px] flex gap-[22px] items-center bg-[#f4f7f3]">
        <div>
          <div className="text-[9px] text-[#26332b]/30 tracking-[0.09em] mb-[3px] font-semibold">STATUS</div>
          <div className={`text-[14px] font-mono font-medium ${isReviewFlagged || isQueued ? "text-amber-400" : isCompleted ? "text-green-400" : isFailed ? "text-red-400" : "text-[#557966]"}`}>
            {isReviewFlagged ? "⚠ REVIEW" : isCompleted ? "✓ DONE" : isFailed ? "✗ FAILED" : isQueued ? "QUEUED" : "LIVE"}
          </div>
        </div>
        <div>
          <div className="text-[9px] text-[#26332b]/30 tracking-[0.09em] mb-[3px] font-semibold">PROGRESS</div>
          <div className="text-[14px] text-[#26332b]/[0.85] font-mono font-medium">{isCompleted ? "100%" : isQueued ? "Waiting" : `${progress.toFixed(0)}%`}</div>
        </div>
        <div>
          <div className="text-[9px] text-[#26332b]/30 tracking-[0.09em] mb-[3px] font-semibold">STAGE</div>
          <div className="text-[14px] text-[#26332b]/[0.85] font-mono font-medium">{isCompleted ? "Report" : isQueued ? "Queue" : PIPELINE_STAGES[Math.min(activeStage, 4)]?.label ?? "Init"}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[9px] text-[#26332b]/[0.25] tracking-[0.09em] mb-[3px] font-semibold">STACK</div>
          <div className="text-[10px] text-[#557966]/80 font-mono font-medium">Groq Llama 3.3 · LangGraph</div>
        </div>
      </div>
    </div>
  )
}
