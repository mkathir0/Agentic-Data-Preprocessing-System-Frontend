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
  retry_count?: number;
}

export interface ValidationCheck {
  category: string;
  name: string;
  passed: boolean;
  violations: number;
  details: string;
}

export interface EscalationFlag {
  column: string | null;
  reason: string;
  severity: "high" | "medium" | "low";
}

export interface BusinessRuleViolation {
  rule: string;
  violation_count: number;
  violation_pct: number;
  disposition: string;
  example: string | null;
}

export interface PanderaFailureCase {
  column: string;
  check: string;
  failure_case: string;
  violation_count: number;
}

export interface ColumnStats {
  null_count: number;
  null_pct: number;
  mean: number | null;
  std: number | null;
  min: number | null;
  max: number | null;
}

export interface StatsDiff {
  column: string;
  before: ColumnStats;
  after: ColumnStats;
  imputation_pct: number;
}

export interface GreatExpectationsSuite {
  expectation_suite_name: string;
  meta: Record<string, any>;
  expectations: Array<{
    expectation_type: string;
    kwargs: Record<string, any>;
  }>;
}

export interface ValidationReport {
  schema_checks: ValidationCheck[];
  range_checks: ValidationCheck[];
  cross_field_checks: ValidationCheck[];
  distributional_checks: ValidationCheck[];
  duplicate_checks: ValidationCheck[];
  format_checks: ValidationCheck[];
  regression_checks: ValidationCheck[];
  stats_diff: StatsDiff[];
  escalation_flags: EscalationFlag[];
  business_rule_violations: BusinessRuleViolation[];
  total_checks: number;
  total_passed: number;
  total_failed: number;
  overall_passed: boolean;
  new_nulls_introduced?: Record<string, number>;
  // 4D Quality Scores and Pandera validation
  data_quality_score_before?: number;
  data_quality_score_after?: number;
  score_improvement?: number;
  completeness_score?: number;
  validity_score?: number;
  uniqueness_score?: number;
  consistency_score?: number;
  pandera_schema_passed?: boolean;
  pandera_failure_count?: number;
  pandera_failure_cases?: PanderaFailureCase[];
  fuzzy_duplicate_clusters?: number;
  exact_duplicates_removed?: number;
  key_conflict_count?: number;
  key_conflicts?: any[];
  great_expectations_suite?: GreatExpectationsSuite | null;
}

export interface InsightsData {
  job_id: string;
  filename: string;
  profiler_data: any;
  plan_data: any;
  validation_report: ValidationReport | null;
  retry_count: number;
}

export async function uploadDataset(files: File[]): Promise<Job[]> {
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

/** Downloads JSON payload as a file (e.g. Great Expectations Suite) */
export function downloadJsonBlob(data: any, filename: string): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
