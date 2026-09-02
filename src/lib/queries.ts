import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "./api";
import type { TripPayload, VehiclePayload } from "./types";

export const keys = {
  health: ["health"] as const,
  vehicles: ["vehicles"] as const,
  settings: ["settings"] as const,
  trips: (params: { vehicleId?: string; fromDate?: string; toDate?: string }) => ["trips", params] as const,
  report: (params: { vehicleId: string; fromDate: string; toDate: string }) => ["report", params] as const,
};

function fail(error: unknown, fallback: string) {
  toast.error(error instanceof ApiError ? error.message : fallback);
}

export function useHealth() {
  return useQuery({
    queryKey: keys.health,
    queryFn: api.health,
    retry: false,
    refetchInterval: 60_000,
  });
}

export function useVehicles() {
  return useQuery({ queryKey: keys.vehicles, queryFn: api.listVehicles, retry: false });
}

export function useSettings() {
  return useQuery({ queryKey: keys.settings, queryFn: api.getSettings, retry: false });
}

export function useTrips(params: { vehicleId?: string; fromDate?: string; toDate?: string }, enabled = true) {
  return useQuery({
    queryKey: keys.trips(params),
    queryFn: () => api.listTrips(params),
    retry: false,
    enabled,
  });
}

export function useReport(params: { vehicleId: string; fromDate: string; toDate: string }, enabled = true) {
  return useQuery({
    queryKey: keys.report(params),
    queryFn: () => api.report(params),
    retry: false,
    enabled,
  });
}

function useInvalidateAll() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["trips"] });
    void qc.invalidateQueries({ queryKey: ["report"] });
    void qc.invalidateQueries({ queryKey: keys.vehicles });
    void qc.invalidateQueries({ queryKey: keys.settings });
  };
}

export function useSaveVehicle() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: string | undefined; payload: VehiclePayload }) =>
      id ? api.updateVehicle(id, payload) : api.createVehicle(payload),
    onSuccess: (_data, vars) => {
      invalidate();
      toast.success(vars.id ? "Vehicle updated" : "Vehicle added");
    },
    onError: (e) => fail(e, "Could not save the vehicle"),
  });
}

export function useDeleteVehicle() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api.deleteVehicle(id),
    onSuccess: (data) => {
      invalidate();
      toast.success(`Vehicle deleted${data.deletedTrips ? ` with ${data.deletedTrips} trip(s)` : ""}`);
    },
    onError: (e) => fail(e, "Could not delete the vehicle"),
  });
}

export function useSaveTrip() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: string | undefined; payload: TripPayload }) =>
      id ? api.updateTrip(id, payload) : api.createTrip(payload),
    onSuccess: (_data, vars) => {
      invalidate();
      toast.success(vars.id ? "Trip updated" : "Trip saved");
    },
    onError: (e) => fail(e, "Could not save the trip"),
  });
}

export function useDeleteTrip() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api.deleteTrip(id),
    onSuccess: () => {
      invalidate();
      toast.success("Trip deleted");
    },
    onError: (e) => fail(e, "Could not delete the trip"),
  });
}

export function useSaveSettings() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (payload: { appName: string; currency: string; defaultVehicleId: string | null }) =>
      api.updateSettings(payload),
    onSuccess: () => {
      invalidate();
      toast.success("Settings saved");
    },
    onError: (e) => fail(e, "Could not save settings"),
  });
}
