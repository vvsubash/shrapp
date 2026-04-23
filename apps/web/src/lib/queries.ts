import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchEmployees,
  createEmployee,
  deleteEmployee,
  fetchLocations,
  createLocation,
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
