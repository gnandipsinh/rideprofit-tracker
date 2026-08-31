import type {
  AppSettings,
  ReportPayload,
  Trip,
  TripPayload,
  Vehicle,
  VehiclePayload,
} from "./types";

const STORAGE_KEY = "vcs.apiBaseUrl";

const ENV_BASE_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").trim();
export const DEFAULT_API_BASE_URL = ENV_BASE_URL || "http://localhost:4000/api";

/** Backend location is configuration (not application data), so it lives in the browser. */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && stored.trim()) return stored.trim().replace(/\/+$/, "");
  }
  return DEFAULT_API_BASE_URL.replace(/\/+$/, "");
}

export function setApiBaseUrl(url: string): void {
  if (typeof window === "undefined") return;
  const clean = url.trim().replace(/\/+$/, "");
  if (clean) window.localStorage.setItem(STORAGE_KEY, clean);
  else window.localStorage.removeItem(STORAGE_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(
      "Cannot reach the API server. Check the backend URL in Settings and that the server is running.",
    );
  }

  const text = await response.text();
  let body: ApiResponse<T> | null = null;
  try {
    body = text ? (JSON.parse(text) as ApiResponse<T>) : null;
  } catch {
    body = null;
  }

  if (!response.ok || !body?.success) {
    throw new ApiError(body?.message ?? `Request failed (${response.status})`, response.status);
  }
  return body.data;
}

function query(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const api = {
  health: () => request<{ status: string; database: string }>("/health"),

  listVehicles: () => request<Vehicle[]>("/vehicles"),
  createVehicle: (payload: VehiclePayload) =>
    request<Vehicle>("/vehicles", { method: "POST", body: JSON.stringify(payload) }),
  updateVehicle: (id: string, payload: VehiclePayload) =>
    request<Vehicle>(`/vehicles/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteVehicle: (id: string) =>
    request<{ deletedTrips: number }>(`/vehicles/${id}`, { method: "DELETE" }),

  listTrips: (params: { vehicleId?: string; fromDate?: string; toDate?: string }) =>
    request<Trip[]>(`/trips${query(params)}`),
  createTrip: (payload: TripPayload) =>
    request<Trip>("/trips", { method: "POST", body: JSON.stringify(payload) }),
  updateTrip: (id: string, payload: TripPayload) =>
    request<Trip>(`/trips/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteTrip: (id: string) => request<{ _id: string }>(`/trips/${id}`, { method: "DELETE" }),

  report: (params: { vehicleId: string; fromDate: string; toDate: string }) =>
    request<ReportPayload>(`/reports${query(params)}`),

  getSettings: () => request<AppSettings>("/settings"),
  updateSettings: (payload: { appName: string; currency: string; defaultVehicleId: string | null }) =>
    request<AppSettings>("/settings", { method: "PUT", body: JSON.stringify(payload) }),
};
