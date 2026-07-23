const API_BASE_URL = "http://localhost:8000/api";
const API_KEY = "default_secret_key"; // Matches backend default

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

export async function uploadDataset(file: File): Promise<Job> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/jobs/upload`, {
    method: "POST",
    headers: {
      "X-API-Key": API_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Upload failed: ${err}`);
  }

  return response.json();
}

export async function getJobStatus(jobId: string): Promise<Job> {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
    method: "GET",
    headers: {
      "X-API-Key": API_KEY,
    },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to fetch job status: ${err}`);
  }

  return response.json();
}

export function getDownloadUrl(jobId: string): string {
  return `${API_BASE_URL}/jobs/${jobId}/download`;
}
