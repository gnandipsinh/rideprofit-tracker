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

/* ---------------- Real User Data Storage (Strictly Isolated by User ID) ---------------- */

const VEHICLES_PREFIX = "vcs.data.vehicles.";
const TRIPS_PREFIX = "vcs.data.trips.";
const SETTINGS_PREFIX = "vcs.data.settings.";

function generateEntityId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function getUserVehicles(userId: string): Vehicle[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(VEHICLES_PREFIX + userId);
    return raw ? (JSON.parse(raw) as Vehicle[]) : [];
  } catch {
    return [];
  }
}

function setUserVehicles(userId: string, list: Vehicle[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VEHICLES_PREFIX + userId, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function getUserTrips(userId: string): Trip[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TRIPS_PREFIX + userId);
    return raw ? (JSON.parse(raw) as Trip[]) : [];
  } catch {
    return [];
  }
}

function setUserTrips(userId: string, list: Trip[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TRIPS_PREFIX + userId, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function getUserSettings(
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

function setUserSettings(userId: string, settings: AppSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SETTINGS_PREFIX + userId, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

/* ---------------- API Object ---------------- */

export const api = {
  health: async () => {
    return { status: "ok", database: "connected" };
  },

  listVehicles: async (): Promise<Vehicle[]> => {
    const user = await getAuthenticatedUser();
    if (!user) return [];
    return getUserVehicles(user.id);
  },

  createVehicle: async (payload: VehiclePayload): Promise<Vehicle> => {
    const user = await getAuthenticatedUser();
    if (!user) throw new ApiError("Authentication required", 401);

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
    }
  },

  listTrips: async (params: {
    vehicleId?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<Trip[]> => {
    const user = await getAuthenticatedUser();
    if (!user) return [];

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
