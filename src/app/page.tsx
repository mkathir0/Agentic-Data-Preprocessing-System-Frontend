"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Activity, FileSearch, ShieldCheck, Database, FileCode2, PlayCircle, Download } from "lucide-react";
import EnterpriseAIPipeline from "@/components/ui/ai-agent-pipeline";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import { uploadDataset, getJobStatus, getDownloadUrl, Job } from "@/lib/api";
import { Button } from "@/components/ui/button";

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
      } catch (e) {
        console.error("Polling error:", e);
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [activeJob, isPolling]);

  const handleSend = async (message: string, files?: File[]) => {
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

  const handleDownload = () => {
    if (activeJob) {
      window.location.href = getDownloadUrl(activeJob.id);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#000000] text-gray-100 overflow-hidden font-sans">
      
      {/* Background Gradient matching the aesthetic */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.15]">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(245,87,2,1)_0%,rgba(0,0,0,0)_70%)] blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(245,120,2,1)_0%,rgba(0,0,0,0)_70%)] blur-[120px]" />
      </div>

      <header className="sticky top-0 z-40 flex h-16 items-center border-b border-[#333]/40 bg-black/50 px-8 backdrop-blur-xl">
        <div className="flex items-center gap-3 font-bold text-lg tracking-tight text-white">
          <div className="bg-[#F55702] p-1.5 rounded-md">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span>Nexus Data Engineer</span>
        </div>
        <nav className="ml-auto flex items-center gap-8 text-sm font-medium">
          <a href="#" className="text-white transition-colors border-b-2 border-[#F55702] py-5">Pipelines</a>
          <a href="#" className="text-gray-400 hover:text-white transition-colors py-5">Knowledge Base</a>
          <a href="#" className="text-gray-400 hover:text-white transition-colors py-5">Settings</a>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-8 relative z-10 w-full max-w-5xl mx-auto min-h-[calc(100vh-64px)]">
        
        <AnimatePresence mode="wait">
          {!hasStarted ? (
            <motion.div 
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center w-full max-w-3xl -mt-16"
            >
              <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-white mb-6 text-center leading-tight">
                Data Engineering, <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F55702] to-[#FF8A00]">
                  Automated by Agents.
                </span>
              </h1>
              <p className="text-lg text-gray-400 text-center mb-12 max-w-xl leading-relaxed">
                Upload your raw datasets and provide natural language instructions. 
                Our specialized LLM agents will profile, clean, and transform the data autonomously.
              </p>

              <div className="w-full max-w-2xl">
                <PromptInputBox 
                  onSend={handleSend} 
                  isLoading={isUploading} 
                />
              </div>

              <div className="mt-12 flex items-center gap-6 text-xs font-mono text-gray-500 uppercase tracking-widest">
                <div className="flex items-center gap-2">
                  <Database className="w-3.5 h-3.5" /> Pinecone Vector DB
                </div>
                <span className="w-1 h-1 rounded-full bg-gray-700" />
                <div className="flex items-center gap-2">
                  <FileCode2 className="w-3.5 h-3.5" /> Python Pandas
                </div>
                <span className="w-1 h-1 rounded-full bg-gray-700" />
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5" /> Llama 3.3 70B
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="pipeline"
              initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="w-full flex flex-col items-center -mt-8"
            >
              <div className="flex items-center justify-between w-full max-w-[620px] mb-8">
                <div className="flex items-center gap-3">
                  <div className="bg-[#1EAEDB]/20 p-2 rounded-full">
                    <Activity className="h-5 w-5 text-[#1EAEDB] animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-white">Execution Orchestrator</h2>
                    <p className="text-xs font-mono text-gray-400 mt-0.5">Job ID: {activeJob?.id || "Initializing..."}</p>
                  </div>
                </div>
                
                {activeJob?.status === "COMPLETED" && (
                  <Button 
                    onClick={handleDownload} 
                    className="gap-2 bg-[#22c55e] hover:bg-[#16a34a] text-white rounded-full px-6 shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-all"
                  >
                    <Download className="h-4 w-4" /> Download Result
                  </Button>
                )}
                {activeJob?.status === "FAILED" && (
                  <div className="px-4 py-1.5 rounded-full bg-red-500/20 text-red-400 text-xs font-bold tracking-wider uppercase border border-red-500/30">
                    Execution Failed
                  </div>
                )}
              </div>
              
              <EnterpriseAIPipeline />

              {activeJob?.error_message && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="max-w-[620px] w-full mt-8 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm font-mono shadow-lg"
                >
                  <div className="font-bold mb-1">Traceback:</div>
                  {activeJob.error_message}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
