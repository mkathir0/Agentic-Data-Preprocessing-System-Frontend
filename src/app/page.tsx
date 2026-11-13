"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { ResultsPanel } from "@/components/dashboard/ResultsPanel";
import { uploadDataset, getJobStatus, type Job } from "@/lib/api";

const ACCEPTED_EXTENSIONS = [".csv", ".tsv", ".json", ".xlsx", ".xls", ".parquet"];
const ACCEPTED_FILE_TYPES = ACCEPTED_EXTENSIONS.join(",");

function fileExtension(name: string) {
  return name.slice(name.lastIndexOf(".")).toLowerCase();
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusFor(job: Job) {
  if (job.status === "COMPLETED") {
    return { label: "Verified", className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300", icon: CheckCircle2 };
  }
  if (job.current_step === "REVIEW_FLAGGED") {
    return { label: "Review needed", className: "border-amber-400/20 bg-amber-400/10 text-amber-200", icon: CircleAlert };
  }
  if (job.status === "FAILED") {
    return { label: "Stopped", className: "border-rose-400/20 bg-rose-400/10 text-rose-200", icon: CircleAlert };
  }
  if (job.status === "PENDING") {
    return { label: "Queued", className: "border-amber-400/20 bg-amber-400/10 text-amber-200", icon: Clock3 };
  }
  return { label: "Processing", className: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200", icon: Activity };
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
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const activeJobsRef = useRef<Job[]>([]);

  useEffect(() => {
    activeJobsRef.current = activeJobs;
  }, [activeJobs]);

  useEffect(() => {
    if (!isPolling) return;

    const pollInterval = window.setInterval(async () => {
      const currentJobs = activeJobsRef.current;
      if (!currentJobs.length) return;

      try {
        const refreshed = await Promise.all(
          currentJobs.map((job) =>
            job.status === "COMPLETED" || job.status === "FAILED"
              ? Promise.resolve(job)
              : getJobStatus(job.id)
          )
        );
        setActiveJobs(refreshed);
        setPollingError(null);
        if (refreshed.every((job) => job.status === "COMPLETED" || job.status === "FAILED")) {
          setIsPolling(false);
        }
      } catch (error) {
        setPollingError(error instanceof Error ? error.message : "Could not refresh job status.");
      }
    }, 3000);

    return () => window.clearInterval(pollInterval);
  }, [isPolling]);

  const addFiles = (incoming: File[]) => {
    const validFiles = incoming.filter((file) => ACCEPTED_EXTENSIONS.includes(fileExtension(file.name)));
    const invalidFiles = incoming.filter((file) => !ACCEPTED_EXTENSIONS.includes(fileExtension(file.name)));

    setFiles((current) => {
      const unique = new Map(current.map((file) => [`${file.name}:${file.size}:${file.lastModified}`, file]));
      for (const file of validFiles) unique.set(`${file.name}:${file.size}:${file.lastModified}`, file);
      return Array.from(unique.values());
    });

    setUploadError(
      invalidFiles.length
        ? `Unsupported file${invalidFiles.length > 1 ? "s" : ""}: ${invalidFiles.map((file) => file.name).join(", ")}. Choose CSV, TSV, JSON, Excel, or Parquet files.`
        : null
    );
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  };

  const handleUpload = async () => {
    if (!files.length || isUploading) return;
    setIsUploading(true);
    setUploadError(null);
    setPollingError(null);

    try {
      const jobs = await uploadDataset(files, instructions);
      setActiveJobs(jobs);
      setSelectedJobIndex(0);
      setIsPolling(jobs.some((job) => job.status !== "COMPLETED" && job.status !== "FAILED"));
      setFiles([]);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "The upload could not be sent to the backend.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setActiveJobs([]);
    setSelectedJobIndex(0);
    setPollingError(null);
    setUploadError(null);
    setIsPolling(false);
  };

  const activeJob = activeJobs[selectedJobIndex];
  const activeStatus = activeJob ? statusFor(activeJob) : null;
  const terminal = activeJob?.status === "COMPLETED" || activeJob?.status === "FAILED";
  const hasResult = Boolean(
    activeJob && terminal && (activeJob.status === "COMPLETED" || activeJob.progress >= 100)
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#080c12] text-slate-100 selection:bg-cyan-300/25 selection:text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 16% 0%, rgba(0, 190, 220, 0.12), transparent 36%), radial-gradient(ellipse at 88% 30%, rgba(36, 93, 160, 0.10), transparent 30%), linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)",
          backgroundSize: "auto, auto, 48px 48px, 48px 48px",
          maskImage: "linear-gradient(to bottom, black, transparent 78%)",
        }}
      />

      <header className="relative z-10 border-b border-white/[0.07] bg-[#080c12]/75 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <a href="#top" className="flex items-center gap-3" aria-label="Nexus Data home">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-200 shadow-[0_0_30px_rgba(34,211,238,0.10)]">
              <Database className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-[0.16em] text-white">NEXUS</span>
              <span className="block text-[10px] font-medium tracking-[0.18em] text-slate-500">DATA WORKSPACE</span>
            </span>
          </a>

          <div className="hidden items-center gap-2 text-xs text-slate-400 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.8)]" />
            Evidence-backed data preparation
          </div>
          <a href="#workflow" className="hidden text-xs font-medium text-slate-400 transition hover:text-white sm:inline-flex sm:items-center">
            How it works <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
          </a>
        </div>
      </header>

      <main id="top" className="relative z-10 mx-auto w-full max-w-7xl px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
        {!activeJobs.length ? (
          <motion.div initial={false} animate={{ opacity: 1, y: 0 }}>
            <section className="grid min-w-0 grid-cols-1 items-center gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
              <div className="w-full min-w-0 max-w-xl">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100/80">
                  <Sparkles className="h-3.5 w-3.5" />
                  Automated data quality
                </div>
                <h1 className="text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-white sm:text-5xl lg:text-[3.65rem]">
                  Make messy data
                  <br />
                  <span className="bg-gradient-to-r from-cyan-200 via-cyan-300 to-blue-300 bg-clip-text text-transparent">ready to trust.</span>
                </h1>
                <p className="mt-6 w-full max-w-lg break-words text-base leading-7 text-slate-400 sm:text-lg">
                  Upload a dataset. Nexus applies repairs supported by clear evidence, checks every output record, and sends uncertain issues to review.
                </p>

                <div className="mt-9 space-y-4">
                  <FeatureLine icon={<Check className="h-3.5 w-3.5" />} title="Safe formatting repairs" detail="Normalize supported numbers, dates, booleans, whitespace, and exact duplicates." />
                  <FeatureLine icon={<ShieldCheck className="h-3.5 w-3.5" />} title="No guessed business corrections" detail="Conflicting IDs and ambiguous values stay intact and are flagged." />
                  <FeatureLine icon={<LockKeyhole className="h-3.5 w-3.5" />} title="Integrity checked before approval" detail="The output must match the allowed cleaning plan before it is approved." />
                </div>
              </div>

              <section aria-labelledby="upload-heading" className="w-full min-w-0 rounded-[26px] border border-white/[0.09] bg-[#0d131c]/90 p-4 shadow-[0_30px_100px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3 px-1 pb-5">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Start a new run</p>
                    <h2 id="upload-heading" className="mt-2 text-xl font-semibold tracking-tight text-white">Add your dataset</h2>
                  </div>
                  <span className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-mono text-slate-400">6 FILE FORMATS</span>
                </div>

                <div
                  onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false);
                  }}
                  onDrop={handleDrop}
                  className={`relative rounded-2xl border border-dashed px-5 py-8 text-center transition sm:px-8 sm:py-10 ${
                    isDragging ? "border-cyan-300 bg-cyan-300/[0.08]" : "border-slate-700/80 bg-[#090e15] hover:border-slate-500"
                  }`}
                >
                  <input
                    ref={uploadInputRef}
                    type="file"
                    multiple
                    accept={ACCEPTED_FILE_TYPES}
                    className="sr-only"
                    onChange={(event) => {
                      if (event.target.files?.length) addFiles(Array.from(event.target.files));
                      event.target.value = "";
                    }}
                    aria-label="Choose data files"
                  />
                  <span className={`mx-auto grid h-12 w-12 place-items-center rounded-2xl border transition ${isDragging ? "border-cyan-200/30 bg-cyan-200/10 text-cyan-100" : "border-white/[0.08] bg-white/[0.04] text-slate-300"}`}>
                    <UploadCloud className="h-5 w-5" />
                  </span>
                  <p className="mt-4 text-sm font-medium text-slate-100">{isDragging ? "Drop your files to add them" : "Drag files here to get started"}</p>
                  <p className="mt-1.5 text-xs text-slate-500">Or choose files from your computer</p>
                  <button
                    type="button"
                    onClick={() => uploadInputRef.current?.click()}
                    className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3.5 text-xs font-medium text-white transition hover:border-cyan-200/30 hover:bg-cyan-200/[0.08]"
                  >
                    <Plus className="h-3.5 w-3.5" /> Browse files
                  </button>
                  <p className="mt-4 text-[10px] text-slate-600">CSV, TSV, JSON, Excel, or Parquet · multiple files supported</p>
                </div>

                {files.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Selected files <span className="text-slate-400">({files.length})</span></p>
                      <button type="button" onClick={() => setFiles([])} className="text-[10px] text-slate-500 transition hover:text-white">Clear all</button>
                    </div>
                    <div className="max-h-36 space-y-1.5 overflow-y-auto">
                      {files.map((file) => (
                        <div key={`${file.name}:${file.size}:${file.lastModified}`} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
                          <FileSpreadsheet className="h-4 w-4 shrink-0 text-cyan-200/80" />
                          <span className="min-w-0 flex-1 truncate text-xs text-slate-200">{file.name}</span>
                          <span className="shrink-0 text-[10px] font-mono text-slate-500">{formatFileSize(file.size)}</span>
                          <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((item) => item !== file))} className="rounded-md p-1 text-slate-600 transition hover:bg-white/5 hover:text-white">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <label htmlFor="instructions" className="mb-2 mt-5 block text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Optional processing instructions
                </label>
                <textarea
                  id="instructions"
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                  placeholder="Describe a verified rule or constraint for this dataset…"
                  rows={2}
                  className="w-full resize-y rounded-xl border border-white/[0.08] bg-[#090e15] px-3.5 py-3 text-xs leading-5 text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-cyan-200/40 focus:ring-2 focus:ring-cyan-300/10"
                />
                <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-4 text-slate-600">
                  <CircleAlert className="mt-0.5 h-3 w-3 shrink-0" /> Instructions do not override integrity checks or authorize unsupported corrections.
                </p>

                {uploadError && (
                  <div role="alert" className="mt-4 flex gap-2 rounded-xl border border-rose-300/15 bg-rose-300/[0.06] p-3 text-xs leading-5 text-rose-200">
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> <span>{uploadError}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={!files.length || isUploading}
                  className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-sky-300 text-sm font-semibold text-[#071018] shadow-[0_8px_30px_rgba(34,211,238,0.14)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isUploading ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Uploading files…</> : <>Upload and validate <ArrowRight className="h-4 w-4" /></>}
                </button>
                <p className="mt-3 text-center text-[10px] text-slate-600">Raw files are kept unchanged. Results appear after the backend worker finishes.</p>
              </section>
            </section>

            <section id="workflow" className="mt-16 border-t border-white/[0.07] pt-8">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/60">What happens next</p>
                  <h2 className="mt-1.5 text-lg font-semibold text-white">A careful path from upload to output</h2>
                </div>
                <span className="hidden text-[10px] text-slate-600 sm:block">Uncertain data is surfaced, not silently rewritten.</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <WorkflowCard number="01" title="Profile" text="Inspect columns, formats, missingness, and possible anomalies." icon={<Database className="h-4 w-4" />} />
                <WorkflowCard number="02" title="Repair safely" text="Apply supported representation fixes and preserve ambiguous values." icon={<Sparkles className="h-4 w-4" />} />
                <WorkflowCard number="03" title="Validate" text="Compare records against the plan and report what needs review." icon={<ShieldCheck className="h-4 w-4" />} />
              </div>
            </section>
          </motion.div>
        ) : (
          <section className="mx-auto max-w-5xl">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <button type="button" onClick={handleReset} className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-xs text-slate-400 transition hover:bg-white/5 hover:text-white">
                <ArrowLeft className="h-4 w-4" /> New run
              </button>
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.15em] text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> Processing workspace
              </div>
            </div>

            {activeJobs.length > 1 && (
              <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
                {activeJobs.map((job, index) => {
                  const state = statusFor(job);
                  return (
                    <button key={job.id} type="button" onClick={() => setSelectedJobIndex(index)} className={`flex min-w-0 max-w-xs items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition ${selectedJobIndex === index ? "border-cyan-200/25 bg-cyan-200/[0.06] text-white" : "border-white/[0.07] bg-white/[0.025] text-slate-400 hover:bg-white/[0.05]"}`}>
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{job.filename}</span>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] ${state.className}`}>{state.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {activeJob && activeStatus && (
              <motion.div initial={false} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d131c]/90 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.07] px-5 py-4 sm:px-6">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-cyan-100"><FileSpreadsheet className="h-5 w-5" /></span>
                    <div className="min-w-0">
                      <h1 className="truncate text-sm font-semibold text-white sm:text-base">{activeJob.filename}</h1>
                      <p className="mt-1 text-[10px] font-mono text-slate-500">Run {activeJob.id.slice(0, 8)} · {activeJob.current_step || activeJob.status}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-medium ${activeStatus.className}`}>
                    <activeStatus.icon className="h-3.5 w-3.5" /> {activeStatus.label}
                  </span>
                </div>

                <div className="px-5 py-5 sm:px-6">
                  {activeJob.status === "PENDING" ? (
                    <div className="flex gap-3 rounded-xl border border-amber-200/15 bg-amber-200/[0.05] p-4">
                      <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
                      <div>
                        <p className="text-sm font-medium text-amber-100">Your upload is queued for a worker.</p>
                        <p className="mt-1 text-xs leading-5 text-amber-100/65">If it remains queued, start the backend worker in a separate terminal: <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-amber-50">uv run python -m app.worker</code></p>
                      </div>
                    </div>
                  ) : activeJob.status === "PROCESSING" ? (
                    <div>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-white"><LoaderCircle className="h-4 w-4 animate-spin text-cyan-200" /> Worker is processing your dataset</div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">In progress</span>
                      </div>
                      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <div className="h-full w-1/3 animate-[nexus-progress_1.8s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-cyan-300 to-blue-400" />
                      </div>
                      <p className="mt-3 text-xs text-slate-500">The pipeline profiles, applies supported repairs, then validates the output. Results appear when the run finishes.</p>
                    </div>
                  ) : activeJob.status === "COMPLETED" ? (
                    <div className="flex gap-3 rounded-xl border border-emerald-200/15 bg-emerald-200/[0.05] p-4">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
                      <div>
                        <p className="text-sm font-medium text-emerald-100">Validation passed. The output is approved.</p>
                        <p className="mt-1 text-xs text-emerald-100/60">Review the audit and download the verified CSV below.</p>
                      </div>
                    </div>
                  ) : activeJob.current_step === "REVIEW_FLAGGED" ? (
                    <div className="flex gap-3 rounded-xl border border-amber-200/15 bg-amber-200/[0.05] p-4">
                      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
                      <div>
                        <p className="text-sm font-medium text-amber-100">Processing finished with items for review.</p>
                        <p className="mt-1 text-xs text-amber-100/60">The candidate preserves the source records, but validation did not approve it for production.</p>
                      </div>
                    </div>
                  ) : (
                    <div role="alert" className="flex gap-3 rounded-xl border border-rose-200/15 bg-rose-200/[0.05] p-4">
                      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-200" />
                      <div>
                        <p className="text-sm font-medium text-rose-100">The run did not produce an approved output.</p>
                        <p className="mt-1 text-xs text-rose-100/65">{activeJob.error_message || "Check the validation report for details."}</p>
                      </div>
                    </div>
                  )}

                  {pollingError && (
                    <div role="alert" className="mt-3 rounded-xl border border-rose-200/15 bg-rose-200/[0.04] px-4 py-3 text-xs text-rose-100/80">
                      Could not refresh run status: {pollingError}. The page will retry automatically.
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {hasResult && activeJob && <ResultsPanel job={activeJob} onReset={handleReset} />}
          </section>
        )}
      </main>

      {!activeJobs.length && (
        <footer className="relative z-10 border-t border-white/[0.06]">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-5 text-[10px] text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <span>Designed for careful cleanup, record integrity, and transparent review.</span>
            <span className="inline-flex items-center gap-1.5"><LockKeyhole className="h-3 w-3" /> Original uploads are never modified in place</span>
          </div>
        </footer>
      )}
    </div>
  );
}

function FeatureLine({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-cyan-200/20 bg-cyan-200/[0.06] text-cyan-100">{icon}</span>
      <div>
        <p className="text-xs font-medium text-slate-200">{title}</p>
        <p className="mt-1 text-[11px] leading-5 text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

function WorkflowCard({ number, title, text, icon }: { number: string; title: string; text: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 transition hover:border-cyan-200/15 hover:bg-white/[0.04]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono tracking-widest text-slate-600">{number}</span>
        <span className="text-cyan-200/70">{icon}</span>
      </div>
      <h3 className="mt-4 text-sm font-semibold text-slate-100">{title}</h3>
      <p className="mt-1.5 text-xs leading-5 text-slate-500">{text}</p>
    </div>
  );
}
