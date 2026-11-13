"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { ResultsPanel } from "@/components/dashboard/ResultsPanel";
import { Button } from "@/components/ui/button";
import { getJobStatus, type Job, uploadDataset } from "@/lib/api";

const ACCEPTED_EXTENSIONS = [".csv", ".tsv", ".json", ".xlsx", ".xls", ".parquet"];
const ACCEPTED_FILE_TYPES = ACCEPTED_EXTENSIONS.join(",");

function extensionOf(name: string) {
  return name.slice(name.lastIndexOf(".")).toLowerCase();
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isTerminal(job: Job) {
  return job.status === "COMPLETED" || job.status === "FAILED";
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [instructions, setInstructions] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);
  const [selectedJobIndex, setSelectedJobIndex] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const [queuedForSeconds, setQueuedForSeconds] = useState(0);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const jobsRef = useRef<Job[]>([]);

  useEffect(() => {
    jobsRef.current = activeJobs;
  }, [activeJobs]);

  useEffect(() => {
    if (!isPolling) return;
    const poll = window.setInterval(async () => {
      const currentJobs = jobsRef.current;
      if (!currentJobs.length) return;
      try {
        const refreshed = await Promise.all(
          currentJobs.map((job) => (isTerminal(job) ? Promise.resolve(job) : getJobStatus(job.id)))
        );
        setActiveJobs(refreshed);
        setPollingError(null);
        if (refreshed.every(isTerminal)) setIsPolling(false);
      } catch (error) {
        setPollingError(error instanceof Error ? error.message : "Status refresh failed.");
      }
    }, 2500);
    return () => window.clearInterval(poll);
  }, [isPolling]);

  const activeJob = activeJobs[selectedJobIndex];
  const showProcessing = isUploading || Boolean(activeJob && !isTerminal(activeJob));
  const hasResult = Boolean(
    activeJob && isTerminal(activeJob) && (activeJob.status === "COMPLETED" || activeJob.progress >= 100)
  );

  useEffect(() => {
    if (activeJob?.status !== "PENDING") return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const createdAt = Date.parse(activeJob.created_at);
      const origin = Number.isFinite(createdAt) ? createdAt : startedAt;
      setQueuedForSeconds(Math.max(0, Math.floor((Date.now() - origin) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeJob?.id, activeJob?.status, activeJob?.created_at]);

  const addFiles = (incoming: File[]) => {
    const valid = incoming.filter((file) => ACCEPTED_EXTENSIONS.includes(extensionOf(file.name)));
    const invalid = incoming.filter((file) => !ACCEPTED_EXTENSIONS.includes(extensionOf(file.name)));
    setFiles((current) => {
      const next = new Map(current.map((file) => [`${file.name}:${file.size}:${file.lastModified}`, file]));
      valid.forEach((file) => next.set(`${file.name}:${file.size}:${file.lastModified}`, file));
      return Array.from(next.values());
    });
    setUploadError(invalid.length ? `Unsupported file type: ${invalid.map((file) => file.name).join(", ")}` : null);
  };

  const handleUpload = async () => {
    if (!files.length || isUploading) return;
    setIsUploading(true);
    setUploadError(null);
    setPollingError(null);
    setQueuedForSeconds(0);
    try {
      const jobs = await uploadDataset(files, instructions);
      setActiveJobs(jobs);
      setSelectedJobIndex(0);
      setIsPolling(jobs.some((job) => !isTerminal(job)));
      setFiles([]);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed. Check the API connection and try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const reset = () => {
    setActiveJobs([]);
    setSelectedJobIndex(0);
    setPollingError(null);
    setUploadError(null);
    setIsPolling(false);
    setQueuedForSeconds(0);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <div className="min-h-screen bg-[#f6f7f5] text-[#202522]">
      <header className="border-b border-[#e7e9e5] bg-[#f9faf8]">
        <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between px-5 sm:px-8">
          <a href="#home" className="flex items-center gap-2.5" aria-label="Nexus home">
            <span className="grid size-8 place-items-center rounded-[10px] bg-[#253c32] text-white">
              <span className="h-3 w-3 rounded-[3px] border-[1.5px] border-white/90" />
            </span>
            <span className="text-[15px] font-semibold tracking-[-0.04em]">nexus</span>
            <span className="hidden h-4 w-px bg-[#dfe2dd] sm:block" />
            <span className="hidden text-xs text-[#858b85] sm:block">Data workspace</span>
          </a>
          <div className="flex items-center gap-2 text-xs text-[#747b74]">
            <span className="size-1.5 rounded-full bg-[#6c9a7f]" />
            Private workspace
          </div>
        </div>
      </header>

      <main id="home" className="mx-auto max-w-6xl px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
        <AnimatePresence mode="wait" initial={false}>
          {showProcessing && activeJob && !isTerminal(activeJob) ? (
            <ProcessingView
              key="processing"
              job={activeJob}
              queuedForSeconds={queuedForSeconds}
              pollingError={pollingError}
              onBack={reset}
            />
          ) : isUploading ? (
            <UploadingView key="uploading" filename={files[0]?.name} />
          ) : activeJob ? (
            <section key="result" className="mx-auto max-w-5xl">
              <div className="mb-7 flex items-center justify-between">
                <Button variant="ghost" onClick={reset} className="h-9 px-2 text-[#59615b] hover:bg-[#ecefeb]">
                  <ArrowLeft /> New upload
                </Button>
                {activeJobs.length > 1 && (
                  <select
                    aria-label="Select uploaded file"
                    value={selectedJobIndex}
                    onChange={(event) => setSelectedJobIndex(Number(event.target.value))}
                    className="max-w-[55%] rounded-lg border border-[#dfe3de] bg-white px-3 py-2 text-xs text-[#515a53]"
                  >
                    {activeJobs.map((job, index) => <option key={job.id} value={index}>{job.filename}</option>)}
                  </select>
                )}
              </div>
              {activeJob.status === "FAILED" && !hasResult && (
                <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-[#edc8bd] bg-[#fff5f1] px-4 py-3 text-sm text-[#8b4738]">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" />
                  {activeJob.error_message || "This run did not produce an approved output."}
                </div>
              )}
              {hasResult ? (
                <ResultsPanel job={activeJob} onReset={reset} />
              ) : (
                <div className="mt-5 rounded-xl border border-[#e2e6e0] bg-white p-6 text-center">
                  <p className="text-sm font-medium text-[#364139]">No result is available for this run.</p>
                  <Button onClick={reset} className="mt-4 bg-[#294436] text-white hover:bg-[#20392c]">Try another file</Button>
                </div>
              )}
            </section>
          ) : (
            <motion.section
              key="upload"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
              className="mx-auto max-w-[760px]"
            >
              <div className="mb-8 text-center sm:mb-10">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#829087]">Data preparation</p>
                <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.055em] text-[#202923] sm:text-[42px]">
                  A cleaner start for your data.
                </h1>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#747d75]">
                  Upload a file to clean supported formatting issues and check the result.
                </p>
              </div>

              <section className="rounded-2xl border border-[#e2e6e0] bg-white p-4 shadow-[0_18px_50px_rgba(37,60,50,0.06)] sm:p-6">
                <div
                  onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false);
                  }}
                  onDrop={handleDrop}
                  className={`rounded-xl border border-dashed px-5 py-10 text-center transition-colors sm:py-12 ${
                    isDragging ? "border-[#557966] bg-[#f1f6f2]" : "border-[#cfd7d0] bg-[#fafbf9] hover:border-[#91a99a]"
                  }`}
                >
                  <input
                    ref={uploadInputRef}
                    type="file"
                    multiple
                    accept={ACCEPTED_FILE_TYPES}
                    className="sr-only"
                    aria-label="Choose dataset files"
                    onChange={(event) => {
                      if (event.target.files?.length) addFiles(Array.from(event.target.files));
                      event.target.value = "";
                    }}
                  />
                  <span className="mx-auto grid size-11 place-items-center rounded-xl bg-[#eaf0eb] text-[#45634f]">
                    <Upload className="size-5" strokeWidth={1.8} />
                  </span>
                  <p className="mt-4 text-sm font-medium text-[#303a33]">{isDragging ? "Drop to add your files" : "Drop your files here"}</p>
                  <p className="mt-1.5 text-xs text-[#8a928b]">or</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => uploadInputRef.current?.click()}
                    className="mt-3 h-9 border-[#dce2dc] bg-white px-3.5 text-xs text-[#3d4940] shadow-sm hover:bg-[#f5f7f4]"
                  >
                    <Plus /> Choose files
                  </Button>
                  <p className="mt-4 text-[11px] text-[#a0a69f]">CSV, TSV, Excel, JSON, or Parquet</p>
                </div>

                {files.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {files.map((file) => (
                      <div key={`${file.name}:${file.size}:${file.lastModified}`} className="flex items-center gap-3 rounded-lg border border-[#e8ebe7] bg-white px-3 py-2.5">
                        <FileSpreadsheet className="size-4 shrink-0 text-[#678272]" />
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-[#3c453e]">{file.name}</span>
                        <span className="shrink-0 text-[11px] text-[#969e97]">{formatFileSize(file.size)}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${file.name}`}
                          onClick={() => setFiles((current) => current.filter((candidate) => candidate !== file))}
                          className="rounded p-1 text-[#9ba29c] hover:bg-[#f0f2ef] hover:text-[#4d5b50]"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                    {files.length > 1 && <p className="px-1 text-[11px] text-[#8a928b]">{files.length} files ready</p>}
                  </div>
                )}

                <details className="group mt-4 rounded-lg border border-[#eceeeb] px-3.5 py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-medium text-[#68736b]">
                    Add a verified rule <span className="text-[11px] font-normal text-[#a1a7a1]">Optional</span>
                    <ChevronDown className="ml-auto size-3.5 transition-transform group-open:rotate-180" />
                  </summary>
                  <label htmlFor="instructions" className="sr-only">Verified processing instruction</label>
                  <textarea
                    id="instructions"
                    value={instructions}
                    onChange={(event) => setInstructions(event.target.value)}
                    placeholder="Add a known rule for this dataset…"
                    rows={2}
                    className="mt-3 w-full resize-y rounded-lg border border-[#e2e6e1] bg-[#fbfcfa] px-3 py-2.5 text-xs leading-5 text-[#39423b] outline-none placeholder:text-[#a4aaa4] focus:border-[#8fa798] focus:ring-2 focus:ring-[#79947f]/10"
                  />
                </details>

                {uploadError && (
                  <div role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-[#f0d1c8] bg-[#fff6f3] px-3 py-2.5 text-xs leading-5 text-[#994f3d]">
                    <CircleAlert className="mt-0.5 size-3.5 shrink-0" /> {uploadError}
                  </div>
                )}

                <Button
                  type="button"
                  onClick={handleUpload}
                  disabled={!files.length || isUploading}
                  className="mt-4 h-11 w-full rounded-lg bg-[#294436] text-sm font-medium text-white shadow-none hover:bg-[#20392c] disabled:bg-[#aab8ad]"
                >
                  Prepare dataset <ArrowRight className="size-4" />
                </Button>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-[#a0a69f]">
                  <LockKeyhole className="size-3" /> Your original file is kept unchanged
                </p>
              </section>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] text-[#858e86]">
                <span className="inline-flex items-center gap-1.5"><Check className="size-3 text-[#6c8b75]" /> Safe formatting fixes</span>
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3 text-[#6c8b75]" /> Integrity checked</span>
                <span className="inline-flex items-center gap-1.5"><FileText className="size-3 text-[#6c8b75]" /> Ambiguous values flagged</span>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
      <footer className="mx-auto flex max-w-6xl items-center justify-between px-5 pb-6 text-[10px] text-[#a2a8a2] sm:px-8">
        <span>Nexus Data Workspace</span>
        <span>Transparent cleanup · Human review</span>
      </footer>
    </div>
  );
}

function UploadingView({ filename }: { filename?: string }) {
  return (
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto flex min-h-[58vh] max-w-lg flex-col items-center justify-center text-center">
      <span className="relative grid size-16 place-items-center rounded-2xl bg-[#e8efe9] text-[#45634f]">
        <span className="absolute inset-0 animate-ping rounded-2xl border border-[#a8bcae]/50" />
        <Upload className="size-6" />
      </span>
      <h1 className="mt-6 text-2xl font-semibold tracking-[-0.04em] text-[#26332b]">Sending your file</h1>
      <p className="mt-2 max-w-sm text-sm leading-6 text-[#7e877f]">{filename ? `Uploading ${filename} to your workspace.` : "Uploading your files to the workspace."}</p>
      <div className="mt-7 h-1 w-40 overflow-hidden rounded-full bg-[#e2e7e2]"><div className="h-full w-1/3 animate-[nexus-upload_1.25s_ease-in-out_infinite] rounded-full bg-[#557966]" /></div>
    </motion.section>
  );
}

function ProcessingView({
  job,
  queuedForSeconds,
  pollingError,
  onBack,
}: {
  job: Job;
  queuedForSeconds: number;
  pollingError: string | null;
  onBack: () => void;
}) {
  const queued = job.status === "PENDING";
  return (
    <motion.section
      key={job.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="mx-auto max-w-[760px]"
    >
      <Button variant="ghost" onClick={onBack} className="mb-6 h-9 px-2 text-[#68736b] hover:bg-[#ecefeb]">
        <ArrowLeft /> Back to uploads
      </Button>
      <div className="overflow-hidden rounded-2xl border border-[#e2e6e0] bg-white shadow-[0_18px_50px_rgba(37,60,50,0.06)]">
        <div className="flex items-center gap-3 border-b border-[#edf0ec] px-5 py-4 sm:px-7">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#eef3ef] text-[#597562]"><FileSpreadsheet className="size-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[#344037]">{job.filename}</p>
            <p className="mt-0.5 text-[11px] text-[#9aa19a]">Dataset preparation</p>
          </div>
          <span className="rounded-full bg-[#f1f4f1] px-2.5 py-1 text-[10px] font-medium text-[#758078]">{queued ? "In queue" : "Working"}</span>
        </div>

        <div className="px-5 py-10 text-center sm:px-10 sm:py-14">
          <div className="relative mx-auto grid size-[74px] place-items-center rounded-full bg-[#edf3ee]">
            <span className="absolute inset-0 animate-[nexus-ring_2.4s_ease-out_infinite] rounded-full border border-[#8eaa96]/40" />
            {queued ? <Clock3 className="size-7 text-[#587363]" strokeWidth={1.6} /> : <LoaderCircle className="size-7 animate-spin text-[#587363]" strokeWidth={1.6} />}
          </div>
          <h1 className="mt-6 text-[25px] font-semibold tracking-[-0.045em] text-[#26332b] sm:text-[30px]">
            {queued ? "Your file is in line." : "We’re preparing your data."}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#7a847c]">
            {queued
              ? "A worker will pick it up automatically. We’ll show the result here as soon as processing begins."
              : "Supported formatting repairs and integrity checks are running. This page updates automatically."}
          </p>

          <div className="mx-auto mt-9 flex max-w-[410px] items-center">
            <StatusStep complete label="Received" />
            <span className={`h-px flex-1 ${queued ? "bg-[#e1e6e1]" : "bg-[#8ea795]"}`} />
            <StatusStep active={!queued} waiting={queued} label="Prepare" />
            <span className="h-px flex-1 bg-[#e1e6e1]" />
            <StatusStep label="Validated" />
          </div>

          {queued && queuedForSeconds >= 20 && (
            <p className="mx-auto mt-7 max-w-md rounded-lg bg-[#f6f7f4] px-3 py-2.5 text-left text-[11px] leading-5 text-[#858e86]">
              Still waiting? The backend worker must be running to pick up queued files.
            </p>
          )}
          {pollingError && <p role="alert" className="mt-5 text-xs text-[#a25847]">Status refresh failed: {pollingError}. Retrying automatically.</p>}

          <p className="mt-8 inline-flex items-center gap-1.5 text-[10px] text-[#a0a69f]">
            <ShieldCheck className="size-3.5" /> Uncertain values are flagged for review, never guessed
          </p>
        </div>
      </div>
    </motion.section>
  );
}

function StatusStep({ complete, active, waiting, label }: { complete?: boolean; active?: boolean; waiting?: boolean; label: string }) {
  return (
    <div className="flex min-w-[68px] flex-col items-center gap-2">
      <span className={`grid size-7 place-items-center rounded-full border ${
        complete ? "border-[#54735e] bg-[#54735e] text-white" : active ? "border-[#54735e] bg-white text-[#54735e]" : waiting ? "border-[#bbc6bd] bg-white text-[#87948a]" : "border-[#e0e5e0] bg-white text-[#b5bcb6]"
      }`}>
        {complete ? <Check className="size-3.5" /> : active ? <LoaderCircle className="size-3.5 animate-spin" /> : waiting ? <Clock3 className="size-3.5" /> : <span className="size-1.5 rounded-full bg-current" />}
      </span>
      <span className={`text-[10px] ${active || complete ? "font-medium text-[#58685c]" : "text-[#a0a69f]"}`}>{label}</span>
    </div>
  );
}
