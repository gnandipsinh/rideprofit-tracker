export interface Vehicle {
  _id: string;
  name: string;
  type: string;
  model: string;
  vehicleNumber: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface OtherExpenseItem {
  _id?: string;
  name: string;
  amount: number;
}

export interface Trip {
  _id: string;
  vehicleId: string;
  date: string;
  income: number;
  diesel: number;
  driverPayment: number;
  otherExpenseItems: OtherExpenseItem[];
  otherExpenses: number;
  emiShare: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  _id: string;
  appName: string;
  transportationName: string;
  currency: string;
  defaultVehicleId: string | null;
  updatedAt: string;
  fullName: string;
  mobileNumber: string;
  businessName: string;
  address: string;
  contactNumber: string;
  businessEmail: string;
}

export interface ReportSummary {
  trips: number;
  income: number;
  diesel: number;
  driverPayment: number;
  otherExpenses: number;
  emiShare: number;
  totalExpense: number;
  profit: number;
}

export interface ReportRow extends Trip {
  vehicleName: string;
  totalExpense: number;
  profit: number;
}

export interface ReportPayload {
  vehicleId: string;
  vehicleLabel: string;
  fromDate: string;
  toDate: string;
  summary: ReportSummary;
  rows: ReportRow[];
}

export interface VehiclePayload {
  name: string;
  type: string;
  model: string;
  vehicleNumber: string;
  notes: string;
}

export interface TripPayload {
  vehicleId: string;
  date: string;
  income: number;
  diesel: number;
  driverPayment: number;
  emiShare: number;
  otherExpenseItems: OtherExpenseItem[];
  notes: string;
}

export const VEHICLE_TYPES = [
  "Truck",
  "Eicher",
  "Tractor",
  "Pickup",
  "Bolero",
  "Tempo",
  "Bus",
  "Car",
  "Other",
] as const;

export const ALL_VEHICLES = "all";
