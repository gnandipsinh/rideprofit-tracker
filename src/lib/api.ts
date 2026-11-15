import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "@/lib/firebase";
import { demoStore, isDemoSessionActive } from "@/lib/demo-store";
import { profitOf, roundCurrency, sumOtherExpenses, totalExpenseOf } from "./calc";
import { todayInput } from "./format";
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
  return sanitizeString(input, 255).toLowerCase();
}

function sanitizeNumber(input: string, maxLength = 20): string {
  return (input || "").trim().replace(/\D/g, "").slice(0, maxLength);
}

export { sanitizeString, sanitizeEmail, sanitizeNumber };

const ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidId(id: string): boolean {
  return ID_RE.test(id);
}

function newDocId(prefix: string): string {
  const raw =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${raw}`;
}

function toAmount(value: unknown, max = 1_000_000_000): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(Math.min(n, max) * 100) / 100;
}

function validDateOrToday(raw: unknown): string {
  if (typeof raw === "string" && DATE_RE.test(raw)) {
    const [yStr, mStr, dStr] = raw.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);
    const check = new Date(Date.UTC(y, m - 1, d));
    if (check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d) {
      return raw;
    }
  }
  return todayInput();
}

function tsToIso(val: unknown): string {
  if (typeof val === "string" && val) return val;
  if (val && typeof val === "object" && "toDate" in val) {
    const fn = (val as { toDate?: () => Date }).toDate;
    if (typeof fn === "function") {
      return fn.call(val).toISOString();
    }
  }
  return new Date().toISOString();
}

function docToVehicle(id: string, data: DocumentData): Vehicle {
  return {
    _id: id,
    name: String(data["name"] ?? ""),
    type: String(data["type"] ?? "Truck"),
    model: String(data["model"] ?? ""),
    vehicleNumber: String(data["vehicleNumber"] ?? ""),
    notes: String(data["notes"] ?? ""),
    isActive: data["isActive"] !== false,
    createdAt: tsToIso(data["createdAt"]),
    updatedAt: tsToIso(data["updatedAt"]),
  };
}

function docToTrip(id: string, data: DocumentData): Trip {
  const rawItems = Array.isArray(data["otherExpenseItems"]) ? data["otherExpenseItems"] : [];
  const otherExpenseItems: OtherExpenseItem[] = rawItems.slice(0, 100).map((item) => ({
    name: sanitizeString(String((item as { name?: unknown })?.name ?? ""), 255),
    amount: toAmount((item as { amount?: unknown })?.amount),
  }));
  return {
    _id: id,
    vehicleId: String(data["vehicleId"] ?? ""),
    date: String(data["date"] ?? todayInput()),
    income: toAmount(data["income"]),
    diesel: toAmount(data["diesel"]),
    driverPayment: toAmount(data["driverPayment"]),
    emiShare: toAmount(data["emiShare"]),
    otherExpenseItems,
    otherExpenses: toAmount(data["otherExpenses"]),
    notes: String(data["notes"] ?? ""),
    route: String(data["route"] ?? ""),
    driverName: String(data["driverName"] ?? ""),
    totalKm: toAmount(data["totalKm"], 10_000_000),
    dieselLiters: toAmount(data["dieselLiters"], 1_000_000),
    createdAt: tsToIso(data["createdAt"]),
    updatedAt: tsToIso(data["updatedAt"]),
  };
}

function docToSettings(uid: string, data: DocumentData): AppSettings {
  return {
    _id: `set_${uid}`,
    appName: String(data["appName"] ?? ""),
    transportationName: String(data["transportationName"] ?? ""),
    businessName: String(data["businessName"] ?? ""),
    currency: String(data["currency"] ?? "INR") || "INR",
    defaultVehicleId:
      typeof data["defaultVehicleId"] === "string" && data["defaultVehicleId"]
        ? data["defaultVehicleId"]
        : null,
    fullName: String(data["fullName"] ?? ""),
    mobileNumber: String(data["mobileNumber"] ?? ""),
    address: String(data["address"] ?? ""),
    contactNumber: String(data["contactNumber"] ?? ""),
    businessEmail: String(data["businessEmail"] ?? ""),
    userRole: String(data["userRole"] ?? "Super Admin") || "Super Admin",
    updatedAt: tsToIso(data["updatedAt"]),
  };
}

async function isDemoMode(): Promise<boolean> {
  await auth.authStateReady();
  return !auth.currentUser && isDemoSessionActive();
}

async function requireUid(): Promise<string> {
  await auth.authStateReady();
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new ApiError("Authentication required", 401);
  }
  return uid;
}

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

export function setApiBaseUrl(_url: string): void {
  // Configured via Firebase project configuration
}

function normalizeExpenseItems(items: OtherExpenseItem[] | undefined): OtherExpenseItem[] {
  return (items || [])
    .slice(0, 100)
    .filter((i) => (i.name || "").trim().length > 0 || Number(i.amount) > 0)
    .map((i) => ({
      name: sanitizeString(i.name, 255),
      amount: toAmount(i.amount),
    }));
}

export const api = {
  health: async (): Promise<{ status: string; database: string; url?: string }> => {
    const isOnline = typeof navigator === "undefined" || navigator.onLine !== false;
    return {
      status: isOnline ? "connected" : "error",
      database: "cloud-firestore",
      url: getApiBaseUrl(),
    };
  },

  listVehicles: async (): Promise<Vehicle[]> => {
    if (await isDemoMode()) {
      return demoStore.listVehicles();
    }
    await auth.authStateReady();
    const uid = auth.currentUser?.uid;
    if (!uid) return [];

    const colPath = `users/${uid}/vehicles`;
    try {
      const q = query(collection(db, "users", uid, "vehicles"), where("userId", "==", uid));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => docToVehicle(d.id, d.data()));
      list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return list;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, colPath);
    }
  },

  createVehicle: async (payload: VehiclePayload): Promise<Vehicle> => {
    if (await isDemoMode()) {
      return demoStore.createVehicle({
        name: sanitizeString(payload.name, 255),
        type: sanitizeString(payload.type, 80) || "Truck",
        model: sanitizeString(payload.model ?? "", 255),
        vehicleNumber: sanitizeString(payload.vehicleNumber ?? "", 64),
        notes: sanitizeString(payload.notes ?? "", 2000),
        isActive: payload.isActive ?? true,
      });
    }
    const uid = await requireUid();
    const id = newDocId("veh");
    const docPath = `users/${uid}/vehicles/${id}`;
    const record = {
      userId: uid,
      name: sanitizeString(payload.name, 255),
      type: sanitizeString(payload.type, 80) || "Truck",
      model: sanitizeString(payload.model ?? "", 255),
      vehicleNumber: sanitizeString(payload.vehicleNumber ?? "", 64),
      notes: sanitizeString(payload.notes ?? "", 2000),
      isActive: payload.isActive ?? true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, "users", uid, "vehicles", id), record);
      const nowIso = new Date().toISOString();
      return {
        _id: id,
        name: record.name,
        type: record.type,
        model: record.model,
        vehicleNumber: record.vehicleNumber,
        notes: record.notes,
        isActive: record.isActive,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, docPath);
    }
  },

  updateVehicle: async (id: string, payload: VehiclePayload): Promise<Vehicle> => {
    if (!isValidId(id)) throw new ApiError("Invalid vehicle ID", 400);
    if (await isDemoMode()) {
      return demoStore.updateVehicle(id, {
        name: sanitizeString(payload.name, 255),
        type: sanitizeString(payload.type, 80) || "Truck",
        model: sanitizeString(payload.model ?? "", 255),
        vehicleNumber: sanitizeString(payload.vehicleNumber ?? "", 64),
        notes: sanitizeString(payload.notes ?? "", 2000),
        isActive: Boolean(payload.isActive ?? true),
      });
    }
    const uid = await requireUid();

    const docPath = `users/${uid}/vehicles/${id}`;
    const ref = doc(db, "users", uid, "vehicles", id);
    const patch = {
      name: sanitizeString(payload.name, 255),
      type: sanitizeString(payload.type, 80) || "Truck",
      model: sanitizeString(payload.model ?? "", 255),
      vehicleNumber: sanitizeString(payload.vehicleNumber ?? "", 64),
      notes: sanitizeString(payload.notes ?? "", 2000),
      isActive: Boolean(payload.isActive ?? true),
      updatedAt: serverTimestamp(),
    };

    try {
      await updateDoc(ref, patch);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new ApiError("Vehicle not found", 404);
      return docToVehicle(snap.id, snap.data());
    } catch (err) {
      if (err instanceof ApiError) throw err;
      handleFirestoreError(err, OperationType.UPDATE, docPath);
    }
  },

  deleteVehicle: async (id: string): Promise<{ deletedTrips: number }> => {
    if (!isValidId(id)) throw new ApiError("Invalid vehicle ID", 400);
    if (await isDemoMode()) {
      return demoStore.deleteVehicle(id);
    }
    const uid = await requireUid();

    const tripsPath = `users/${uid}/trips`;
    let deletedTrips = 0;
    try {
      const snap = await getDocs(
        query(collection(db, "users", uid, "trips"), where("userId", "==", uid)),
      );
      const matching = snap.docs.filter((d) => d.data()["vehicleId"] === id);
      for (let i = 0; i < matching.length; i += 400) {
        const batch = writeBatch(db);
        const chunk = matching.slice(i, i + 400);
        for (const tripDoc of chunk) {
          batch.delete(tripDoc.ref);
        }
        await batch.commit();
        deletedTrips += chunk.length;
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, tripsPath);
    }

    const docPath = `users/${uid}/vehicles/${id}`;
    try {
      await deleteDoc(doc(db, "users", uid, "vehicles", id));
      return { deletedTrips };
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, docPath);
    }
  },

  toggleVehicleStatus: async (id: string, isActive: boolean): Promise<void> => {
    if (!isValidId(id)) throw new ApiError("Invalid vehicle ID", 400);
    if (await isDemoMode()) {
      demoStore.toggleVehicleStatus(id, isActive);
      return;
    }
    const uid = await requireUid();

    const docPath = `users/${uid}/vehicles/${id}`;
    try {
      await updateDoc(doc(db, "users", uid, "vehicles", id), {
        isActive: Boolean(isActive),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, docPath);
    }
  },

  listTrips: async (
    params: {
      vehicleId?: string;
      fromDate?: string;
      toDate?: string;
    } = {},
  ): Promise<Trip[]> => {
    if (await isDemoMode()) {
      return demoStore.listTrips(params);
    }
    await auth.authStateReady();
    const uid = auth.currentUser?.uid;
    if (!uid) return [];

    const colPath = `users/${uid}/trips`;
    try {
      const q = query(collection(db, "users", uid, "trips"), where("userId", "==", uid));
      const snap = await getDocs(q);
      let list = snap.docs.map((d) => docToTrip(d.id, d.data()));
      if (params.vehicleId && params.vehicleId !== ALL_VEHICLES) {
        list = list.filter((t) => t.vehicleId === params.vehicleId);
      }
      if (params.fromDate) {
        list = list.filter((t) => t.date >= params.fromDate!);
      }
      if (params.toDate) {
        list = list.filter((t) => t.date <= params.toDate!);
      }
      list.sort((a, b) => b.date.localeCompare(a.date));
      return list;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, colPath);
    }
  },

  createTrip: async (payload: TripPayload): Promise<Trip> => {
    const vehicleId = sanitizeString(payload.vehicleId, 128);
    if (!isValidId(vehicleId)) {
      throw new ApiError("Please select a valid vehicle.", 400);
    }

    const items = normalizeExpenseItems(payload.otherExpenseItems);
    const otherExpenses = roundCurrency(sumOtherExpenses(items));
    const date = validDateOrToday(payload.date);

    if (await isDemoMode()) {
      return demoStore.createTrip(
        {
          ...payload,
          vehicleId,
          date,
          income: toAmount(payload.income),
          diesel: toAmount(payload.diesel),
          driverPayment: toAmount(payload.driverPayment),
          emiShare: toAmount(payload.emiShare),
          notes: sanitizeString(payload.notes ?? "", 2000),
          route: sanitizeString(payload.route ?? "", 120),
          driverName: sanitizeString(payload.driverName ?? "", 80),
          totalKm: toAmount(payload.totalKm, 10_000_000),
          dieselLiters: toAmount(payload.dieselLiters, 1_000_000),
        },
        items,
      );
    }

    const uid = await requireUid();
    const id = newDocId("trp");
    const docPath = `users/${uid}/trips/${id}`;

    const record = {
      userId: uid,
      vehicleId,
      date,
      income: toAmount(payload.income),
      diesel: toAmount(payload.diesel),
      driverPayment: toAmount(payload.driverPayment),
      emiShare: toAmount(payload.emiShare),
      otherExpenseItems: items,
      otherExpenses,
      notes: sanitizeString(payload.notes ?? "", 2000),
      route: sanitizeString(payload.route ?? "", 120),
      driverName: sanitizeString(payload.driverName ?? "", 80),
      totalKm: toAmount(payload.totalKm, 10_000_000),
      dieselLiters: toAmount(payload.dieselLiters, 1_000_000),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, "users", uid, "trips", id), record);
      const nowIso = new Date().toISOString();
      return {
        _id: id,
        vehicleId: record.vehicleId,
        date: record.date,
        income: record.income,
        diesel: record.diesel,
        driverPayment: record.driverPayment,
        emiShare: record.emiShare,
        otherExpenseItems: items,
        otherExpenses: record.otherExpenses,
        notes: record.notes,
        route: record.route,
        driverName: record.driverName,
        totalKm: record.totalKm,
        dieselLiters: record.dieselLiters,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, docPath);
    }
  },

  updateTrip: async (id: string, payload: TripPayload): Promise<Trip> => {
    if (!isValidId(id)) throw new ApiError("Invalid trip ID", 400);
    const vehicleId = sanitizeString(payload.vehicleId, 128);
    if (!isValidId(vehicleId)) {
      throw new ApiError("Please select a valid vehicle.", 400);
    }

    const items = normalizeExpenseItems(payload.otherExpenseItems);
    const otherExpenses = roundCurrency(sumOtherExpenses(items));
    const date = validDateOrToday(payload.date);

    if (await isDemoMode()) {
      return demoStore.updateTrip(
        id,
        {
          ...payload,
          vehicleId,
          date,
          income: toAmount(payload.income),
          diesel: toAmount(payload.diesel),
          driverPayment: toAmount(payload.driverPayment),
          emiShare: toAmount(payload.emiShare),
          notes: sanitizeString(payload.notes ?? "", 2000),
          route: sanitizeString(payload.route ?? "", 120),
          driverName: sanitizeString(payload.driverName ?? "", 80),
          totalKm: toAmount(payload.totalKm, 10_000_000),
          dieselLiters: toAmount(payload.dieselLiters, 1_000_000),
        },
        items,
      );
    }

    const uid = await requireUid();
    const docPath = `users/${uid}/trips/${id}`;
    const ref = doc(db, "users", uid, "trips", id);

    const patch = {
      vehicleId,
      date: validDateOrToday(payload.date),
      income: toAmount(payload.income),
      diesel: toAmount(payload.diesel),
      driverPayment: toAmount(payload.driverPayment),
      emiShare: toAmount(payload.emiShare),
      otherExpenseItems: items,
      otherExpenses,
      notes: sanitizeString(payload.notes ?? "", 2000),
      route: sanitizeString(payload.route ?? "", 120),
      driverName: sanitizeString(payload.driverName ?? "", 80),
      totalKm: toAmount(payload.totalKm, 10_000_000),
      dieselLiters: toAmount(payload.dieselLiters, 1_000_000),
      updatedAt: serverTimestamp(),
    };

    try {
      await updateDoc(ref, patch);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new ApiError("Trip not found", 404);
      return docToTrip(snap.id, snap.data());
    } catch (err) {
      if (err instanceof ApiError) throw err;
      handleFirestoreError(err, OperationType.UPDATE, docPath);
    }
  },

  deleteTrip: async (id: string): Promise<{ _id: string }> => {
    if (!isValidId(id)) throw new ApiError("Invalid trip ID", 400);
    if (await isDemoMode()) {
      return demoStore.deleteTrip(id);
    }
    const uid = await requireUid();

    const docPath = `users/${uid}/trips/${id}`;
    try {
      await deleteDoc(doc(db, "users", uid, "trips", id));
      return { _id: id };
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, docPath);
    }
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
          profit: profitOf(t),
        };
      });

    const summary = rows.reduce(
      (acc, r) => ({
        trips: acc.trips + 1,
        income: roundCurrency(acc.income + r.income),
        diesel: roundCurrency(acc.diesel + r.diesel),
        driverPayment: roundCurrency(acc.driverPayment + r.driverPayment),
        otherExpenses: roundCurrency(acc.otherExpenses + r.otherExpenses),
        emiShare: roundCurrency(acc.emiShare + r.emiShare),
        totalExpense: roundCurrency(acc.totalExpense + r.totalExpense),
        profit: roundCurrency(acc.profit + r.profit),
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
    if (await isDemoMode()) {
      return demoStore.getSettings();
    }
    const uid = await requireUid();
    const docPath = `users/${uid}/settings/app`;
    const ref = doc(db, "users", uid, "settings", "app");

    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        return docToSettings(uid, snap.data());
      }
      const initial = {
        userId: uid,
        appName: "",
        transportationName: "",
        businessName: "",
        currency: "INR",
        defaultVehicleId: null,
        fullName: "",
        mobileNumber: "",
        address: "",
        contactNumber: "",
        businessEmail: "",
        userRole: "Super Admin",
        updatedAt: serverTimestamp(),
      };
      await setDoc(ref, initial);
      return docToSettings(uid, { ...initial, updatedAt: new Date().toISOString() });
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, docPath);
    }
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
    userRole?: string;
  }): Promise<AppSettings> => {
    const unifiedName = sanitizeString(
      payload.transportationName || payload.businessName || payload.appName,
      120,
    );
    const safeDefaultVehicleId =
      payload.defaultVehicleId && isValidId(payload.defaultVehicleId)
        ? payload.defaultVehicleId
        : null;

    if (await isDemoMode()) {
      return demoStore.updateSettings({
        appName: unifiedName,
        transportationName: unifiedName,
        businessName: unifiedName,
        currency: sanitizeString(payload.currency || "INR", 10) || "INR",
        defaultVehicleId: safeDefaultVehicleId,
        fullName: sanitizeString(payload.fullName, 80),
        mobileNumber: sanitizeNumber(payload.mobileNumber, 20),
        address: sanitizeString(payload.address, 500),
        contactNumber: sanitizeNumber(payload.contactNumber, 20),
        businessEmail: sanitizeEmail(payload.businessEmail),
        userRole: sanitizeString(payload.userRole || "Demo Operator", 50) || "Demo Operator",
      });
    }

    const uid = await requireUid();
    const docPath = `users/${uid}/settings/app`;
    const ref = doc(db, "users", uid, "settings", "app");

    const data = {
      userId: uid,
      appName: unifiedName,
      transportationName: unifiedName,
      businessName: unifiedName,
      currency: sanitizeString(payload.currency || "INR", 10) || "INR",
      defaultVehicleId: safeDefaultVehicleId,
      fullName: sanitizeString(payload.fullName, 80),
      mobileNumber: sanitizeNumber(payload.mobileNumber, 20),
      address: sanitizeString(payload.address, 500),
      contactNumber: sanitizeNumber(payload.contactNumber, 20),
      businessEmail: sanitizeEmail(payload.businessEmail),
      userRole: sanitizeString(payload.userRole || "Super Admin", 50) || "Super Admin",
      updatedAt: serverTimestamp(),
    };

    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, data);
      } else {
        const { userId: _omitUid, ...patch } = data;
        void _omitUid;
        await updateDoc(ref, patch);
      }
      return docToSettings(uid, { ...data, updatedAt: new Date().toISOString() });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, docPath);
    }
  },

  syncLegacy: async (payload: {
    vehicles?: Array<Record<string, unknown>>;
    trips?: Array<Record<string, unknown>>;
    settings?: Record<string, unknown>;
  }): Promise<{ importedVehicles: number; importedTrips: number }> => {
    const demoActive = await isDemoMode();
    const uid = demoActive ? "demo" : await requireUid();

    const [existingVehicles, existingTrips] = await Promise.all([
      api.listVehicles(),
      api.listTrips(),
    ]);
    const vehicleIdMap = new Map<string, string>();
    const ownedVehicleIds = new Set(existingVehicles.map((v) => v._id));

    let importedVehicles = 0;
    const vehiclesToCreate: Array<{ id: string; docData: Record<string, unknown> }> = [];

    if (Array.isArray(payload.vehicles)) {
      for (const raw of payload.vehicles.slice(0, 5000)) {
        if (!raw || typeof raw !== "object") continue;
        const rawId = sanitizeString(String(raw["_id"] ?? raw["id"] ?? ""), 128);
        const rawNumber = sanitizeString(
          String(raw["vehicleNumber"] ?? raw["vehicle_number"] ?? ""),
          64,
        );
        const rawName = sanitizeString(String(raw["name"] ?? ""), 255);

        const match = existingVehicles.find(
          (ev) =>
            (rawId && ev._id === rawId) ||
            (ev.vehicleNumber &&
              rawNumber &&
              ev.vehicleNumber.toLowerCase() === rawNumber.toLowerCase()),
        );
        if (match) {
          if (rawId) vehicleIdMap.set(rawId, match._id);
          continue;
        }

        const nextId =
          rawId && isValidId(rawId) && !ownedVehicleIds.has(rawId) ? rawId : newDocId("veh");
        if (rawId) vehicleIdMap.set(rawId, nextId);
        ownedVehicleIds.add(nextId);

        vehiclesToCreate.push({
          id: nextId,
          docData: {
            userId: uid,
            name: rawName,
            type: sanitizeString(String(raw["type"] ?? "Truck"), 80) || "Truck",
            model: sanitizeString(String(raw["model"] ?? ""), 255),
            vehicleNumber: rawNumber,
            notes: sanitizeString(String(raw["notes"] ?? ""), 2000),
            isActive: raw["isActive"] !== false && raw["is_active"] !== false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
        });
        importedVehicles++;
      }
    }

    // Commit all vehicles first so Firestore Master Gate exists() passes for trips
    if (demoActive) {
      for (const item of vehiclesToCreate) {
        demoStore.createVehicle({
          name: String(item.docData["name"] ?? ""),
          type: String(item.docData["type"] ?? "Truck"),
          model: String(item.docData["model"] ?? ""),
          vehicleNumber: String(item.docData["vehicleNumber"] ?? ""),
          notes: String(item.docData["notes"] ?? ""),
          isActive: item.docData["isActive"] !== false,
        });
      }
    } else {
      try {
        for (let i = 0; i < vehiclesToCreate.length; i += 400) {
          const batch = writeBatch(db);
          for (const item of vehiclesToCreate.slice(i, i + 400)) {
            batch.set(doc(db, "users", uid, "vehicles", item.id), item.docData);
          }
          await batch.commit();
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}/vehicles`);
      }
    }

    let importedTrips = 0;
    const tripsToCreate: Array<{ id: string; docData: Record<string, unknown> }> = [];
    const knownTripIds = new Set(existingTrips.map((t) => t._id));

    if (Array.isArray(payload.trips)) {
      for (const raw of payload.trips.slice(0, 20000)) {
        if (!raw || typeof raw !== "object") continue;
        const rawTripId = sanitizeString(String(raw["_id"] ?? raw["id"] ?? ""), 128);
        const rawVehicleId = sanitizeString(
          String(raw["vehicleId"] ?? raw["vehicle_id"] ?? ""),
          128,
        );
        const resolvedVehicleId = vehicleIdMap.get(rawVehicleId) ?? rawVehicleId;
        if (
          !resolvedVehicleId ||
          !isValidId(resolvedVehicleId) ||
          !ownedVehicleIds.has(resolvedVehicleId)
        ) {
          continue;
        }

        const date = validDateOrToday(raw["date"]);
        const income = toAmount(raw["income"]);

        const match = existingTrips.find(
          (et) =>
            (rawTripId && et._id === rawTripId) ||
            (et.vehicleId === resolvedVehicleId && et.date === date && et.income === income),
        );
        if (match) continue;

        const nextTripId =
          rawTripId && isValidId(rawTripId) && !knownTripIds.has(rawTripId)
            ? rawTripId
            : newDocId("trp");
        knownTripIds.add(nextTripId);

        const rawItems = raw["otherExpenseItems"] ?? raw["other_expense_items"];
        const items: OtherExpenseItem[] = Array.isArray(rawItems)
          ? rawItems.slice(0, 100).map((it) => ({
              name: sanitizeString(String((it as { name?: unknown })?.name ?? ""), 255),
              amount: toAmount((it as { amount?: unknown })?.amount),
            }))
          : [];

        tripsToCreate.push({
          id: nextTripId,
          docData: {
            userId: uid,
            vehicleId: resolvedVehicleId,
            date,
            income,
            diesel: toAmount(raw["diesel"]),
            driverPayment: toAmount(raw["driverPayment"] ?? raw["driver_payment"]),
            emiShare: toAmount(raw["emiShare"] ?? raw["emi_share"]),
            otherExpenseItems: items,
            otherExpenses: roundCurrency(sumOtherExpenses(items)),
            notes: sanitizeString(String(raw["notes"] ?? ""), 2000),
            route: sanitizeString(String(raw["route"] ?? ""), 120),
            driverName: sanitizeString(String(raw["driverName"] ?? raw["driver_name"] ?? ""), 80),
            totalKm: toAmount(raw["totalKm"] ?? raw["total_km"], 10_000_000),
            dieselLiters: toAmount(raw["dieselLiters"] ?? raw["diesel_liters"], 1_000_000),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
        });
        importedTrips++;
      }
    }

    if (demoActive) {
      for (const item of tripsToCreate) {
        const d = item.docData;
        demoStore.createTrip(
          {
            vehicleId: String(d["vehicleId"] ?? ""),
            date: String(d["date"] ?? todayInput()),
            income: Number(d["income"]) || 0,
            diesel: Number(d["diesel"]) || 0,
            driverPayment: Number(d["driverPayment"]) || 0,
            emiShare: Number(d["emiShare"]) || 0,
            otherExpenseItems: Array.isArray(d["otherExpenseItems"])
              ? (d["otherExpenseItems"] as OtherExpenseItem[])
              : [],
            notes: String(d["notes"] ?? ""),
            route: String(d["route"] ?? ""),
            driverName: String(d["driverName"] ?? ""),
            totalKm: Number(d["totalKm"]) || 0,
            dieselLiters: Number(d["dieselLiters"]) || 0,
          },
          Array.isArray(d["otherExpenseItems"])
            ? (d["otherExpenseItems"] as OtherExpenseItem[])
            : [],
        );
      }
    } else {
      try {
        for (let i = 0; i < tripsToCreate.length; i += 400) {
          const batch = writeBatch(db);
          for (const item of tripsToCreate.slice(i, i + 400)) {
            batch.set(doc(db, "users", uid, "trips", item.id), item.docData);
          }
          await batch.commit();
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}/trips`);
      }
    }

    if (payload.settings && typeof payload.settings === "object") {
      const s = payload.settings;
      const cur = await api.getSettings();
      const rawDefault = sanitizeString(
        String(s["defaultVehicleId"] ?? s["default_vehicle_id"] ?? ""),
        128,
      );
      const mappedDefault = rawDefault ? (vehicleIdMap.get(rawDefault) ?? rawDefault) : null;
      await api.updateSettings({
        appName: String(
          s["transportationName"] ??
            s["transportation_name"] ??
            s["businessName"] ??
            s["business_name"] ??
            s["appName"] ??
            s["app_name"] ??
            cur.appName,
        ),
        transportationName: String(
          s["transportationName"] ??
            s["transportation_name"] ??
            s["businessName"] ??
            s["business_name"] ??
            cur.transportationName,
        ),
        businessName: String(
          s["businessName"] ??
            s["business_name"] ??
            s["transportationName"] ??
            s["transportation_name"] ??
            cur.businessName,
        ),
        currency: String(s["currency"] ?? cur.currency ?? "INR"),
        defaultVehicleId:
          mappedDefault && ownedVehicleIds.has(mappedDefault)
            ? mappedDefault
            : cur.defaultVehicleId,
        fullName: String(s["fullName"] ?? s["full_name"] ?? cur.fullName ?? ""),
        mobileNumber: String(s["mobileNumber"] ?? s["mobile_number"] ?? cur.mobileNumber ?? ""),
        address: String(s["address"] ?? cur.address ?? ""),
        contactNumber: String(s["contactNumber"] ?? s["contact_number"] ?? cur.contactNumber ?? ""),
        businessEmail: String(s["businessEmail"] ?? s["business_email"] ?? cur.businessEmail ?? ""),
        userRole: String(s["userRole"] ?? s["user_role"] ?? cur.userRole ?? "Super Admin"),
      });
    }

    return { importedVehicles, importedTrips };
  },
};
