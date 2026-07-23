"use client";

import { motion } from "framer-motion";
import { 
  Database, 
  Search, 
  CheckCircle2, 
  Network, 
  Lightbulb, 
  Code2, 
  Play, 
  ShieldCheck,
  AlertTriangle
} from "lucide-react";

export type AgentState = "idle" | "running" | "completed" | "error" | "action-required";

export interface AgentNode {
  id: string;
  name: string;
  icon: React.ReactNode;
  state: AgentState;
}

interface PipelineVisualizerProps {
  nodes: AgentNode[];
  onNodeClick: (node: AgentNode) => void;
}

export function PipelineVisualizer({ nodes, onNodeClick }: PipelineVisualizerProps) {
  
  const getStateColors = (state: AgentState) => {
    switch(state) {
      case "idle": return "bg-card border-border text-muted-foreground";
      case "running": return "bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(var(--primary),0.5)]";
      case "completed": return "bg-green-500/20 border-green-500 text-green-500";
      case "error": return "bg-destructive/20 border-destructive text-destructive";
      case "action-required": return "bg-amber-500/20 border-amber-500 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]";
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto py-12 px-4 overflow-x-auto">
      <div className="flex items-center justify-between min-w-max gap-4">
        {nodes.map((node, index) => {
          const isLast = index === nodes.length - 1;
          
          return (
            <div key={node.id} className="flex items-center">
              <motion.div
                layoutId={`node-${node.id}`}
                whileHover={{ scale: 1.05, y: -5 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onNodeClick(node)}
                className={`
                  relative flex flex-col items-center justify-center p-4 w-32 h-32
                  border-2 rounded-2xl cursor-pointer transition-all duration-300
                  ${getStateColors(node.state)}
                `}
                animate={
                  node.state === "running" ? {
                    scale: [1, 1.05, 1],
                    transition: { repeat: Infinity, duration: 2 }
                  } : node.state === "action-required" ? {
                    y: [0, -5, 0],
                    transition: { repeat: Infinity, duration: 1 }
                  } : {}
                }
              >
                <div className="mb-2">
                  {node.icon}
                </div>
                <span className="text-sm font-semibold text-center leading-tight">
                  {node.name}
                </span>

                {node.state === "running" && (
                  <motion.div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-ping" />
                )}
                {node.state === "action-required" && (
                  <div className="absolute -top-2 -right-2 bg-amber-500 text-black p-1 rounded-full shadow-lg">
                    <AlertTriangle className="w-3 h-3" />
                  </div>
                )}
                {node.state === "completed" && (
                  <div className="absolute -top-1 -right-1 bg-background rounded-full text-green-500">
                    <CheckCircle2 className="w-5 h-5 fill-background" />
                  </div>
                )}
              </motion.div>

              {!isLast && (
                <div className="relative w-12 h-[2px] mx-2 bg-border">
                  {(node.state === "completed" || node.state === "running") && (
                    <motion.div
                      className="absolute inset-0 bg-primary h-full"
                      initial={{ scaleX: 0, transformOrigin: "left" }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 1, ease: "easeInOut" }}
                    />
                  )}
                  {node.state === "completed" && nodes[index+1]?.state === "running" && (
                    <motion.div
                      className="absolute top-1/2 -mt-1 w-2 h-2 bg-primary rounded-full shadow-[0_0_8px_var(--primary)]"
                      animate={{ x: [0, 48] }}
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
