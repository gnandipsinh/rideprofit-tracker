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

/* ---------------- Real User Data Storage & Cloud Synchronization ---------------- */

const VEHICLES_PREFIX = "vcs.data.vehicles.";
const TRIPS_PREFIX = "vcs.data.trips.";
const SETTINGS_PREFIX = "vcs.data.settings.";
const BACKEND_URL_KEY = "vcs.config.api_url";

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const custom = window.localStorage.getItem(BACKEND_URL_KEY);
    if (custom) return custom.trim().replace(/\/+$/, "");
  }
  const envUrl =
    import.meta.env["VITE_API_URL"] ||
    (typeof process !== "undefined" && process?.env ? process.env["VITE_API_URL"] : "");
  return (envUrl || "").trim().replace(/\/+$/, "");
}

export function setApiBaseUrl(url: string): void {
  if (typeof window === "undefined") return;
  if (!url) {
    window.localStorage.removeItem(BACKEND_URL_KEY);
  } else {
    window.localStorage.setItem(BACKEND_URL_KEY, url.trim().replace(/\/+$/, ""));
  }
}

export interface UserDataBackup {
  version: 1;
  exportDate: string;
  userId: string;
  email?: string;
  vehicles: Vehicle[];
  trips: Trip[];
  settings: AppSettings;
}

export function exportLocalUserData(userId: string): UserDataBackup {
  return {
    version: 1,
    exportDate: new Date().toISOString(),
    userId,
    vehicles: getUserVehicles(userId),
    trips: getUserTrips(userId),
    settings: getUserSettings(userId),
  };
}

