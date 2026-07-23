"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Terminal, FileJson, GitPullRequest, AlertTriangle } from "lucide-react";
import { AgentNode } from "./PipelineVisualizer";
import { useState } from "react";

interface ReportPanelProps {
  node: AgentNode | null;
  onClose: () => void;
}

export function ReportPanel({ node, onClose }: ReportPanelProps) {
  const [activeTab, setActiveTab] = useState<"summary" | "code" | "logs">("summary");

  return (
    <AnimatePresence>
      {node && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          />
          
          <motion.div
            initial={{ x: "100%", opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0.5 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-xl bg-card border-l border-border shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between p-6 border-b border-border bg-muted/20">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  node.state === 'error' ? 'bg-destructive/20 text-destructive' : 
                  node.state === 'action-required' ? 'bg-amber-500/20 text-amber-500' :
                  'bg-primary/20 text-primary'
                }`}>
                  {node.icon}
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">{node.name} Results</h2>
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground capitalize">
                    Status: <span className={
                      node.state === 'completed' ? 'text-green-500 font-medium' :
                      node.state === 'running' ? 'text-primary font-medium' :
                      node.state === 'action-required' ? 'text-amber-500 font-medium' :
                      'text-destructive font-medium'
                    }>{node.state.replace('-', ' ')}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 rounded-full hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex border-b border-border px-6 pt-4 gap-6 bg-muted/10">
              {(['summary', 'code', 'logs'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-4 text-sm font-medium transition-colors relative ${
                    activeTab === tab ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2 capitalize">
                    {tab === 'summary' && <FileJson className="w-4 h-4" />}
                    {tab === 'code' && <Terminal className="w-4 h-4" />}
                    {tab === 'logs' && <GitPullRequest className="w-4 h-4" />}
                    {tab}
                  </span>
                  {activeTab === tab && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full"
                      initial={false}
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-background">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  {activeTab === 'summary' && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Agent Analysis</h3>
                      <p className="text-muted-foreground">
                        The agent has successfully analyzed the input dataset and found the following structures.
                      </p>
                      <div className="bg-muted p-4 rounded-lg border border-border font-mono text-sm text-primary/80 overflow-x-auto">
                        <pre>
{`{
  "dataset": "raw_sales_data.csv",
  "rows": 1048576,
  "columns": 24,
  "issues_detected": [
    "Age column missing 4%",
    "ZipCode mixed types",
    "Duplicate primary keys"
  ],
  "confidence_score": 0.94
}`}
                        </pre>
                      </div>
                    </div>
                  )}
                  {activeTab === 'code' && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Generated Transformations</h3>
                      <div className="bg-[#0d1117] p-4 rounded-lg border border-border/50 overflow-x-auto">
                        <pre className="text-sm font-mono text-green-400">
{`import pandas as pd
import numpy as np

def clean_dataset(df):
    # Impute missing Ages with Median
    df['Age'] = df['Age'].fillna(df['Age'].median())
    
    # Cast ZipCode to string
    df['ZipCode'] = df['ZipCode'].astype(str)
    
    return df`}
                        </pre>
                      </div>
                    </div>
                  )}
                  {activeTab === 'logs' && (
                    <div className="space-y-2 font-mono text-xs text-muted-foreground bg-black/40 p-4 rounded-lg border border-border">
                      <p>[INFO] Starting ProfilerAgent...</p>
                      <p>[INFO] Loading chunks 1 of 4...</p>
                      <p className="text-amber-500">[WARN] High cardinality detected on column X.</p>
                      <p>[INFO] Profiling complete in 1.2s.</p>
                      <p className="text-green-500">[SUCCESS] Results saved to state.</p>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
            
            {node.state === 'action-required' && (
              <div className="p-6 border-t border-border bg-amber-500/10">
                <h4 className="font-semibold text-amber-500 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" /> Human Escalation Needed
                </h4>
                <p className="text-sm text-muted-foreground mb-4">
                  The LLM Planner is unsure how to handle a 40% null rate in the ZIP Code column.
                </p>
                <div className="flex gap-2">
                  <button className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-semibold py-2 rounded-lg transition-colors">
                    Drop Column
                  </button>
                  <button className="flex-1 bg-card border border-border hover:bg-muted font-semibold py-2 rounded-lg transition-colors">
                    Impute Mode
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
