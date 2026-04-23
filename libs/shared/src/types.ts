import { z } from "zod";

// --- AI response shape ---
export const aiResponseRowSchema = z.object({
  row_num: z.number(),
  name_raw: z.string(),
  matched_name: z.string().nullable(),
  location_raw: z.string(),
  matched_location: z.string().nullable(),
});

export const aiResponseSchema = z.object({
  work_date: z.string(),
  rows: z.array(aiResponseRowSchema),
});

export type AiResponse = z.infer<typeof aiResponseSchema>;
export type AiResponseRow = z.infer<typeof aiResponseRowSchema>;

// --- Extraction status ---
export type ExtractionStatus = "processing" | "pending" | "committed" | "discarded" | "failed";

// --- API response: extraction ---
export interface SuggestedMatch {
  employee_id: string;
  name: string;
  score: number;
}

export interface ExtractionRow {
  row_id: string;
  row_num: number;
  name_raw: string;
  location_raw: string;
  suggested_matches: SuggestedMatch[];
  auto_matched_employee_id: string | null;
  suggested_location_id: string | null;
  is_new_location: boolean;
}

export interface ExtractionResponse {
  extraction_id: string;
  work_date: string;
  status: ExtractionStatus;
  rows: ExtractionRow[];
  error_message?: string;
}

// --- API request: commit ---
export const commitRowSchema = z.object({
  row_id: z.string(),
  action: z.enum(["accept", "correct", "new", "delete"]),
  employee_id: z.string().optional(),
  new_employee_name: z.string().optional(),
  location_id: z.string().optional(),
  new_location_name: z.string().optional(),
});

export const commitRequestSchema = z.object({
  extraction_id: z.string(),
  rows: z.array(commitRowSchema),
});

export type CommitRequest = z.infer<typeof commitRequestSchema>;
export type CommitRow = z.infer<typeof commitRowSchema>;

export interface CommitResponse {
  committed_count: number;
  new_employees: { id: string; name: string }[];
  new_locations: { id: string; name: string }[];
}

// --- API response: employees ---
export interface Employee {
  id: string;
  name: string;
  nameNormalized: string;
  createdAt: string;
  archivedAt: string | null;
}

export interface WorkLocation {
  id: string;
  name: string;
  nameNormalized: string;
  createdAt: string;
}

export const createEmployeeSchema = z.object({
  name: z.string().min(1).max(200),
});

export const createLocationSchema = z.object({
  name: z.string().min(1).max(200),
});

// --- Firms, Points, Shifts ---
export interface Firm {
  id: string;
  name: string;
  nameNormalized: string;
  createdAt: string;
  archivedAt: string | null;
}

export interface Point {
  id: string;
  firmId: string;
  parentPointId: string | null;
  name: string;
  nameNormalized: string;
  shiftDurationHours: number | null;
  createdAt: string;
}

export interface Shift {
  id: string;
  pointId: string;
  name: string;
  createdAt: string;
}

export const createFirmSchema = z.object({
  name: z.string().min(1).max(200),
});

export const createPointSchema = z.object({
  firm_id: z.string(),
  parent_point_id: z.string().nullable().optional(),
  name: z.string().min(1).max(200),
  shift_duration_hours: z.union([z.literal(8), z.literal(12)]).nullable().optional(),
});

export const createShiftSchema = z.object({
  point_id: z.string(),
  name: z.string().min(1).max(100),
});
