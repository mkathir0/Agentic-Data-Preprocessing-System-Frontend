const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "default_secret_key";

const authHeaders = { "X-API-Key": API_KEY };

export interface Job {
  id: string;
  filename: string;
  status: string; // PENDING, PROCESSING, COMPLETED, FAILED
  created_at: string;
  updated_at: string;
  progress: number;
  current_step: string | null;
  error_message: string | null;
  cleaning_plan: any | null;
}

export async function uploadDataset(files: File[]): Promise<Job> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("files", file); // Appending multiple files under 'files' key
  });
  const response = await fetch(`${API_BASE_URL}/jobs/upload`, { method: "POST", headers: authHeaders, body: formData });
  if (!response.ok) { const err = await response.text(); throw new Error(`Upload failed: ${err}`); }
  return response.json();
}

export async function getJobStatus(jobId: string): Promise<Job> {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, { method: "GET", headers: authHeaders });
  if (!response.ok) { const err = await response.text(); throw new Error(`Failed to fetch job status: ${err}`); }
  return response.json();
}

/** Fetches the markdown engineering report as a string */
export async function fetchReport(jobId: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/report`, { headers: authHeaders });
  if (!response.ok) throw new Error("Report not available");
  return response.text();
}

/** Fetches the cleaned CSV as raw text (for table preview) */
export async function fetchCleanedCsvText(jobId: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/download`, { headers: authHeaders });
  if (!response.ok) throw new Error("CSV not available");
  return response.text();
}

/** Downloads cleaned CSV via blob — required to inject X-API-Key header that window.location.href cannot send */
export async function downloadCleanedCsv(jobId: string, filename: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/download`, { headers: authHeaders });
  if (!response.ok) throw new Error("Download failed");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cleaned_${filename}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
