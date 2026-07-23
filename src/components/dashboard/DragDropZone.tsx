"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FileSpreadsheet, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DragDropZoneProps {
  onFileAccepted: (file: File) => void;
}

export function DragDropZone({ onFileAccepted }: DragDropZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = () => {
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (file) {
      setIsUploading(true);
      setTimeout(() => {
        setIsUploading(false);
        onFileAccepted(file);
      }, 1500);
    }
  };

  return (
    <motion.div
      layout
      className="w-full max-w-2xl mx-auto"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, type: "spring", bounce: 0.4 }}
    >
      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className={`
              relative flex flex-col items-center justify-center w-full p-12 mt-8
              border-2 border-dashed rounded-2xl cursor-pointer
              transition-colors duration-300 ease-in-out
              ${isDragActive ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-accent/5 hover:border-primary/50"}
            `}
          >
            <input
              type="file"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              accept=".csv"
              onChange={handleFileInput}
            />
            
            <motion.div
              animate={{ y: isDragActive ? -10 : 0 }}
              transition={{ duration: 0.3, type: "spring" }}
              className="p-4 mb-4 rounded-full bg-primary/10 text-primary"
            >
              <UploadCloud className="w-10 h-10" />
            </motion.div>
            
            <h3 className="text-xl font-semibold mb-2">
              {isDragActive ? "Drop CSV here..." : "Upload Dataset"}
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              Drag and drop your raw CSV file here, or click to browse. Our agents will take it from here.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="file-preview"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex flex-col items-center p-8 mt-8 border border-border rounded-2xl bg-card shadow-sm"
          >
            <div className="flex items-center gap-4 p-4 mb-6 w-full max-w-md rounded-xl bg-accent/20 border border-border/50">
              <div className="p-3 bg-primary/20 text-primary rounded-lg">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              {!isUploading && (
                <button
                  onClick={() => setFile(null)}
                  className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-full hover:bg-destructive/10"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button 
                size="lg" 
                onClick={handleUpload} 
                disabled={isUploading}
                className="w-full max-w-xs font-semibold"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Initializing Agents...
                  </>
                ) : (
                  "Start Pipeline"
                )}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
