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

function fail(error: { message: string } | null): never {
  throw new ApiError(error?.message ?? "Something went wrong with the database request");
}

function sanitizeString(input: string, maxLength = 255): string {
  return input.trim().slice(0, maxLength).replace(/[<>]/g, "");
}

function sanitizeEmail(input: string): string {
  return sanitizeString(input).toLowerCase().slice(0, 255);
}

function sanitizeNumber(input: string, maxLength = 20): string {
  return input.trim().replace(/\D/g, "").slice(0, maxLength);
}

export { sanitizeString, sanitizeEmail, sanitizeNumber };

async function getCurrentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/* ---------------- row mappers ---------------- */

interface VehicleRow {
  id: string;
  name: string;
  type: string;
  model: string;
  vehicle_number: string;
  notes: string;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
}

interface TripRow {
  id: string;
  vehicle_id: string;
  date: string;
  income: number;
  diesel: number;
  driver_payment: number;
  emi_share: number;
  other_expense_items: unknown;
  notes: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

interface SettingsRow {
  id: string;
  app_name: string;
  currency: string;
  default_vehicle_id: string | null;
  updated_at: string;
  transportation_name?: string;
  full_name?: string;
  mobile_number?: string;
  business_name?: string;
  address?: string;
  contact_number?: string;
  business_email?: string;
  user_id: string;
}

function isMissingSettingsColumn(error: { code?: string; message?: string } | null): boolean {
  return error?.code === "PGRST204" || error?.message?.includes("column") === true;
}

interface SettingsProfileCache {
  transportation_name?: string;
  full_name?: string;
  mobile_number?: string;
  business_name?: string;
  address?: string;
  contact_number?: string;
  business_email?: string;
}

function profileCacheKey(userId: string): string {
  return `vcs.settings.profile.${userId}`;
}

function readProfileCache(userId: string): SettingsProfileCache {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(profileCacheKey(userId));
    return raw ? (JSON.parse(raw) as SettingsProfileCache) : {};
  } catch {
    return {};
  }
}

function writeProfileCache(userId: string, fields: SettingsProfileCache): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(profileCacheKey(userId), JSON.stringify(fields));
  } catch {
    /* ignore quota / private mode */
  }
}

function vehicleStatusCacheKey(userId: string): string {
  return `vcs.vehicleStatus.${userId}`;
}

