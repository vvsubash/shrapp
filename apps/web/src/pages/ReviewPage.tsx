import { useReducer, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import { Loader2, Check, Trash2, Plus, AlertCircle, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { useExtraction, useEmployees, useLocations, useCommitExtraction, useCreateEmployee, useCreateLocation } from "@/lib/queries";
import type { ExtractionRow } from "@shrapp/shared";

interface RowState {
  row_id: string;
  row_num: number;
  name_raw: string;
  location_raw: string;
  action: "accept" | "correct" | "new" | "delete";
  employee_id: string | null;
  new_employee_name: string | null;
  location_id: string | null;
  new_location_name: string | null;
  confidence: number;
}

type Action =
  | { type: "SET_EMPLOYEE"; rowId: string; employeeId: string }
  | { type: "SET_NEW_EMPLOYEE"; rowId: string; name: string }
  | { type: "SET_LOCATION"; rowId: string; locationId: string }
  | { type: "SET_NEW_LOCATION"; rowId: string; name: string }
  | { type: "TOGGLE_DELETE"; rowId: string }
  | { type: "INIT"; rows: RowState[] };

function reducer(state: RowState[], action: Action): RowState[] {
  switch (action.type) {
    case "INIT":
      return action.rows;
    case "SET_EMPLOYEE":
      return state.map((r) =>
        r.row_id === action.rowId
          ? { ...r, employee_id: action.employeeId, new_employee_name: null, action: "correct" }
          : r,
      );
    case "SET_NEW_EMPLOYEE":
      return state.map((r) =>
        r.row_id === action.rowId
          ? { ...r, employee_id: null, new_employee_name: action.name, action: "new" }
          : r,
      );
    case "SET_LOCATION":
      return state.map((r) =>
        r.row_id === action.rowId ? { ...r, location_id: action.locationId, new_location_name: null } : r,
      );
    case "SET_NEW_LOCATION":
      return state.map((r) =>
        r.row_id === action.rowId ? { ...r, location_id: null, new_location_name: action.name } : r,
      );
    case "TOGGLE_DELETE":
      return state.map((r) =>
        r.row_id === action.rowId
          ? { ...r, action: r.action === "delete" ? "accept" : "delete" }
          : r,
      );
    default:
      return state;
  }
}

function initRows(extractionRows: ExtractionRow[]): RowState[] {
  return extractionRows.map((r) => ({
    row_id: r.row_id,
    row_num: r.row_num,
    name_raw: r.name_raw,
    location_raw: r.location_raw,
    action: r.auto_matched_employee_id ? "accept" : "accept",
    employee_id: r.auto_matched_employee_id,
    new_employee_name: null,
    location_id: r.suggested_location_id,
    new_location_name: r.is_new_location ? r.location_raw : null,
    confidence: r.suggested_matches[0]?.score ?? 0,
  }));
}

export function ReviewPage() {
  const { extractionId } = useParams<{ extractionId: string }>();
  const navigate = useNavigate();
  const { data: extraction, isLoading: extractionLoading } = useExtraction(extractionId!);
  const { data: employees } = useEmployees();
  const { data: locations } = useLocations();
  const commitMutation = useCommitExtraction();
  const createEmployeeMutation = useCreateEmployee();
  const createLocationMutation = useCreateLocation();

  const [rows, dispatch] = useReducer(reducer, []);
  const initialized = useMemo(() => {
    if (extraction && rows.length === 0 && extraction.rows.length > 0) {
      dispatch({ type: "INIT", rows: initRows(extraction.rows) });
      return true;
    }
    return rows.length > 0;
  }, [extraction, rows.length]);

  const unresolvedCount = useMemo(
    () => rows.filter((r) => r.action !== "delete" && !r.employee_id && !r.new_employee_name).length,
    [rows],
  );
  const committableCount = rows.filter((r) => r.action !== "delete").length;

  const handleCommit = async () => {
    if (!extractionId) return;
    try {
      const result = await commitMutation.mutateAsync({
        extraction_id: extractionId,
        rows: rows.map((r) => ({
          row_id: r.row_id,
          action: r.action,
          employee_id: r.employee_id ?? undefined,
          new_employee_name: r.new_employee_name ?? undefined,
          location_id: r.location_id ?? undefined,
          new_location_name: r.new_location_name ?? undefined,
        })),
      });
      toast.success(
        `Committed ${result.committed_count} attendance records` +
          (result.new_employees.length > 0
            ? `. ${result.new_employees.length} new employee(s) added.`
            : ""),
      );
      navigate("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Commit failed";
      if (msg.includes("409") || msg.includes("UNIQUE") || msg.includes("Duplicate")) {
        toast.error("Duplicate attendance records detected. Some employees already have entries for this date.");
      } else {
        toast.error(msg);
      }
    }
  };

  const handleAddEmployee = async (rowId: string) => {
    const row = rows.find((r) => r.row_id === rowId);
    if (!row) return;
    const name = prompt("Enter new employee name:", row.name_raw);
    if (!name?.trim()) return;
    try {
      const emp = await createEmployeeMutation.mutateAsync(name.trim());
      dispatch({ type: "SET_EMPLOYEE", rowId, employeeId: emp.id });
      toast.success(`"${emp.name}" added to roster`);
    } catch {
      toast.error("Failed to create employee");
    }
  };

  const handleAddLocation = async (rowId: string) => {
    const row = rows.find((r) => r.row_id === rowId);
    if (!row) return;
    const name = prompt("Enter new location name:", row.location_raw);
    if (!name?.trim()) return;
    try {
      const loc = await createLocationMutation.mutateAsync(name.trim());
      dispatch({ type: "SET_LOCATION", rowId, locationId: loc.id });
      toast.success(`"${loc.name}" added to locations`);
    } catch {
      toast.error("Failed to create location");
    }
  };

  if (extractionLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="mb-4 h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Loading extraction...</p>
      </div>
    );
  }

  if (!extraction) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        Extraction not found
      </div>
    );
  }

  if (extraction.status === "processing") {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="mb-4 h-10 w-10 animate-spin text-primary" />
        <p className="text-lg font-medium">AI is reading your register...</p>
        <p className="mt-2 text-sm text-muted-foreground">
          This usually takes 10-20 seconds. The page will update automatically.
        </p>
      </div>
    );
  }

  if (extraction.status === "failed") {
    return (
      <div className="space-y-4 py-20 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
        <p className="text-lg font-medium">Extraction failed</p>
        <p className="text-sm text-muted-foreground">
          {extraction.error_message || "An unexpected error occurred during AI processing."}
        </p>
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <RotateCw className="h-4 w-4" />
          Try Again
        </button>
      </div>
    );
  }

  if (!initialized) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="mb-4 h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Loading extraction...</p>
      </div>
    );
  }

  if (extraction.status === "committed") {
    return (
      <div className="space-y-4 py-20 text-center">
        <Check className="mx-auto h-12 w-12 text-green-500" />
        <p className="text-lg font-medium">This extraction has already been committed</p>
        <button
          onClick={() => navigate("/")}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Upload Another
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Review Extraction</h2>
        <p className="text-muted-foreground">
          Date: {extraction.work_date} &middot; {extraction.rows.length} rows extracted
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="w-12 px-3 py-3 text-center font-medium">#</th>
              <th className="px-3 py-3 text-left font-medium">Raw Name</th>
              <th className="px-3 py-3 text-left font-medium">Employee Match</th>
              <th className="px-3 py-3 text-left font-medium">Location</th>
              <th className="w-16 px-3 py-3 text-center font-medium">Conf.</th>
              <th className="w-16 px-3 py-3 text-center font-medium">Del</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const extractionRow = extraction.rows.find(
                (r) => r.row_id === row.row_id,
              );
              const isDeleted = row.action === "delete";

              return (
                <tr
                  key={row.row_id}
                  className={`border-b last:border-0 ${isDeleted ? "bg-muted/30 opacity-50" : ""}`}
                >
                  <td className="px-3 py-3 text-center text-muted-foreground">
                    {row.row_num}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">
                    {row.name_raw}
                  </td>
                  <td className="px-3 py-3">
                    {isDeleted ? (
                      <span className="text-muted-foreground">-</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <select
                          value={row.employee_id ?? ""}
                          onChange={(e) => {
                            if (e.target.value) {
                              dispatch({
                                type: "SET_EMPLOYEE",
                                rowId: row.row_id,
                                employeeId: e.target.value,
                              });
                            }
                          }}
                          className="w-full max-w-[200px] rounded border bg-background px-2 py-1 text-sm"
                        >
                          <option value="">Select employee...</option>
                          {extractionRow?.suggested_matches.map((m) => (
                            <option key={m.employee_id} value={m.employee_id}>
                              {m.name} ({Math.round(m.score * 100)}%)
                            </option>
                          ))}
                          <option disabled>---</option>
                          {employees?.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleAddEmployee(row.row_id)}
                          className="rounded p-1 text-muted-foreground hover:bg-accent"
                          title="Add new employee"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {isDeleted ? (
                      <span className="text-muted-foreground">-</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <select
                          value={row.location_id ?? ""}
                          onChange={(e) => {
                            if (e.target.value) {
                              dispatch({
                                type: "SET_LOCATION",
                                rowId: row.row_id,
                                locationId: e.target.value,
                              });
                            }
                          }}
                          className="w-full max-w-[180px] rounded border bg-background px-2 py-1 text-sm"
                        >
                          <option value="">Select location...</option>
                          {locations?.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleAddLocation(row.row_id)}
                          className="rounded p-1 text-muted-foreground hover:bg-accent"
                          title="Add new location"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <ConfidenceBadge score={row.confidence} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button
                      onClick={() =>
                        dispatch({ type: "TOGGLE_DELETE", rowId: row.row_id })
                      }
                      className={`rounded p-1 ${isDeleted ? "text-destructive" : "text-muted-foreground hover:text-destructive"}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Sticky bottom bar */}
      <div className="sticky bottom-0 flex items-center justify-between rounded-lg border bg-card px-4 py-3 shadow-lg">
        <div className="flex items-center gap-2 text-sm">
          {unresolvedCount > 0 && (
            <>
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <span className="text-amber-600">
                {unresolvedCount} row{unresolvedCount > 1 ? "s" : ""} need
                employee assignment
              </span>
            </>
          )}
        </div>
        <button
          onClick={handleCommit}
          disabled={unresolvedCount > 0 || committableCount === 0 || commitMutation.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {commitMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Committing...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Commit {committableCount} row{committableCount !== 1 ? "s" : ""}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function ConfidenceBadge({ score }: { score: number }) {
  if (score === 0) return <span className="text-xs text-muted-foreground">-</span>;
  const pct = Math.round(score * 100);
  const color =
    score >= 0.7
      ? "bg-green-100 text-green-800"
      : score >= 0.4
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-800";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {pct}%
    </span>
  );
}
