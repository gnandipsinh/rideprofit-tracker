import { roundCurrency, sumOtherExpenses } from "./calc";
import { todayInput } from "./format";
import {
  ALL_VEHICLES,
  type AppSettings,
  type OtherExpenseItem,
  type Trip,
  type TripPayload,
  type Vehicle,
  type VehiclePayload,
} from "./types";

const DEMO_SESSION_KEY = "rideprofit.demo.session";
const DEMO_DATA_KEY = "rideprofit.demo.data.v1";

export const DEMO_UID = "usr_demo_account_01";
export const DEMO_EMAIL = "demo@rideprofit.app";

export interface DemoStoreData {
  vehicles: Vehicle[];
  trips: Trip[];
  settings: AppSettings;
}

let memoryActive = false;
let memoryData: DemoStoreData | null = null;

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const val = window.localStorage.getItem(key);
    if (val !== null) return val;
  } catch {
    /* localStorage may be blocked in restricted contexts */
  }
  try {
    const val = window.sessionStorage.getItem(key);
    if (val !== null) return val;
  } catch {
    /* sessionStorage may be blocked in restricted contexts */
  }
  return null;
}

function writeStorage(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function removeStorage(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function makeSeedData(): DemoStoreData {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const todayDay = Math.max(1, now.getDate());
  const d1 = String(Math.min(todayDay, 4)).padStart(2, "0");
  const d2 = String(Math.min(todayDay, 7)).padStart(2, "0");
  const d3 = String(Math.min(todayDay, 11)).padStart(2, "0");
  const d4 = String(todayDay).padStart(2, "0");
  const nowIso = now.toISOString();

  const v1Id = "veh_demo_1";
  const v2Id = "veh_demo_2";

  return {
    vehicles: [
      {
        _id: v1Id,
        name: "Eicher Pro 2049",
        type: "Eicher",
        model: "Pro 2049 LPK Tipper",
        vehicleNumber: "GJ-01-AB-1234",
        notes: "Primary distribution truck",
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        _id: v2Id,
        name: "Tata 407 Gold",
        type: "Tata",
        model: "407 Gold SFC",
        vehicleNumber: "GJ-05-CD-5678",
        notes: "Express highway carrier",
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
    trips: [
      {
        _id: "trip_demo_1",
        vehicleId: v1Id,
        date: `${y}-${m}-${d1}`,
        income: 18500,
        diesel: 7200,
        driverPayment: 1500,
        emiShare: 2000,
        otherExpenseItems: [
          { name: "Toll Tax", amount: 500 },
          { name: "Tea & Food", amount: 300 },
        ],
        otherExpenses: 800,
        route: "Ahmedabad -> Surat",
        driverName: "Ramesh Patel",
        totalKm: 280,
        dieselLiters: 70,
        notes: "Ahmedabad to Surat goods haul",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        _id: "trip_demo_2",
        vehicleId: v1Id,
        date: `${y}-${m}-${d3}`,
        income: 24000,
        diesel: 8800,
        driverPayment: 1800,
        emiShare: 2000,
        otherExpenseItems: [
          { name: "Toll Tax", amount: 800 },
          { name: "Hamali & Unloading", amount: 400 },
        ],
        otherExpenses: 1200,
        route: "Vadodara -> Rajkot",
        driverName: "Kantilal",
        totalKm: 290,
        dieselLiters: 72,
        notes: "Full container industrial machinery cargo",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        _id: "trip_demo_3",
        vehicleId: v2Id,
        date: `${y}-${m}-${d2}`,
        income: 16500,
        diesel: 6200,
        driverPayment: 1400,
        emiShare: 1800,
        otherExpenseItems: [{ name: "Toll Plaza", amount: 600 }],
        otherExpenses: 600,
        route: "Vadodara -> Bharuch",
        driverName: "Sanjay Kumar",
        totalKm: 90,
        dieselLiters: 22,
        notes: "Vadodara to Bharuch distribution",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        _id: "trip_demo_4",
        vehicleId: v2Id,
        date: `${y}-${m}-${d4}`,
        income: 26000,
        diesel: 9600,
        driverPayment: 2100,
        emiShare: 1800,
        otherExpenseItems: [
          { name: "Toll Tax", amount: 900 },
          { name: "Puncture & Maintenance", amount: 600 },
        ],
        otherExpenses: 1500,
        route: "Surat -> Mumbai Corridor",
        driverName: "Sanjay Kumar",
        totalKm: 320,
        dieselLiters: 80,
        notes: "Interstate delivery round trip",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
    settings: {
      _id: `set_${DEMO_UID}`,
      appName: "Express Logistics Fleet",
      transportationName: "Express Logistics Fleet",
      businessName: "Express Logistics Fleet",
      currency: "INR",
      defaultVehicleId: null,
      fullName: "Demo Fleet Operator",
      mobileNumber: "9876543210",
      address: "Ring Road, Transport Hub",
      contactNumber: "9876543210",
      businessEmail: DEMO_EMAIL,
      userRole: "Demo Operator",
      updatedAt: nowIso,
    },
  };
}

function loadDemoData(): DemoStoreData {
  if (memoryData) {
    return memoryData;
  }
  const raw = readStorage(DEMO_DATA_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DemoStoreData;
      if (
        parsed &&
        Array.isArray(parsed.vehicles) &&
        Array.isArray(parsed.trips) &&
        parsed.settings
      ) {
        memoryData = parsed;
        return memoryData;
      }
    } catch {
      /* fallback to fresh seed */
    }
  }
  memoryData = makeSeedData();
  writeStorage(DEMO_DATA_KEY, JSON.stringify(memoryData));
  return memoryData;
}

function saveDemoData(data: DemoStoreData): void {
  memoryData = data;
  writeStorage(DEMO_DATA_KEY, JSON.stringify(data));
}

export function isDemoSessionActive(): boolean {
  if (memoryActive) return true;
  if (readStorage(DEMO_SESSION_KEY) === "1") {
    memoryActive = true;
    return true;
  }
  return false;
}

export function activateDemoSession(): void {
  memoryActive = true;
  writeStorage(DEMO_SESSION_KEY, "1");
  loadDemoData();
}

export function clearDemoSession(): void {
  memoryActive = false;
  removeStorage(DEMO_SESSION_KEY);
}

function genId(prefix: string): string {
  const raw =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${raw}`;
}

export const demoStore = {
  listVehicles(): Vehicle[] {
    const data = loadDemoData();
    return cloneData(data.vehicles).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  createVehicle(payload: VehiclePayload): Vehicle {
    const data = loadDemoData();
    const nowIso = new Date().toISOString();
    const vehicle: Vehicle = {
      _id: genId("veh"),
      name: payload.name.trim().slice(0, 255),
      type: (payload.type || "Truck").trim().slice(0, 80),
      model: (payload.model || "").trim().slice(0, 255),
      vehicleNumber: (payload.vehicleNumber || "").trim().slice(0, 64),
      notes: (payload.notes || "").trim().slice(0, 2000),
      isActive: payload.isActive ?? true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    saveDemoData({
      ...data,
      vehicles: [...data.vehicles, vehicle],
    });
    return cloneData(vehicle);
  },

  updateVehicle(id: string, payload: VehiclePayload): Vehicle {
    const data = loadDemoData();
    const idx = data.vehicles.findIndex((v) => v._id === id);
    if (idx < 0) {
      throw new Error("Vehicle not found");
    }
    const existing = data.vehicles[idx]!;
    const updated: Vehicle = {
      ...existing,
      name: payload.name.trim().slice(0, 255),
      type: (payload.type || "Truck").trim().slice(0, 80),
      model: (payload.model || "").trim().slice(0, 255),
      vehicleNumber: (payload.vehicleNumber || "").trim().slice(0, 64),
      notes: (payload.notes || "").trim().slice(0, 2000),
      isActive: Boolean(payload.isActive ?? true),
      updatedAt: new Date().toISOString(),
    };
    const nextVehicles = [...data.vehicles];
    nextVehicles[idx] = updated;
    saveDemoData({ ...data, vehicles: nextVehicles });
    return cloneData(updated);
  },

  deleteVehicle(id: string): { deletedTrips: number } {
    const data = loadDemoData();
    const remainingTrips = data.trips.filter((t) => t.vehicleId !== id);
    const deletedTrips = data.trips.length - remainingTrips.length;
    saveDemoData({
      ...data,
      vehicles: data.vehicles.filter((v) => v._id !== id),
      trips: remainingTrips,
    });
    return { deletedTrips };
  },

  toggleVehicleStatus(id: string, isActive: boolean): void {
    const data = loadDemoData();
    const idx = data.vehicles.findIndex((v) => v._id === id);
    if (idx < 0) return;
    const nextVehicles = [...data.vehicles];
    nextVehicles[idx] = {
      ...nextVehicles[idx]!,
      isActive: Boolean(isActive),
      updatedAt: new Date().toISOString(),
    };
    saveDemoData({ ...data, vehicles: nextVehicles });
  },

  listTrips(params: { vehicleId?: string; fromDate?: string; toDate?: string } = {}): Trip[] {
    const data = loadDemoData();
    let list = cloneData(data.trips);
    if (params.vehicleId && params.vehicleId !== ALL_VEHICLES) {
      list = list.filter((t) => t.vehicleId === params.vehicleId);
    }
    if (params.fromDate) {
      list = list.filter((t) => t.date >= params.fromDate!);
    }
    if (params.toDate) {
      list = list.filter((t) => t.date <= params.toDate!);
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  },

  createTrip(payload: TripPayload, items: OtherExpenseItem[]): Trip {
    const data = loadDemoData();
    const nowIso = new Date().toISOString();
    const otherExpenses = roundCurrency(sumOtherExpenses(items));
    const trip: Trip = {
      _id: genId("trp"),
      vehicleId: payload.vehicleId,
      date: payload.date || todayInput(),
      income: Number(payload.income) || 0,
      diesel: Number(payload.diesel) || 0,
      driverPayment: Number(payload.driverPayment) || 0,
      emiShare: Number(payload.emiShare) || 0,
      otherExpenseItems: cloneData(items),
      otherExpenses,
      notes: (payload.notes || "").trim().slice(0, 2000),
      route: (payload.route || "").trim().slice(0, 120),
      driverName: (payload.driverName || "").trim().slice(0, 80),
      totalKm: Number(payload.totalKm) || 0,
      dieselLiters: Number(payload.dieselLiters) || 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    saveDemoData({
      ...data,
      trips: [...data.trips, trip],
    });
    return cloneData(trip);
  },

  updateTrip(id: string, payload: TripPayload, items: OtherExpenseItem[]): Trip {
    const data = loadDemoData();
    const idx = data.trips.findIndex((t) => t._id === id);
    if (idx < 0) {
      throw new Error("Trip not found");
    }
    const existing = data.trips[idx]!;
    const otherExpenses = roundCurrency(sumOtherExpenses(items));
    const updated: Trip = {
      ...existing,
      vehicleId: payload.vehicleId,
      date: payload.date || existing.date,
      income: Number(payload.income) || 0,
      diesel: Number(payload.diesel) || 0,
      driverPayment: Number(payload.driverPayment) || 0,
      emiShare: Number(payload.emiShare) || 0,
      otherExpenseItems: cloneData(items),
      otherExpenses,
      notes: (payload.notes || "").trim().slice(0, 2000),
      route: (payload.route || "").trim().slice(0, 120),
      driverName: (payload.driverName || "").trim().slice(0, 80),
      totalKm: Number(payload.totalKm) || 0,
      dieselLiters: Number(payload.dieselLiters) || 0,
      updatedAt: new Date().toISOString(),
    };
    const nextTrips = [...data.trips];
    nextTrips[idx] = updated;
    saveDemoData({ ...data, trips: nextTrips });
    return cloneData(updated);
  },

  deleteTrip(id: string): { _id: string } {
    const data = loadDemoData();
    saveDemoData({
      ...data,
      trips: data.trips.filter((t) => t._id !== id),
    });
    return { _id: id };
  },

  getSettings(): AppSettings {
    const data = loadDemoData();
    return cloneData(data.settings);
  },

  updateSettings(patch: Partial<AppSettings>): AppSettings {
    const data = loadDemoData();
    const updated: AppSettings = {
      ...data.settings,
      ...patch,
      _id: `set_${DEMO_UID}`,
      updatedAt: new Date().toISOString(),
    };
    saveDemoData({
      ...data,
      settings: updated,
    });
    return cloneData(updated);
  },
};
