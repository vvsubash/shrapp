import type {
  Employee,
  WorkLocation,
  Firm,
  Point,
  Shift,
  ExtractionResponse,
  CommitRequest,
  CommitResponse,
} from "@shrapp/shared";

const BASE = import.meta.env.VITE_API_URL ?? "";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, text);
  }
  return res.json();
}

// --- Employees ---
export async function fetchEmployees(): Promise<Employee[]> {
  const res = await fetch(`${BASE}/api/employees`);
  const data = await handleResponse<{ employees: Employee[] }>(res);
  return data.employees;
}

export async function createEmployee(name: string): Promise<Employee> {
  const res = await fetch(`${BASE}/api/employees`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const data = await handleResponse<{ employee: Employee }>(res);
  return data.employee;
}

export async function deleteEmployee(id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/employees/${id}`, { method: "DELETE" });
  if (!res.ok) throw new ApiError(res.status, await res.text());
}

// --- Locations ---
export async function fetchLocations(): Promise<WorkLocation[]> {
  const res = await fetch(`${BASE}/api/locations`);
  const data = await handleResponse<{ locations: WorkLocation[] }>(res);
  return data.locations;
}

export async function createLocation(name: string): Promise<WorkLocation> {
  const res = await fetch(`${BASE}/api/locations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const data = await handleResponse<{ location: WorkLocation }>(res);
  return data.location;
}

// --- Firms ---
export async function fetchFirms(): Promise<Firm[]> {
  const res = await fetch(`${BASE}/api/firms`);
  const data = await handleResponse<{ firms: Firm[] }>(res);
  return data.firms;
}

export async function createFirm(name: string): Promise<Firm> {
  const res = await fetch(`${BASE}/api/firms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const data = await handleResponse<{ firm: Firm }>(res);
  return data.firm;
}

export async function deleteFirm(id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/firms/${id}`, { method: "DELETE" });
  if (!res.ok) throw new ApiError(res.status, await res.text());
}

// --- Points ---
export async function fetchPoints(firmId: string): Promise<Point[]> {
  const res = await fetch(`${BASE}/api/firms/${firmId}/points`);
  const data = await handleResponse<{ points: Point[] }>(res);
  return data.points;
}

export async function createPoint(data: {
  firm_id: string;
  name: string;
  parent_point_id?: string | null;
  shift_duration_hours?: 8 | 12 | null;
}): Promise<Point> {
  const res = await fetch(`${BASE}/api/points`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await handleResponse<{ point: Point }>(res);
  return result.point;
}

export async function deletePoint(id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/points/${id}`, { method: "DELETE" });
  if (!res.ok) throw new ApiError(res.status, await res.text());
}

// --- Shifts ---
export async function fetchShifts(pointId: string): Promise<Shift[]> {
  const res = await fetch(`${BASE}/api/points/${pointId}/shifts`);
  const data = await handleResponse<{ shifts: Shift[] }>(res);
  return data.shifts;
}

export async function createShift(data: { point_id: string; name: string }): Promise<Shift> {
  const res = await fetch(`${BASE}/api/shifts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await handleResponse<{ shift: Shift }>(res);
  return result.shift;
}

export async function deleteShift(id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/shifts/${id}`, { method: "DELETE" });
  if (!res.ok) throw new ApiError(res.status, await res.text());
}

// --- Extraction ---
export async function extractImage(image: Blob): Promise<ExtractionResponse> {
  const fd = new FormData();
  fd.append("image", image, "attendance.jpg");
  const res = await fetch(`${BASE}/api/extract`, { method: "POST", body: fd });
  return handleResponse<ExtractionResponse>(res);
}

export async function fetchExtraction(id: string): Promise<ExtractionResponse> {
  const res = await fetch(`${BASE}/api/extractions/${id}`);
  return handleResponse<ExtractionResponse>(res);
}

// --- Commit ---
export async function commitExtraction(data: CommitRequest): Promise<CommitResponse> {
  const res = await fetch(`${BASE}/api/commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<CommitResponse>(res);
}
