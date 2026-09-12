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

/* ---------------- row mappers ---------------- */

interface VehicleRow {
  id: string;
  name: string;
  type: string;
  model: string;
  vehicle_number: string;
  notes: string;
  created_at: string;
  updated_at: string;
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
}

function isMissingSettingsColumn(error: { code?: string; message?: string } | null): boolean {
  return error?.code === "PGRST204" || error?.message?.includes("column") === true;
}

function toVehicle(r: VehicleRow): Vehicle {
  return {
    _id: r.id,
    name: r.name,
    type: r.type,
    model: r.model,
    vehicleNumber: r.vehicle_number,
    notes: r.notes,
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

function tripInsert(payload: TripPayload) {
  const items = payload.otherExpenseItems
    .filter((i) => i.name.trim() || Number(i.amount) > 0)
    .map((i) => ({ name: i.name.trim() || "Other", amount: Number(i.amount) || 0 }));
  return {
    vehicle_id: payload.vehicleId,
    date: payload.date,
    income: Number(payload.income) || 0,
    diesel: Number(payload.diesel) || 0,
    driver_payment: Number(payload.driverPayment) || 0,
    emi_share: Number(payload.emiShare) || 0,
    other_expense_items: items,
    notes: payload.notes ?? "",
  };
}

function vehicleInsert(payload: VehiclePayload) {
  return {
    name: payload.name.trim(),
    type: payload.type,
    model: payload.model ?? "",
    vehicle_number: payload.vehicleNumber ?? "",
    notes: payload.notes ?? "",
  };
}

/* ---------------- api ---------------- */

async function listTrips(params: {
  vehicleId?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<Trip[]> {
  let q = supabase
    .from("trips")
    .select("*")
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
    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) fail(error);
    return (data as VehicleRow[]).map(toVehicle);
  },

  createVehicle: async (payload: VehiclePayload): Promise<Vehicle> => {
    const { data, error } = await supabase
      .from("vehicles")
      .insert(vehicleInsert(payload))
      .select("*")
      .single();
    if (error) fail(error);
    return toVehicle(data as VehicleRow);
  },

  updateVehicle: async (id: string, payload: VehiclePayload): Promise<Vehicle> => {
    const { data, error } = await supabase
      .from("vehicles")
      .update(vehicleInsert(payload))
      .eq("id", id)
      .select("*")
      .single();
    if (error) fail(error);
    return toVehicle(data as VehicleRow);
  },

  deleteVehicle: async (id: string): Promise<{ deletedTrips: number }> => {
    const { count } = await supabase
      .from("trips")
      .select("id", { count: "exact", head: true })
      .eq("vehicle_id", id);
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (error) fail(error);
    return { deletedTrips: count ?? 0 };
  },

  listTrips,

  createTrip: async (payload: TripPayload): Promise<Trip> => {
    const { data, error } = await supabase
      .from("trips")
      .insert(tripInsert(payload))
      .select("*")
      .single();
    if (error) fail(error);
    return toTrip(data as TripRow);
  },

  updateTrip: async (id: string, payload: TripPayload): Promise<Trip> => {
    const { data, error } = await supabase
      .from("trips")
      .update(tripInsert(payload))
      .eq("id", id)
      .select("*")
      .single();
    if (error) fail(error);
    return toTrip(data as TripRow);
  },

  deleteTrip: async (id: string): Promise<{ _id: string }> => {
    const { error } = await supabase.from("trips").delete().eq("id", id);
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
      vehicles.map((v) => [v._id, v.vehicleNumber ? `${v.name} ${v.vehicleNumber}` : v.name]),
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
    const { data, error } = await supabase
      .from("app_settings")
      .select("id, app_name, currency, default_vehicle_id, updated_at")
      .limit(1)
      .maybeSingle();
    if (error) fail(error);
    if (data) {
      const optional = await supabase
        .from("app_settings")
        .select(
          "transportation_name, full_name, mobile_number, business_name, address, contact_number, business_email",
        )
        .eq("id", data.id)
        .maybeSingle();
      if (optional.error && !isMissingSettingsColumn(optional.error)) fail(optional.error);
      return toSettings({ ...(data as SettingsRow), ...(optional.data ?? {}) });
    }
    const created = await supabase
      .from("app_settings")
      .insert({ app_name: "Vehicle Calculation System", currency: "INR" })
      .select("id, app_name, currency, default_vehicle_id, updated_at")
      .single();
    if (created.error) fail(created.error);
    return toSettings(created.data as SettingsRow);
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
    const current = await api.getSettings();
    const { data, error } = await supabase
      .from("app_settings")
      .update({
        app_name: payload.appName,
        currency: payload.currency,
        default_vehicle_id: payload.defaultVehicleId,
      })
      .eq("id", current._id)
      .select("id, app_name, currency, default_vehicle_id, updated_at")
      .single();
    if (error) fail(error);
    const optional = await supabase
      .from("app_settings")
      .update({
        transportation_name: payload.transportationName,
        full_name: payload.fullName,
        mobile_number: payload.mobileNumber,
        business_name: payload.businessName,
        address: payload.address,
        contact_number: payload.contactNumber,
        business_email: payload.businessEmail,
      })
      .eq("id", current._id);
    if (optional.error && !isMissingSettingsColumn(optional.error)) fail(optional.error);
    return toSettings({
      ...(data as SettingsRow),
      transportation_name: payload.transportationName,
      full_name: payload.fullName,
      mobile_number: payload.mobileNumber,
      business_name: payload.businessName,
      address: payload.address,
      contact_number: payload.contactNumber,
      business_email: payload.businessEmail,
    });
  },
};
