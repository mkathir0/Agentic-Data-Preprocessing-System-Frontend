"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Activity, FileSearch, ShieldCheck, Database, FileCode2, PlayCircle, Scale, Download } from "lucide-react";
import { DragDropZone } from "@/components/dashboard/DragDropZone";
import { PipelineVisualizer, AgentNode, AgentState } from "@/components/dashboard/PipelineVisualizer";
import { ReportPanel } from "@/components/dashboard/ReportPanel";
import { uploadDataset, getJobStatus, getDownloadUrl, Job } from "@/lib/api";
import { Button } from "@/components/ui/button";

const INITIAL_NODES: AgentNode[] = [
  { id: "profile_and_plan", name: "Profile & Plan", icon: <FileSearch className="w-6 h-6" />, state: "idle" },
  { id: "generate", name: "Code Gen", icon: <FileCode2 className="w-6 h-6" />, state: "idle" },
  { id: "execute", name: "Execute", icon: <PlayCircle className="w-6 h-6" />, state: "idle" },
  { id: "validate", name: "Validate", icon: <ShieldCheck className="w-6 h-6" />, state: "idle" },
];

export default function Home() {
  const [hasStarted, setHasStarted] = useState(false);
  const [nodes, setNodes] = useState<AgentNode[]>(INITIAL_NODES);
  const [selectedNode, setSelectedNode] = useState<AgentNode | null>(null);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    if (!isPolling) return;

    let currentStepIndex = 0;
    
    setNodes(INITIAL_NODES.map((n, i) => ({
      ...n, 
      state: (i === 0 ? "running" : "idle") as AgentState
    })));

    const visualInterval = setInterval(() => {
      setNodes((prev) => {
        const next = [...prev];
        if (currentStepIndex < next.length - 1) {
          next[currentStepIndex].state = "completed";
          currentStepIndex++;
          next[currentStepIndex].state = "running";
        }
        return next;
      });
    }, 15000); 

    return () => clearInterval(visualInterval);
  }, [isPolling]);

  useEffect(() => {
    if (!activeJob || !isPolling) return;

    const pollInterval = setInterval(async () => {
      try {
        const job = await getJobStatus(activeJob.id);
        setActiveJob(job);
        
        if (job.status === "COMPLETED" || job.status === "FAILED") {
          setIsPolling(false);
          setNodes((prev) => prev.map(n => ({
            ...n,
            state: job.status === "COMPLETED" ? "completed" : "error"
          })));
        }
      } catch (e) {
        console.error("Polling error:", e);
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [activeJob, isPolling]);

  const handleFileAccepted = async (file: File) => {
    try {
      setHasStarted(true);
      const job = await uploadDataset(file);
      setActiveJob(job);
      setIsPolling(true);
    } catch (error) {
      console.error("Failed to upload:", error);
      alert("Upload failed. Make sure the backend is running.");
      setHasStarted(false);
    }
  };

  const handleDownload = () => {
    if (activeJob) {
      window.location.href = getDownloadUrl(activeJob.id);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground overflow-hidden">
      <header className="sticky top-0 z-40 flex h-16 items-center border-b border-border/40 bg-background/80 px-6 backdrop-blur-md">
        <div className="flex items-center gap-2 font-bold text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          <span>AI Data Engineer</span>
        </div>
        <nav className="ml-auto flex items-center gap-6 text-sm font-medium">
          <a href="#" className="text-primary transition-colors border-b-2 border-primary py-5">Pipelines</a>
          <a href="#" className="text-muted-foreground hover:text-foreground transition-colors py-5">Datasets</a>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center p-8">
        <motion.div layout className="text-center mt-12 mb-8 max-w-2xl">
          <motion.h1 layout className="text-4xl font-extrabold tracking-tight sm:text-5xl mb-4">
            Autonomous ETL
          </motion.h1>
          <motion.p layout className="text-lg text-muted-foreground">
            Drop your messy CSVs. Let the agent swarm clean, profile, and transform it.
          </motion.p>
        </motion.div>

        {!hasStarted && (
          <DragDropZone onFileAccepted={handleFileAccepted} />
        )}

        <AnimatePresence>
          {hasStarted && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="w-full mt-8"
            >
              <div className="flex items-center justify-between mb-4 w-full max-w-5xl mx-auto px-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary animate-pulse" />
                  <h2 className="text-sm font-semibold tracking-wide uppercase text-primary">Live Orchestrator Loop</h2>
                </div>
                
                {activeJob?.status === "COMPLETED" && (
                  <Button onClick={handleDownload} className="gap-2">
                    <Download className="h-4 w-4" /> Download Cleaned Dataset
                  </Button>
                )}
              </div>
              
              <PipelineVisualizer nodes={nodes} onNodeClick={setSelectedNode} />

              {activeJob?.error_message && (
                <div className="max-w-2xl mx-auto mt-8 p-4 bg-destructive/10 border border-destructive rounded-lg text-destructive text-sm font-mono">
                  {activeJob.error_message}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <ReportPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
    </div>
  );
}
