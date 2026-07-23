"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Database, FileCode2 } from "lucide-react";
import EnterpriseAIPipeline from "@/components/ui/ai-agent-pipeline";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import { GradientDots } from "@/components/ui/gradient-dots";
import { SpecialText } from "@/components/ui/special-text";
import { uploadDataset, getJobStatus, Job } from "@/lib/api";
import { ResultsPanel } from "@/components/dashboard/ResultsPanel";

export default function Home() {
  const [hasStarted, setHasStarted] = useState(false);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!activeJob || !isPolling) return;
    const pollInterval = setInterval(async () => {
      try {
        const job = await getJobStatus(activeJob.id);
        setActiveJob(job);
        if (job.status === "COMPLETED" || job.status === "FAILED") {
          setIsPolling(false);
        }
      } catch (e) { console.error("Polling error:", e); }
    }, 3000);
    return () => clearInterval(pollInterval);
  }, [activeJob, isPolling]);

  const handleSend = async (_message: string, files?: File[]) => {
    if (!files || files.length === 0) {
      alert("Please upload a CSV dataset to process.");
      return;
    }
    try {
      setHasStarted(true);
      setIsUploading(true);
      const job = await uploadDataset(files[0]);
      setActiveJob(job);
      setIsUploading(false);
      setIsPolling(true);
    } catch (error) {
      console.error("Failed to upload:", error);
      alert("Upload failed. Make sure the backend is running.");
      setHasStarted(false);
      setIsUploading(false);
    }
  };

  const isCompleted = activeJob?.status === "COMPLETED";
  const isFailed = activeJob?.status === "FAILED";

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#000000] text-gray-100 overflow-x-hidden">

      <GradientDots
        duration={30} spacing={20} dotSize={6}
        className="fixed inset-0 pointer-events-none opacity-20 mix-blend-screen z-0"
      />

      <main className="flex-1 flex flex-col items-center px-6 relative z-10 w-full">

        <AnimatePresence mode="wait">
          {!hasStarted ? (
            /* ── Landing: vertically + horizontally centred ─────────────────── */
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center justify-center w-full max-w-3xl min-h-screen -mt-8"
            >
              <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-white mb-6 text-center leading-tight">
                <motion.span
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", bounce: 0.6, duration: 0.8 }}
                  className="inline-block"
                >
                  Your Data Pipelines,
                </motion.span>
                <br />
                <motion.span
                  whileHover={{ scale: 1.05, rotate: -1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-[#00F0FF] to-[#0080FF] drop-shadow-[0_0_15px_rgba(0,240,255,0.3)] cursor-default"
                >
                  <SpecialText triggerOnHover speed={20} className="font-sans font-semibold">
                    Built Autonomously.
                  </SpecialText>
                </motion.span>
              </h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-lg text-gray-400 text-center mb-12 max-w-xl leading-relaxed"
              >
                Upload your raw datasets and provide natural language instructions.
                Specialized LLM agents will profile, plan, clean, and validate autonomously.
              </motion.p>

              <div className="w-full max-w-2xl">
                <PromptInputBox onSend={handleSend} isLoading={isUploading} />
              </div>

              <div className="mt-12 flex items-center gap-6 text-xs font-mono text-gray-600 uppercase tracking-widest">
                <div className="flex items-center gap-2"><Database className="w-3.5 h-3.5" /> Pandera</div>
                <span className="w-1 h-1 rounded-full bg-gray-800" />
                <div className="flex items-center gap-2"><FileCode2 className="w-3.5 h-3.5" /> Pandas</div>
                <span className="w-1 h-1 rounded-full bg-gray-800" />
                <div className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5" /> Llama 3.3 70B</div>
              </div>
            </motion.div>

          ) : (
            /* ── Pipeline View ──────────────────────────────────────────────── */
            <motion.div
              key="pipeline"
              initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="w-full flex flex-col items-center pt-12 pb-24 max-w-5xl mx-auto"
            >
              {/* Pipeline widget — passes live state */}
              <EnterpriseAIPipeline
                status={activeJob?.status as any ?? "PENDING"}
                progress={activeJob?.progress ?? 0}
                filename={activeJob?.filename}
              />

              {/* Error traceback */}
              {activeJob?.error_message && isFailed && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="max-w-[620px] w-full mt-6 p-4 bg-red-950/40 border border-red-500/30 rounded-xl text-red-400 text-xs font-mono"
                >
                  <div className="font-bold mb-1 text-red-300">Pipeline Error:</div>
                  {activeJob.error_message}
                </motion.div>
              )}

              {/* Results section — only when COMPLETED */}
              {isCompleted && activeJob && (
                <ResultsPanel job={activeJob} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
