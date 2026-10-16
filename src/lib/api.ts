import { supabase } from "@/integrations/supabase/client";
import { sumOtherExpenses, totalExpenseOf } from "./calc";
import type {
  AppSettings,
  OtherExpenseItem,
  ReportPayload,
  ReportRow,
  Trip,
  TripPayload,
  Vehicle,
  VehiclePayload,
} from "./types";
import { ALL_VEHICLES } from "./types";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

function sanitizeString(input: string, maxLength = 255): string {
  return (input || "").trim().slice(0, maxLength).replace(/[<>]/g, "");
}

function sanitizeEmail(input: string): string {
  return sanitizeString(input).toLowerCase().slice(0, 255);
}

function sanitizeNumber(input: string, maxLength = 20): string {
  return (input || "").trim().replace(/\D/g, "").slice(0, maxLength);
}

export { sanitizeString, sanitizeEmail, sanitizeNumber };

async function getAuthenticatedUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return null;
  }
  return user;
}

/* ---------------- Real Database Backend Request Pipeline ---------------- */

export function getApiBaseUrl(): string {
  const envUrl =
    import.meta.env["VITE_API_URL"] ||
    (typeof process !== "undefined" && process?.env ? process.env["VITE_API_URL"] : "");
  if (envUrl) return envUrl.trim().replace(/\/+$/, "");
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

export function setApiBaseUrl(_url: string): void {
  // Configured automatically via environment or window origin
}

async function requestBackend<T>(path: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = baseUrl ? `${baseUrl.replace(/\/+$/, "")}${path}` : path;

  let token = "";
  try {
    const sessionRes = await (
      supabase.auth as unknown as {
        getSession?: () => Promise<{ data: { session?: { access_token?: string } } }>;
      }
    ).getSession?.();
    token = sessionRes?.data?.session?.access_token || "";
  } catch {
    /* ignore */
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      // The token is expired, malformed or was revoked — drop the local session
      // so the auth guard can send the user back to the sign-in screen.
      try {
        await supabase.auth.signOut();
      } catch {
        /* ignore */
      }
    }
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(
      err?.message || err?.error?.message || `Request failed with status ${res.status}`,
      res.status,
    );
  }

  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

/* ---------------- Strict Database-Only API ---------------- */

export const api = {
  health: async (): Promise<{ status: string; database: string; url?: string }> => {
    const baseUrl = getApiBaseUrl();
    const endpoint = baseUrl ? `${baseUrl.replace(/\/+$/, "")}/api/health` : "/api/health";
    try {
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const json = await res.json();
        return {
          status: "connected",
          database: json?.data?.database || "persistent-database",
          url: baseUrl || (typeof window !== "undefined" ? window.location?.origin : ""),
        };
      }
    } catch {
      /* fall through */
    }
    return { status: "error", database: "disconnected" };
  },

  listVehicles: async (): Promise<Vehicle[]> => {
    const user = await getAuthenticatedUser();
    if (!user) return [];

    const data = await requestBackend<Vehicle[]>("/api/vehicles");
    if (!Array.isArray(data)) {
      throw new ApiError("Invalid response from database", 500);
    }
    return data;
  },

  createVehicle: async (payload: VehiclePayload): Promise<Vehicle> => {
    const user = await getAuthenticatedUser();
    if (!user) throw new ApiError("Authentication required", 401);

    const created = await requestBackend<Vehicle>("/api/vehicles", {
      method: "POST",
      body: JSON.stringify({
        name: sanitizeString(payload.name),
        type: sanitizeString(payload.type),
        model: sanitizeString(payload.model ?? ""),
        vehicleNumber: sanitizeString(payload.vehicleNumber ?? ""),
        notes: sanitizeString(payload.notes ?? ""),
        isActive: payload.isActive ?? true,
      }),
    });
    return created;
  },

  updateVehicle: async (id: string, payload: VehiclePayload): Promise<Vehicle> => {
    const user = await getAuthenticatedUser();
    if (!user) throw new ApiError("Authentication required", 401);

    const updated = await requestBackend<Vehicle>(`/api/vehicles/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: sanitizeString(payload.name),
        type: sanitizeString(payload.type),
        model: sanitizeString(payload.model ?? ""),
        vehicleNumber: sanitizeString(payload.vehicleNumber ?? ""),
        notes: sanitizeString(payload.notes ?? ""),
        isActive: payload.isActive,
      }),
    });
    return updated;
  },

  deleteVehicle: async (id: string): Promise<{ deletedTrips: number }> => {
    const user = await getAuthenticatedUser();
    if (!user) throw new ApiError("Authentication required", 401);

    const res = await requestBackend<{ deletedTrips: number }>(`/api/vehicles/${id}`, {
      method: "DELETE",
    });
    return res;
  },

  toggleVehicleStatus: async (id: string, isActive: boolean): Promise<void> => {
    const user = await getAuthenticatedUser();
    if (!user) throw new ApiError("Authentication required", 401);

    await requestBackend(`/api/vehicles/${id}`, {
      method: "PUT",
      body: JSON.stringify({ isActive }),
    });
  },

  listTrips: async (
    params: {
      vehicleId?: string;
      fromDate?: string;
      toDate?: string;
    } = {},
  ): Promise<Trip[]> => {
    const user = await getAuthenticatedUser();
    if (!user) return [];

    const query = new URLSearchParams();
    if (params.vehicleId && params.vehicleId !== ALL_VEHICLES) {
      query.set("vehicleId", params.vehicleId);
    }
    if (params.fromDate) query.set("fromDate", params.fromDate);
    if (params.toDate) query.set("toDate", params.toDate);

    const qs = query.toString();
    const path = qs ? `/api/trips?${qs}` : "/api/trips";
    const data = await requestBackend<Trip[]>(path);
    if (!Array.isArray(data)) {
      throw new ApiError("Invalid response from database", 500);
    }
    return data;
  },

  createTrip: async (payload: TripPayload): Promise<Trip> => {
    const user = await getAuthenticatedUser();
    if (!user) throw new ApiError("Authentication required", 401);

    const items: OtherExpenseItem[] = (payload.otherExpenseItems || [])
      .filter((i) => i.name.trim() || Number(i.amount) > 0)
      .map((i) => ({ name: sanitizeString(i.name), amount: Number(i.amount) || 0 }));

    const created = await requestBackend<Trip>("/api/trips", {
      method: "POST",
      body: JSON.stringify({
        vehicleId: payload.vehicleId,
        date: payload.date,
        income: Number(payload.income) || 0,
        diesel: Number(payload.diesel) || 0,
        driverPayment: Number(payload.driverPayment) || 0,
        emiShare: Number(payload.emiShare) || 0,
        otherExpenseItems: items,
        otherExpenses: sumOtherExpenses(items),
        notes: sanitizeString(payload.notes ?? ""),
      }),
    });
    return created;
  },

  updateTrip: async (id: string, payload: TripPayload): Promise<Trip> => {
    const user = await getAuthenticatedUser();
    if (!user) throw new ApiError("Authentication required", 401);

    const items: OtherExpenseItem[] = (payload.otherExpenseItems || [])
      .filter((i) => i.name.trim() || Number(i.amount) > 0)
      .map((i) => ({ name: sanitizeString(i.name), amount: Number(i.amount) || 0 }));

    const updated = await requestBackend<Trip>(`/api/trips/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        vehicleId: payload.vehicleId,
        date: payload.date,
        income: Number(payload.income) || 0,
        diesel: Number(payload.diesel) || 0,
        driverPayment: Number(payload.driverPayment) || 0,
        emiShare: Number(payload.emiShare) || 0,
        otherExpenseItems: items,
        otherExpenses: sumOtherExpenses(items),
        notes: sanitizeString(payload.notes ?? ""),
      }),
    });
    return updated;
  },

  deleteTrip: async (id: string): Promise<{ _id: string }> => {
    const user = await getAuthenticatedUser();
    if (!user) throw new ApiError("Authentication required", 401);

    await requestBackend(`/api/trips/${id}`, { method: "DELETE" });
    return { _id: id };
  },

  report: async (params: {
    vehicleId: string;
    fromDate: string;
    toDate: string;
  }): Promise<ReportPayload> => {
    const [vehicles, trips] = await Promise.all([api.listVehicles(), api.listTrips(params)]);
    const names = new Map(
      vehicles.map((v) => [
        v._id,
        v.vehicleNumber ? `${v.type || v.name} · ${v.vehicleNumber}` : v.type || v.name,
      ]),
    );

    const rows: ReportRow[] = [...trips]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((t) => {
        const totalExpense = totalExpenseOf(t);
        return {
          ...t,
          vehicleName: names.get(t.vehicleId) ?? "Vehicle",
          totalExpense,
          profit: t.income - totalExpense,
        };
      });

    const summary = rows.reduce(
      (acc, r) => ({
        trips: acc.trips + 1,
        income: acc.income + r.income,
        diesel: acc.diesel + r.diesel,
        driverPayment: acc.driverPayment + r.driverPayment,
        otherExpenses: acc.otherExpenses + r.otherExpenses,
        emiShare: acc.emiShare + r.emiShare,
        totalExpense: acc.totalExpense + r.totalExpense,
        profit: acc.profit + r.profit,
      }),
      {
        trips: 0,
        income: 0,
        diesel: 0,
        driverPayment: 0,
        otherExpenses: 0,
        emiShare: 0,
        totalExpense: 0,
        profit: 0,
      },
    );

    const isAll = !params.vehicleId || params.vehicleId === ALL_VEHICLES;
    return {
      vehicleId: params.vehicleId,
      vehicleLabel: isAll ? "All vehicles" : (names.get(params.vehicleId) ?? "Selected vehicle"),
      fromDate: params.fromDate,
      toDate: params.toDate,
      summary,
      rows,
    };
  },

  getSettings: async (): Promise<AppSettings> => {
    const user = await getAuthenticatedUser();
    if (!user) throw new ApiError("Authentication required", 401);

    const data = await requestBackend<AppSettings>("/api/settings");
    if (!data || typeof data !== "object") {
      throw new ApiError("Invalid settings response from database", 500);
    }
    return data;
  },

  updateSettings: async (payload: {
    appName: string;
    transportationName: string;
    currency: string;
    defaultVehicleId: string | null;
    fullName: string;
    mobileNumber: string;
    businessName: string;
    address: string;
    contactNumber: string;
    businessEmail: string;
  }): Promise<AppSettings> => {
    const user = await getAuthenticatedUser();
    if (!user) throw new ApiError("Authentication required", 401);

    // No hardcoded business default: an empty name is resolved server-side
    // against THIS account's own saved value (then a generic app label), so a
    // new account can never inherit another account's transport name.
    const unifiedName = sanitizeString(
      payload.transportationName || payload.businessName || payload.appName,
    );

    const updated = await requestBackend<AppSettings>("/api/settings", {
      method: "PUT",
      body: JSON.stringify({
        appName: unifiedName,
        transportationName: unifiedName,
        businessName: unifiedName,
        currency: payload.currency || "INR",
        defaultVehicleId: payload.defaultVehicleId,
        fullName: sanitizeString(payload.fullName),
        mobileNumber: sanitizeNumber(payload.mobileNumber),
        address: sanitizeString(payload.address),
        contactNumber: sanitizeNumber(payload.contactNumber),
        businessEmail: sanitizeEmail(payload.businessEmail),
      }),
    });
    return updated;
  },
};