export function importLocalUserData(
  targetUserId: string,
  backup: Partial<UserDataBackup>,
): { importedVehicles: number; importedTrips: number } {
  const existingVehicles = getUserVehicles(targetUserId);
  const existingTrips = getUserTrips(targetUserId);

  const vehicleIdMap = new Map<string, string>(); // oldId -> newId
  const newVehicles: Vehicle[] = [...existingVehicles];

  if (Array.isArray(backup.vehicles)) {
    for (const v of backup.vehicles) {
      const match = existingVehicles.find(
        (ev) =>
          ev._id === v._id ||
          (ev.vehicleNumber && v.vehicleNumber && ev.vehicleNumber === v.vehicleNumber),
      );
      if (match) {
        vehicleIdMap.set(v._id, match._id);
      } else {
        const freshId = v._id || generateEntityId("veh");
        vehicleIdMap.set(v._id, freshId);
        newVehicles.push({
          _id: freshId,
          name: sanitizeString(v.name),
          type: sanitizeString(v.type),
          model: sanitizeString(v.model ?? ""),
          vehicleNumber: sanitizeString(v.vehicleNumber ?? ""),
          notes: sanitizeString(v.notes ?? ""),
          isActive: v.isActive ?? true,
          createdAt: v.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }
    setUserVehicles(targetUserId, newVehicles);
  }

  const newTrips: Trip[] = [...existingTrips];
  if (Array.isArray(backup.trips)) {
    for (const t of backup.trips) {
      const mappedVehId = vehicleIdMap.get(t.vehicleId) || t.vehicleId;
      const match = existingTrips.find(
        (et) =>
          et._id === t._id ||
          (et.vehicleId === mappedVehId && et.date === t.date && et.income === t.income),
      );
      if (!match) {
        const items: OtherExpenseItem[] = (t.otherExpenseItems || []).map((i) => ({
          name: sanitizeString(i.name),
          amount: Number(i.amount) || 0,
        }));
        newTrips.push({
          _id: t._id || generateEntityId("trip"),
          vehicleId: mappedVehId,
          date: t.date,
          income: Number(t.income) || 0,
          diesel: Number(t.diesel) || 0,
          driverPayment: Number(t.driverPayment) || 0,
          emiShare: Number(t.emiShare) || 0,
          otherExpenseItems: items,
          otherExpenses: t.otherExpenses || sumOtherExpenses(items),
          notes: sanitizeString(t.notes ?? ""),
          createdAt: t.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }
    setUserTrips(targetUserId, newTrips);
  }

  if (backup.settings) {
    const current = getUserSettings(targetUserId);
    setUserSettings(targetUserId, {
      ...current,
      ...backup.settings,
      updatedAt: new Date().toISOString(),
    });
  }

  return {
    importedVehicles: newVehicles.length - existingVehicles.length,
    importedTrips: newTrips.length - existingTrips.length,
  };
}

function generateEntityId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getUserVehicles(userId: string): Vehicle[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(VEHICLES_PREFIX + userId);
    return raw ? (JSON.parse(raw) as Vehicle[]) : [];
  } catch {
    return [];
  }
}

export function setUserVehicles(userId: string, list: Vehicle[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VEHICLES_PREFIX + userId, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function getUserTrips(userId: string): Trip[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TRIPS_PREFIX + userId);
    return raw ? (JSON.parse(raw) as Trip[]) : [];
  } catch {
    return [];
  }
}

export function setUserTrips(userId: string, list: Trip[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TRIPS_PREFIX + userId, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function getUserSettings(
  userId: string,
  userMeta?: Record<string, unknown>,
  userEmail?: string,
): AppSettings {
  const realFullName =
    typeof userMeta?.["full_name"] === "string" ? userMeta["full_name"].trim() : "";
  const realMobile = typeof userMeta?.["mobile"] === "string" ? userMeta["mobile"].trim() : "";
  const realEmail = userEmail || "";

  const defaultProfile: AppSettings = {
    _id: "settings_" + userId,
    appName: realFullName ? `${realFullName}'s Fleet` : "Vehicle Calculation System",
    transportationName: realFullName ? `${realFullName}'s Transport` : "",
    currency: "INR",
    defaultVehicleId: null,
    fullName: realFullName,
    mobileNumber: realMobile,
    businessName: realFullName ? `${realFullName} Logistics` : "",
    address: "",
    contactNumber: realMobile,
    businessEmail: realEmail,
    updatedAt: new Date().toISOString(),
  };

  if (typeof window === "undefined") return defaultProfile;
  try {
    const raw = window.localStorage.getItem(SETTINGS_PREFIX + userId);
    if (!raw) {
      window.localStorage.setItem(SETTINGS_PREFIX + userId, JSON.stringify(defaultProfile));
      return defaultProfile;
    }
    const saved = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...defaultProfile,
      ...saved,
      fullName: saved.fullName || realFullName,
      mobileNumber: saved.mobileNumber || realMobile,
      businessEmail: saved.businessEmail || realEmail,
    };
  } catch {
    return defaultProfile;
  }
}

export function setUserSettings(userId: string, settings: AppSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SETTINGS_PREFIX + userId, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

async function requestBackend<T>(path: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) throw new Error("No backend API configured");

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

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(err.message || `Request failed with status ${res.status}`, res.status);
  }

  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

/* ---------------- API Object ---------------- */

export const api = {
  health: async (): Promise<{ status: string; database: string; url?: string }> => {
    const baseUrl = getApiBaseUrl();
    if (baseUrl) {
      try {
        const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          const json = await res.json();
          return {
            status: "connected",
            database: json?.data?.database || "connected",
            url: baseUrl,
          };
        }
      } catch {
        /* fall through to local status */
      }
    }
    return { status: "local", database: "browser-storage" };
  },

  listVehicles: async (): Promise<Vehicle[]> => {
    const user = await getAuthenticatedUser();
    if (!user) return [];

    const baseUrl = getApiBaseUrl();
    if (baseUrl) {
      try {
        const data = await requestBackend<Vehicle[]>("/api/vehicles");
        if (Array.isArray(data)) {
          setUserVehicles(user.id, data);
          return data;
        }
      } catch (e) {
        console.warn("[api] listVehicles fallback to local cache:", e);
      }
    }

    return getUserVehicles(user.id);
  },

  createVehicle: async (payload: VehiclePayload): Promise<Vehicle> => {
    const user = await getAuthenticatedUser();
    if (!user) throw new ApiError("Authentication required", 401);

    const baseUrl = getApiBaseUrl();
    if (baseUrl) {
      try {
        const created = await requestBackend<Vehicle>("/api/vehicles", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        const list = getUserVehicles(user.id);
        list.push(created);
        setUserVehicles(user.id, list);
        return created;
      } catch (e) {
        console.warn("[api] createVehicle fallback to local storage:", e);
      }
    }

    const list = getUserVehicles(user.id);
    const now = new Date().toISOString();
    const newVehicle: Vehicle = {
      _id: generateEntityId("veh"),
      name: sanitizeString(payload.name),
      type: sanitizeString(payload.type),
      model: sanitizeString(payload.model ?? ""),
      vehicleNumber: sanitizeString(payload.vehicleNumber ?? ""),
      notes: sanitizeString(payload.notes ?? ""),
      isActive: payload.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };

    list.push(newVehicle);
    setUserVehicles(user.id, list);
    return newVehicle;
  },

  updateVehicle: async (id: string, payload: VehiclePayload): Promise<Vehicle> => {
    const user = await getAuthenticatedUser();
    if (!user) throw new ApiError("Authentication required", 401);

    const baseUrl = getApiBaseUrl();
    if (baseUrl) {
      try {
        const updated = await requestBackend<Vehicle>(`/api/vehicles/${id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        const list = getUserVehicles(user.id);
        const idx = list.findIndex((v) => v._id === id);
        if (idx !== -1) list[idx] = updated;
        setUserVehicles(user.id, list);
        return updated;
      } catch (e) {
        console.warn("[api] updateVehicle fallback to local storage:", e);
      }
    }

    const list = getUserVehicles(user.id);
    const idx = list.findIndex((v) => v._id === id);
    if (idx === -1) throw new ApiError("Vehicle not found", 404);

    const updated: Vehicle = {
      ...list[idx]!,
      name: sanitizeString(payload.name),
      type: sanitizeString(payload.type),
      model: sanitizeString(payload.model ?? ""),
      vehicleNumber: sanitizeString(payload.vehicleNumber ?? ""),
      notes: sanitizeString(payload.notes ?? ""),
      isActive: typeof payload.isActive === "boolean" ? payload.isActive : list[idx]!.isActive,
      updatedAt: new Date().toISOString(),
    };

    list[idx] = updated;
    setUserVehicles(user.id, list);
    return updated;
  },

  deleteVehicle: async (id: string): Promise<{ deletedTrips: number }> => {
    const user = await getAuthenticatedUser();
    if (!user) throw new ApiError("Authentication required", 401);

    const baseUrl = getApiBaseUrl();
    if (baseUrl) {
      try {
        const res = await requestBackend<{ deletedTrips: number }>(`/api/vehicles/${id}`, {
          method: "DELETE",
        });
        const vehicles = getUserVehicles(user.id).filter((v) => v._id !== id);
        setUserVehicles(user.id, vehicles);
        const trips = getUserTrips(user.id).filter((t) => t.vehicleId !== id);
        setUserTrips(user.id, trips);
        return res;
      } catch (e) {
        console.warn("[api] deleteVehicle fallback to local storage:", e);
      }
    }

    const vehicles = getUserVehicles(user.id).filter((v) => v._id !== id);
    setUserVehicles(user.id, vehicles);

    const trips = getUserTrips(user.id);
    const remainingTrips = trips.filter((t) => t.vehicleId !== id);
    const deletedTrips = trips.length - remainingTrips.length;
    setUserTrips(user.id, remainingTrips);

    return { deletedTrips };
  },

  toggleVehicleStatus: async (id: string, isActive: boolean): Promise<void> => {
    const user = await getAuthenticatedUser();
    if (!user) throw new ApiError("Authentication required", 401);

    const list = getUserVehicles(user.id);
    const idx = list.findIndex((v) => v._id === id);
    if (idx !== -1) {
      list[idx]!.isActive = isActive;
      list[idx]!.updatedAt = new Date().toISOString();
      setUserVehicles(user.id, list);
      if (getApiBaseUrl()) {
        try {
          await requestBackend(`/api/vehicles/${id}`, {
            method: "PUT",
            body: JSON.stringify(list[idx]),
          });
        } catch {
          /* ignore */
        }
      }
    }
  },

  listTrips: async (params: {
    vehicleId?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<Trip[]> => {
    const user = await getAuthenticatedUser();
    if (!user) return [];

    const baseUrl = getApiBaseUrl();
    if (baseUrl) {
      try {
        const query = new URLSearchParams();
        if (params.vehicleId && params.vehicleId !== ALL_VEHICLES) {
          query.set("vehicleId", params.vehicleId);
        }
        if (params.fromDate) query.set("fromDate", params.fromDate);
        if (params.toDate) query.set("toDate", params.toDate);

        const data = await requestBackend<Trip[]>(`/api/trips?${query.toString()}`);
        if (Array.isArray(data)) {
          return data;
        }
      } catch (e) {
        console.warn("[api] listTrips fallback to local cache:", e);
      }
    }

    let trips = getUserTrips(user.id);

    if (params.vehicleId && params.vehicleId !== ALL_VEHICLES) {
      trips = trips.filter((t) => t.vehicleId === params.vehicleId);
    }
    if (params.fromDate) {
      trips = trips.filter((t) => t.date >= params.fromDate!);
    }
    if (params.toDate) {
      trips = trips.filter((t) => t.date <= params.toDate!);
    }

    return trips.sort((a, b) => b.date.localeCompare(a.date));
  },

  createTrip: async (payload: TripPayload): Promise<Trip> => {
    const user = await getAuthenticatedUser();
    if (!user) throw new ApiError("Authentication required", 401);

    const baseUrl = getApiBaseUrl();
    if (baseUrl) {
      try {
        const created = await requestBackend<Trip>("/api/trips", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        const list = getUserTrips(user.id);
        list.unshift(created);
        setUserTrips(user.id, list);
        return created;
      } catch (e) {
        console.warn("[api] createTrip fallback to local storage:", e);
      }
    }

    const list = getUserTrips(user.id);
    const now = new Date().toISOString();
    const items: OtherExpenseItem[] = (payload.otherExpenseItems || [])
      .filter((i) => i.name.trim() || Number(i.amount) > 0)
      .map((i) => ({ name: sanitizeString(i.name), amount: Number(i.amount) || 0 }));

    const newTrip: Trip = {
      _id: generateEntityId("trip"),
      vehicleId: payload.vehicleId,
      date: payload.date,
      income: Number(payload.income) || 0,
      diesel: Number(payload.diesel) || 0,
      driverPayment: Number(payload.driverPayment) || 0,
      emiShare: Number(payload.emiShare) || 0,
      otherExpenseItems: items,
      otherExpenses: sumOtherExpenses(items),
      notes: sanitizeString(payload.notes ?? ""),
      createdAt: now,
      updatedAt: now,
    };

    list.unshift(newTrip);
    setUserTrips(user.id, list);
    return newTrip;
  },

  updateTrip: async (id: string, payload: TripPayload): Promise<Trip> => {
    const user = await getAuthenticatedUser();
    if (!user) throw new ApiError("Authentication required", 401);

    const baseUrl = getApiBaseUrl();
    if (baseUrl) {
      try {
        const updated = await requestBackend<Trip>(`/api/trips/${id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        const list = getUserTrips(user.id);
        const idx = list.findIndex((t) => t._id === id);
        if (idx !== -1) list[idx] = updated;
        setUserTrips(user.id, list);
        return updated;
      } catch (e) {
        console.warn("[api] updateTrip fallback to local storage:", e);
      }
    }

    const list = getUserTrips(user.id);
    const idx = list.findIndex((t) => t._id === id);
    if (idx === -1) throw new ApiError("Trip not found", 404);

    const items: OtherExpenseItem[] = (payload.otherExpenseItems || [])
      .filter((i) => i.name.trim() || Number(i.amount) > 0)
      .map((i) => ({ name: sanitizeString(i.name), amount: Number(i.amount) || 0 }));

    const updated: Trip = {
      ...list[idx]!,
      vehicleId: payload.vehicleId,
      date: payload.date,
      income: Number(payload.income) || 0,
      diesel: Number(payload.diesel) || 0,
      driverPayment: Number(payload.driverPayment) || 0,
      emiShare: Number(payload.emiShare) || 0,
      otherExpenseItems: items,
      otherExpenses: sumOtherExpenses(items),
      notes: sanitizeString(payload.notes ?? ""),
      updatedAt: new Date().toISOString(),
    };

    list[idx] = updated;
    setUserTrips(user.id, list);
    return updated;
  },

  deleteTrip: async (id: string): Promise<{ _id: string }> => {
    const user = await getAuthenticatedUser();
    if (!user) throw new ApiError("Authentication required", 401);

    const baseUrl = getApiBaseUrl();
    if (baseUrl) {
      try {
        await requestBackend(`/api/trips/${id}`, { method: "DELETE" });
      } catch (e) {
        console.warn("[api] deleteTrip fallback to local storage:", e);
      }
    }

    const list = getUserTrips(user.id).filter((t) => t._id !== id);
    setUserTrips(user.id, list);
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

    const baseUrl = getApiBaseUrl();
    if (baseUrl) {
      try {
        const data = await requestBackend<AppSettings>("/api/settings");
        if (data && typeof data === "object") {
          setUserSettings(user.id, data);
          return data;
        }
      } catch (e) {
        console.warn("[api] getSettings fallback to local cache:", e);
      }
    }

    return getUserSettings(user.id, user.user_metadata, user.email);
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

    const baseUrl = getApiBaseUrl();
    if (baseUrl) {
      try {
        const updated = await requestBackend<AppSettings>("/api/settings", {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setUserSettings(user.id, updated);
        return updated;
      } catch (e) {
        console.warn("[api] updateSettings fallback to local storage:", e);
      }
    }

    const current = getUserSettings(user.id, user.user_metadata, user.email);
    const updated: AppSettings = {
      ...current,
      appName: sanitizeString(payload.appName) || "Vehicle Calculation System",
      transportationName: sanitizeString(payload.transportationName),
      currency: payload.currency || "INR",
      defaultVehicleId: payload.defaultVehicleId,
      fullName: sanitizeString(payload.fullName),
      mobileNumber: sanitizeNumber(payload.mobileNumber),
      businessName: sanitizeString(payload.businessName),
      address: sanitizeString(payload.address),
      contactNumber: sanitizeNumber(payload.contactNumber),
      businessEmail: sanitizeEmail(payload.businessEmail),
      updatedAt: new Date().toISOString(),
    };

    setUserSettings(user.id, updated);
    return updated;
  },
};
