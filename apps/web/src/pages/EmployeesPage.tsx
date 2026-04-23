import { useState } from "react";
import { Plus, Trash2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { useEmployees, useCreateEmployee, useDeleteEmployee } from "@/lib/queries";

export function EmployeesPage() {
  const { data: employees, isLoading } = useEmployees();
  const createMutation = useCreateEmployee();
  const deleteMutation = useDeleteEmployee();
  const [newName, setNewName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [search, setSearch] = useState("");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await createMutation.mutateAsync(newName.trim());
      setNewName("");
      setShowAddForm(false);
      toast.success("Employee added");
    } catch {
      toast.error("Failed to add employee");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Archive "${name}"? They will be excluded from matching.`)) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success(`"${name}" archived`);
    } catch {
      toast.error("Failed to archive employee");
    }
  };

  const filtered = employees?.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Employee Roster</h2>
          <p className="text-muted-foreground">
            {employees?.length ?? 0} active employees
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Employee
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAdd}
          className="flex items-center gap-2 rounded-lg border bg-card p-4"
        >
          <input
            type="text"
            placeholder="Employee name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
            autoFocus
          />
          <button
            type="submit"
            disabled={createMutation.isPending || !newName.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Add"
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAddForm(false);
              setNewName("");
            }}
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
          placeholder="Search employees..."
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
          {search ? "No employees match your search" : "No employees yet. Add one to get started."}
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Added</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered?.map((emp) => (
                <tr key={emp.id} className="border-b last:border-0">
                  <td className="px-4 py-3 text-sm font-medium">{emp.name}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(emp.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(emp.id, emp.name)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Archive
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
