import type { Request, Response } from "express";
import { Trip } from "../models/Trip";
import { Vehicle } from "../models/Vehicle";
import { HttpError } from "../utils/http";
import { objectId, parseDayEnd, parseDayStart, tripSchema } from "../utils/validators";

function buildFilter(query: Request["query"]) {
  const filter: Record<string, unknown> = {};
  if (typeof query.vehicleId === "string" && query.vehicleId && query.vehicleId !== "all") {
    filter.vehicleId = objectId.parse(query.vehicleId);
  }
  if (typeof query.fromDate === "string" && query.fromDate) {
    filter.date = { ...(filter.date as object), $gte: parseDayStart(query.fromDate) };
  }
  if (typeof query.toDate === "string" && query.toDate) {
    filter.date = { ...(filter.date as object), $lte: parseDayEnd(query.toDate) };
  }
  return filter;
}

export async function listTrips(req: Request, res: Response) {
  const filter = buildFilter(req.query);
  const limit = Math.min(Number(req.query.limit) || 500, 2000);
  const page = Math.max(Number(req.query.page) || 1, 1);

  const [trips, total] = await Promise.all([
    Trip.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Trip.countDocuments(filter),
  ]);

  res.json({ success: true, data: trips, meta: { total, page, limit } });
}

export async function listTripsByVehicle(req: Request, res: Response) {
  const vehicleId = objectId.parse(req.params.vehicleId);
  const trips = await Trip.find({ vehicleId }).sort({ date: -1, createdAt: -1 });
  res.json({ success: true, data: trips });
}

export async function getTrip(req: Request, res: Response) {
  const id = objectId.parse(req.params.id);
  const trip = await Trip.findById(id);
  if (!trip) throw new HttpError(404, "Trip not found");
  res.json({ success: true, data: trip });
}

async function normalize(body: unknown) {
  const parsed = tripSchema.parse(body);
  const vehicle = await Vehicle.findById(parsed.vehicleId);
  if (!vehicle) throw new HttpError(400, "Selected vehicle does not exist");

  const otherExpenses =
    parsed.otherExpenseItems.length > 0
      ? parsed.otherExpenseItems.reduce((sum, i) => sum + i.amount, 0)
      : (parsed.otherExpenses ?? 0);

  return { ...parsed, otherExpenses, date: parseDayStart(parsed.date) };
}

export async function createTrip(req: Request, res: Response) {
  const payload = await normalize(req.body);
  const trip = await Trip.create(payload);
  res.status(201).json({ success: true, data: trip });
}

export async function updateTrip(req: Request, res: Response) {
  const id = objectId.parse(req.params.id);
  const payload = await normalize(req.body);
  const trip = await Trip.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
  if (!trip) throw new HttpError(404, "Trip not found");
  res.json({ success: true, data: trip });
}

export async function deleteTrip(req: Request, res: Response) {
  const id = objectId.parse(req.params.id);
  const trip = await Trip.findByIdAndDelete(id);
  if (!trip) throw new HttpError(404, "Trip not found");
  res.json({ success: true, data: { _id: id } });
}