function readVehicleStatusCache(userId: string): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(vehicleStatusCacheKey(userId));
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function writeVehicleStatusOverride(userId: string, id: string, isActive: boolean): void {
  if (typeof window === "undefined") return;
  try {
    const map = readVehicleStatusCache(userId);
    map[id] = isActive;
    window.localStorage.setItem(vehicleStatusCacheKey(userId), JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function isMissingIsActiveColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  if (!msg.includes("is_active")) return false;
  return (
    error.code === "PGRST204" || msg.includes("schema cache") || msg.includes("could not find")
  );
}

function toVehicle(r: VehicleRow): Vehicle {
  return {
    _id: r.id,
    name: r.name,
    type: r.type,
    model: r.model,
    vehicleNumber: r.vehicle_number,
    notes: r.notes,
    isActive: typeof r.is_active === "boolean" ? r.is_active : true,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toItems(value: unknown): OtherExpenseItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((i): i is { name?: unknown; amount?: unknown } => typeof i === "object" && i !== null)
    .map((i) => ({ name: String(i.name ?? ""), amount: Number(i.amount ?? 0) || 0 }));
}

function toTrip(r: TripRow): Trip {
  const otherExpenseItems = toItems(r.other_expense_items);
  return {
    _id: r.id,
    vehicleId: r.vehicle_id,
    date: r.date,
    income: Number(r.income) || 0,
    diesel: Number(r.diesel) || 0,
    driverPayment: Number(r.driver_payment) || 0,
    emiShare: Number(r.emi_share) || 0,
    otherExpenseItems,
    otherExpenses: sumOtherExpenses(otherExpenseItems),
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toSettings(r: SettingsRow): AppSettings {
  return {
    _id: r.id,
    appName: r.app_name,
    transportationName: r.transportation_name ?? "",
    currency: r.currency,
    defaultVehicleId: r.default_vehicle_id,
    fullName: r.full_name ?? "",
    mobileNumber: r.mobile_number ?? "",
    businessName: r.business_name ?? "",
    address: r.address ?? "",
    contactNumber: r.contact_number ?? "",
    businessEmail: r.business_email ?? "",
    updatedAt: r.updated_at,
  };
}

function tripInsert(payload: TripPayload, userId: string) {
  const items = payload.otherExpenseItems
    .filter((i) => i.name.trim() || Number(i.amount) > 0)
    .map((i) => ({ name: sanitizeString(i.name), amount: Number(i.amount) || 0 }));
  return {
    vehicle_id: payload.vehicleId,
    user_id: userId,
    date: payload.date,
    income: Number(payload.income) || 0,
    diesel: Number(payload.diesel) || 0,
    driver_payment: Number(payload.driverPayment) || 0,
    emi_share: Number(payload.emiShare) || 0,
    other_expense_items: items,
    notes: sanitizeString(payload.notes ?? ""),
  };
}

function vehicleInsert(payload: VehiclePayload, userId: string, includeIsActive = true) {
  const row = {
    name: sanitizeString(payload.name),
    type: sanitizeString(payload.type),
    model: sanitizeString(payload.model ?? ""),
    vehicle_number: sanitizeString(payload.vehicleNumber ?? ""),
    notes: sanitizeString(payload.notes ?? ""),
    user_id: userId,
    ...(includeIsActive ? { is_active: payload.isActive ?? true } : {}),
  };
  return row;
}

type VehicleWriteResult = {
  data: unknown;
  error: { code?: string; message: string } | null;
};

async function runVehicleWrite(
  build: (includeIsActive: boolean) => PromiseLike<VehicleWriteResult>,
): Promise<VehicleWriteResult> {
  const first = await build(true);
  if (first.error && isMissingIsActiveColumn(first.error)) {
    return build(false);
  }
  return first;
}

/* ---------------- api ---------------- */

async function listTrips(params: {
  vehicleId?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<Trip[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  let q = supabase
    .from("trips")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (params.vehicleId && params.vehicleId !== ALL_VEHICLES)
    q = q.eq("vehicle_id", params.vehicleId);
  if (params.fromDate) q = q.gte("date", params.fromDate);
  if (params.toDate) q = q.lte("date", params.toDate);
  const { data, error } = await q;
  if (error) fail(error);
  return (data as TripRow[]).map(toTrip);
}

export const api = {
  health: async () => {
    const { error } = await supabase.from("app_settings").select("id").limit(1);
    if (error) fail(error);
    return { status: "ok", database: "connected" };
  },

  listVehicles: async (): Promise<Vehicle[]> => {
    const userId = await getCurrentUserId();
    if (!userId) return [];
    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error) fail(error);
    const statusCache = readVehicleStatusCache(userId);
    return (data as VehicleRow[]).map((row) => {
      const v = toVehicle(row);
      const cached = statusCache[v._id];
      return typeof cached === "boolean" ? { ...v, isActive: cached } : v;
    });
  },

  createVehicle: async (payload: VehiclePayload): Promise<Vehicle> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new ApiError("Authentication required");
    const { data, error } = await runVehicleWrite((includeIsActive) =>
      supabase
        .from("vehicles")
        .insert(vehicleInsert(payload, userId, includeIsActive))
        .select("*")
        .single(),
    );
    if (error) fail(error);
    return toVehicle(data as VehicleRow);
  },

  updateVehicle: async (id: string, payload: VehiclePayload): Promise<Vehicle> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new ApiError("Authentication required");
    const { data, error } = await runVehicleWrite((includeIsActive) =>
      supabase
        .from("vehicles")
        .update(vehicleInsert(payload, userId, includeIsActive))
        .eq("id", id)
        .eq("user_id", userId)
        .select("*")
        .single(),
    );
    if (error) fail(error);
    return toVehicle(data as VehicleRow);
  },

  deleteVehicle: async (id: string): Promise<{ deletedTrips: number }> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new ApiError("Authentication required");
    const { count } = await supabase
      .from("trips")
      .select("id", { count: "exact", head: true })
      .eq("vehicle_id", id)
      .eq("user_id", userId);
    const { error } = await supabase.from("vehicles").delete().eq("id", id).eq("user_id", userId);
    if (error) fail(error);
    return { deletedTrips: count ?? 0 };
  },

  toggleVehicleStatus: async (id: string, isActive: boolean): Promise<void> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new ApiError("Authentication required");
    const { error } = await supabase
      .from("vehicles")
      .update(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { is_active: isActive } as any,
      )
      .eq("id", id)
      .eq("user_id", userId);
    if (error && isMissingIsActiveColumn(error)) {
      writeVehicleStatusOverride(userId, id, isActive);
      return;
    }
    if (error) fail(error);
    writeVehicleStatusOverride(userId, id, isActive);
  },

  listTrips,

  createTrip: async (payload: TripPayload): Promise<Trip> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new ApiError("Authentication required");
    const { data, error } = await supabase
      .from("trips")
      .insert(tripInsert(payload, userId))
      .select("*")
      .single();
    if (error) fail(error);
    return toTrip(data as TripRow);
  },

  updateTrip: async (id: string, payload: TripPayload): Promise<Trip> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new ApiError("Authentication required");
    const { data, error } = await supabase
      .from("trips")
      .update(tripInsert(payload, userId))
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) fail(error);
    return toTrip(data as TripRow);
  },

  deleteTrip: async (id: string): Promise<{ _id: string }> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new ApiError("Authentication required");
    const { error } = await supabase.from("trips").delete().eq("id", id).eq("user_id", userId);
    if (error) fail(error);
    return { _id: id };
  },

  report: async (params: {
    vehicleId: string;
    fromDate: string;
    toDate: string;
  }): Promise<ReportPayload> => {
    const [vehicles, trips] = await Promise.all([api.listVehicles(), listTrips(params)]);
    const names = new Map(
      vehicles.map((v) => [
        v._id,
        v.vehicleNumber ? `${v.type || v.name} ${v.vehicleNumber}` : v.type || v.name,
      ]),
    );

    const rows: ReportRow[] = [...trips]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((t) => {
        const totalExpense = totalExpenseOf(t);
        return {
          ...t,
          vehicleName: names.get(t.vehicleId) ?? "Unknown vehicle",
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
      vehicleLabel: isAll ? "All vehicles" : (names.get(params.vehicleId) ?? "Unknown vehicle"),
      fromDate: params.fromDate,
      toDate: params.toDate,
      summary,
      rows,
    };
  },

  getSettings: async (): Promise<AppSettings> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new ApiError("Authentication required");

    const baseCols = "id, app_name, currency, default_vehicle_id, updated_at";
    const profileCols =
      "transportation_name, full_name, mobile_number, business_name, address, contact_number, business_email";

    let { data, error } = await supabase
      .from("app_settings")
      .select(`${baseCols}, ${profileCols}`)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    let profileFromCache = false;
    if (error && isMissingSettingsColumn(error)) {
      profileFromCache = true;
      ({ data, error } = await supabase
        .from("app_settings")
        .select(baseCols)
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle());
    }
    if (error) fail(error);

    if (data) {
      const base = data as SettingsRow;
      return toSettings(profileFromCache ? { ...base, ...readProfileCache(userId) } : base);
    }

    const created = await supabase
      .from("app_settings")
      .insert({ app_name: "Vehicle Calculation System", currency: "INR", user_id: userId })
      .select(`${baseCols}, user_id`)
      .single();
    if (created.error) fail(created.error);
    return toSettings({
      ...(created.data as SettingsRow),
      ...readProfileCache(userId),
    });
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
    const userId = await getCurrentUserId();
    if (!userId) throw new ApiError("Authentication required");
    const current = await api.getSettings();
    const { data, error } = await supabase
      .from("app_settings")
      .update({
        app_name: payload.appName,
        currency: payload.currency,
        default_vehicle_id: payload.defaultVehicleId,
      })
      .eq("id", current._id)
      .eq("user_id", userId)
      .select("id, app_name, currency, default_vehicle_id, updated_at")
      .single();
    if (error) fail(error);
    const optional = await supabase
      .from("app_settings")
      .update({
        transportation_name: sanitizeString(payload.transportationName),
        full_name: sanitizeString(payload.fullName),
        mobile_number: sanitizeNumber(payload.mobileNumber),
        business_name: sanitizeString(payload.businessName),
        address: sanitizeString(payload.address),
        contact_number: sanitizeNumber(payload.contactNumber),
        business_email: sanitizeEmail(payload.businessEmail),
      })
      .eq("id", current._id)
      .eq("user_id", userId);

    const profileFields: SettingsProfileCache = {
      transportation_name: sanitizeString(payload.transportationName),
      full_name: sanitizeString(payload.fullName),
      mobile_number: sanitizeNumber(payload.mobileNumber),
      business_name: sanitizeString(payload.businessName),
      address: sanitizeString(payload.address),
      contact_number: sanitizeNumber(payload.contactNumber),
      business_email: sanitizeEmail(payload.businessEmail),
    };

    if (optional.error && isMissingSettingsColumn(optional.error)) {
      writeProfileCache(userId, profileFields);
    } else if (optional.error) {
      fail(optional.error);
    }

    return {
      ...current,
      ...profileFields,
      appName: payload.appName,
      transportationName: payload.transportationName,
      currency: payload.currency,
      defaultVehicleId: payload.defaultVehicleId,
      fullName: payload.fullName,
      mobileNumber: payload.mobileNumber,
      businessName: payload.businessName,
      address: payload.address,
      contactNumber: payload.contactNumber,
      businessEmail: payload.businessEmail,
      updatedAt: (data as SettingsRow | null)?.updated_at ?? current.updatedAt,
    };
  },
};
