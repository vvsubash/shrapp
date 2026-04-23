import { useState, useRef } from "react";
import { Plus, Trash2, Loader2, Search, ChevronRight, Building2, MapPin, Clock, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  useFirms,
  useCreateFirm,
  useDeleteFirm,
  useBulkImportFirms,
  usePoints,
  useCreatePoint,
  useDeletePoint,
  useShifts,
  useCreateShift,
  useDeleteShift,
} from "@/lib/queries";

const CSV_TEMPLATE = `firm_name,point_name,point_type,parent_point_name,shift_duration_hours,shift_names
Acme Industries,Main Gate,nodal,,12,Day Shift;Night Shift
Acme Industries,Parking Lot B,normal,Main Gate,,
Acme Industries,Warehouse,nodal,,8,Morning;Afternoon;Night
Beta Corp,Front Entrance,nodal,,12,Day;Night
`;

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "firms_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function FirmsPage() {
  const { data: firms, isLoading } = useFirms();
  const createFirmMutation = useCreateFirm();
  const deleteFirmMutation = useDeleteFirm();
  const bulkImportMutation = useBulkImportFirms();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newFirmName, setNewFirmName] = useState("");
  const [showAddFirm, setShowAddFirm] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedFirmId, setSelectedFirmId] = useState<string | null>(null);

  const handleAddFirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirmName.trim()) return;
    try {
      await createFirmMutation.mutateAsync(newFirmName.trim());
      setNewFirmName("");
      setShowAddFirm(false);
      toast.success("Firm added");
    } catch {
      toast.error("Failed to add firm");
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await bulkImportMutation.mutateAsync(file);
      toast.success(
        `Imported ${result.firms_created} firm(s), ${result.points_created} point(s), ${result.shifts_created} shift(s)`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk import failed");
    }
    // Reset file input so the same file can be re-uploaded
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDeleteFirm = async (id: string, name: string) => {
    if (!confirm(`Archive "${name}"?`)) return;
    try {
      await deleteFirmMutation.mutateAsync(id);
      if (selectedFirmId === id) setSelectedFirmId(null);
      toast.success(`"${name}" archived`);
    } catch {
      toast.error("Failed to archive firm");
    }
  };

  const filtered = firms?.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Firms & Points</h2>
          <p className="text-muted-foreground">
            {firms?.length ?? 0} firm{firms?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
          >
            <Download className="h-4 w-4" />
            CSV Template
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={bulkImportMutation.isPending}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent disabled:opacity-50"
          >
            {bulkImportMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Bulk Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleBulkUpload}
            className="hidden"
          />
          <button
            onClick={() => setShowAddFirm(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add Firm
          </button>
        </div>
      </div>

      {showAddFirm && (
        <form
          onSubmit={handleAddFirm}
          className="flex items-center gap-2 rounded-lg border bg-card p-4"
        >
          <input
            type="text"
            placeholder="Firm name"
            value={newFirmName}
            onChange={(e) => setNewFirmName(e.target.value)}
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
            autoFocus
          />
          <button
            type="submit"
            disabled={createFirmMutation.isPending || !newFirmName.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {createFirmMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
          </button>
          <button
            type="button"
            onClick={() => { setShowAddFirm(false); setNewFirmName(""); }}
            className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
          >
            Cancel
          </button>
        </form>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search firms..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered?.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          {search ? "No firms match your search" : "No firms yet. Add one to get started."}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered?.map((firm) => (
            <div key={firm.id} className="rounded-lg border bg-card">
              <button
                onClick={() => setSelectedFirmId(selectedFirmId === firm.id ? null : firm.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/50"
              >
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 text-sm font-medium">{firm.name}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(firm.createdAt).toLocaleDateString()}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteFirm(firm.id, firm.name); }}
                  className="rounded p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <ChevronRight
                  className={`h-4 w-4 text-muted-foreground transition-transform ${selectedFirmId === firm.id ? "rotate-90" : ""}`}
                />
              </button>
              {selectedFirmId === firm.id && (
                <PointsPanel firmId={firm.id} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PointsPanel({ firmId }: { firmId: string }) {
  const { data: points, isLoading } = usePoints(firmId);
  const createPointMutation = useCreatePoint();
  const deletePointMutation = useDeletePoint();
  const [showAddPoint, setShowAddPoint] = useState(false);
  const [pointName, setPointName] = useState("");
  const [parentPointId, setParentPointId] = useState<string | null>(null);
  const [shiftDuration, setShiftDuration] = useState<8 | 12>(12);

  const nodalPoints = points?.filter((p) => p.parentPointId === null) ?? [];
  const normalPoints = points?.filter((p) => p.parentPointId !== null) ?? [];

  const handleAddPoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pointName.trim()) return;
    try {
      await createPointMutation.mutateAsync({
        firm_id: firmId,
        name: pointName.trim(),
        parent_point_id: parentPointId,
        shift_duration_hours: parentPointId ? null : shiftDuration,
      });
      setPointName("");
      setShowAddPoint(false);
      setParentPointId(null);
      toast.success("Point added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add point");
    }
  };

  const handleDeletePoint = async (id: string, name: string) => {
    if (!confirm(`Delete point "${name}"?`)) return;
    try {
      await deletePointMutation.mutateAsync(id);
      toast.success(`"${name}" deleted`);
    } catch {
      toast.error("Failed to delete point");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center border-t px-4 py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="border-t px-4 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase text-muted-foreground">Points</span>
        <button
          onClick={() => setShowAddPoint(true)}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary hover:bg-accent"
        >
          <Plus className="h-3 w-3" />
          Add Point
        </button>
      </div>

      {showAddPoint && (
        <form onSubmit={handleAddPoint} className="space-y-2 rounded-md border bg-muted/30 p-3">
          <input
            type="text"
            placeholder="Point name"
            value={pointName}
            onChange={(e) => setPointName(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            autoFocus
          />
          <div className="flex items-center gap-3">
            <select
              value={parentPointId ?? ""}
              onChange={(e) => setParentPointId(e.target.value || null)}
              className="flex-1 rounded-md border bg-background px-2 py-1.5 text-sm"
            >
              <option value="">Nodal point (top-level)</option>
              {nodalPoints.map((p) => (
                <option key={p.id} value={p.id}>Under: {p.name}</option>
              ))}
            </select>
            {!parentPointId && (
              <select
                value={shiftDuration}
                onChange={(e) => setShiftDuration(Number(e.target.value) as 8 | 12)}
                className="rounded-md border bg-background px-2 py-1.5 text-sm"
              >
                <option value={12}>12h shifts</option>
                <option value={8}>8h shifts</option>
              </select>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createPointMutation.isPending || !pointName.trim()}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {createPointMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
            </button>
            <button
              type="button"
              onClick={() => { setShowAddPoint(false); setPointName(""); setParentPointId(null); }}
              className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {nodalPoints.length === 0 && !showAddPoint ? (
        <p className="py-4 text-center text-xs text-muted-foreground">No points yet</p>
      ) : (
        <div className="space-y-1">
          {nodalPoints.map((nodal) => {
            const children = normalPoints.filter((p) => p.parentPointId === nodal.id);
            return (
              <NodalPointItem
                key={nodal.id}
                nodal={nodal}
                children={children}
                onDelete={handleDeletePoint}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function NodalPointItem({
  nodal,
  children,
  onDelete,
}: {
  nodal: { id: string; name: string; shiftDurationHours: number | null };
  children: { id: string; name: string }[];
  onDelete: (id: string, name: string) => void;
}) {
  const { data: shifts } = useShifts(nodal.id);
  const createShiftMutation = useCreateShift();
  const deleteShiftMutation = useDeleteShift();
  const [showAddShift, setShowAddShift] = useState(false);
  const [shiftName, setShiftName] = useState("");

  const handleAddShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftName.trim()) return;
    try {
      await createShiftMutation.mutateAsync({ point_id: nodal.id, name: shiftName.trim() });
      setShiftName("");
      setShowAddShift(false);
      toast.success("Shift added");
    } catch {
      toast.error("Failed to add shift");
    }
  };

  return (
    <div className="rounded-md border bg-background">
      <div className="flex items-center gap-2 px-3 py-2">
        <MapPin className="h-3.5 w-3.5 text-primary" />
        <span className="flex-1 text-sm font-medium">{nodal.name}</span>
        {nodal.shiftDurationHours && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {nodal.shiftDurationHours}h
          </span>
        )}
        <button
          onClick={() => onDelete(nodal.id, nodal.name)}
          className="rounded p-0.5 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* Shifts */}
      <div className="border-t px-3 py-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase text-muted-foreground">Shifts</span>
          <button
            onClick={() => setShowAddShift(true)}
            className="text-[10px] text-primary hover:underline"
          >
            + Add
          </button>
        </div>
        {showAddShift && (
          <form onSubmit={handleAddShift} className="mt-1 flex items-center gap-1">
            <input
              type="text"
              placeholder="Shift name"
              value={shiftName}
              onChange={(e) => setShiftName(e.target.value)}
              className="flex-1 rounded border bg-background px-2 py-1 text-xs"
              autoFocus
            />
            <button
              type="submit"
              disabled={createShiftMutation.isPending || !shiftName.trim()}
              className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => { setShowAddShift(false); setShiftName(""); }}
              className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
            >
              Cancel
            </button>
          </form>
        )}
        <div className="mt-1 flex flex-wrap gap-1">
          {shifts?.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
              <Clock className="h-2.5 w-2.5" />
              {s.name}
              <button
                onClick={() => deleteShiftMutation.mutate(s.id)}
                className="ml-0.5 text-muted-foreground hover:text-destructive"
              >
                &times;
              </button>
            </span>
          ))}
          {!shifts?.length && !showAddShift && (
            <span className="text-xs text-muted-foreground">No shifts defined</span>
          )}
        </div>
      </div>

      {/* Child points */}
      {children.length > 0 && (
        <div className="border-t px-3 py-1.5">
          <span className="text-[10px] font-medium uppercase text-muted-foreground">Sub-points</span>
          <div className="mt-1 space-y-1">
            {children.map((child) => (
              <div key={child.id} className="flex items-center gap-2 rounded bg-muted/50 px-2 py-1">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                <span className="flex-1 text-xs">{child.name}</span>
                <button
                  onClick={() => onDelete(child.id, child.name)}
                  className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
