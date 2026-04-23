import type {
  Employee,
  WorkLocation,
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
