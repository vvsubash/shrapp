import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchEmployees,
  createEmployee,
  deleteEmployee,
  fetchLocations,
  createLocation,
  fetchFirms,
  createFirm,
  deleteFirm,
  bulkImportFirms,
  fetchPoints,
  createPoint,
  deletePoint,
  fetchShifts,
  createShift,
  deleteShift,
  fetchExtraction,
  commitExtraction,
  extractImage,
} from "./api";
import type { CommitRequest } from "@shrapp/shared";

// --- Employees ---
export function useEmployees() {
  return useQuery({
    queryKey: ["employees"],
    queryFn: fetchEmployees,
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createEmployee(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEmployee(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

// --- Locations ---
export function useLocations() {
  return useQuery({
    queryKey: ["locations"],
    queryFn: fetchLocations,
  });
}

export function useCreateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createLocation(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["locations"] }),
  });
}

// --- Firms ---
export function useFirms() {
  return useQuery({
    queryKey: ["firms"],
    queryFn: fetchFirms,
  });
}

export function useCreateFirm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createFirm(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["firms"] }),
  });
}

export function useDeleteFirm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteFirm(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["firms"] }),
  });
}

export function useBulkImportFirms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => bulkImportFirms(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["firms"] });
      qc.invalidateQueries({ queryKey: ["points"] });
      qc.invalidateQueries({ queryKey: ["shifts"] });
    },
  });
}

// --- Points ---
export function usePoints(firmId: string) {
  return useQuery({
    queryKey: ["points", firmId],
    queryFn: () => fetchPoints(firmId),
    enabled: !!firmId,
  });
}

export function useCreatePoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createPoint,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["points"] }),
  });
}

export function useDeletePoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePoint(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["points"] }),
  });
}

// --- Shifts ---
export function useShifts(pointId: string) {
  return useQuery({
    queryKey: ["shifts", pointId],
    queryFn: () => fetchShifts(pointId),
    enabled: !!pointId,
  });
}

export function useCreateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createShift,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["shifts", vars.point_id] });
    },
  });
}

export function useDeleteShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteShift(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
  });
}

// --- Extraction ---
export function useExtraction(id: string) {
  return useQuery({
    queryKey: ["extraction", id],
    queryFn: () => fetchExtraction(id),
    enabled: !!id,
    refetchInterval: (query) =>
      query.state.data?.status === "processing" ? 2000 : false,
  });
}

export function useExtractImage() {
  return useMutation({
    mutationFn: (image: Blob) => extractImage(image),
  });
}

export function useCommitExtraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CommitRequest) => commitExtraction(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["extraction"] });
    },
  });
}
