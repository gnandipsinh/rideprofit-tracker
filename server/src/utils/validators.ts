import { z } from "zod";
import { Types } from "mongoose";

export const objectId = z.string().refine((v) => Types.ObjectId.isValid(v), "invalid id");

const money = z.coerce.number().min(0, "must be 0 or more").finite();

export const vehicleSchema = z.object({
  name: z.string().trim().min(1, "Vehicle name is required"),
  type: z.string().trim().min(1, "Vehicle type is required"),
  model: z.string().trim().default(""),
  vehicleNumber: z.string().trim().default(""),
  notes: z.string().trim().default(""),
});

export const otherExpenseItemSchema = z.object({
  name: z.string().trim().min(1, "Expense name is required"),
  amount: money,
});

export const tripSchema = z.object({
  vehicleId: objectId,
  date: z.string().min(1, "Date is required"),
  income: money.default(0),
  diesel: money.default(0),
  driverPayment: money.default(0),
  emiShare: money.default(0),
  otherExpenseItems: z.array(otherExpenseItemSchema).default([]),
  otherExpenses: money.optional(),
  notes: z.string().trim().default(""),
});

export const settingsSchema = z.object({
  appName: z.string().trim().min(1, "Application name is required"),
  currency: z.string().trim().min(1).default("INR"),
  defaultVehicleId: objectId.nullable().optional(),
});

export const reportQuerySchema = z.object({
  vehicleId: z.union([objectId, z.literal("all")]).default("all"),
  fromDate: z.string().min(1),
  toDate: z.string().min(1),
});

/** Parse "YYYY-MM-DD" as a UTC instant so reports never shift by timezone. */
export function parseDayStart(value: string): Date {
  const iso = value.length === 10 ? `${value}T00:00:00.000Z` : value;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${value}`);
  return d;
}

export function parseDayEnd(value: string): Date {
  const iso = value.length === 10 ? `${value}T23:59:59.999Z` : value;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${value}`);
  return d;
}
