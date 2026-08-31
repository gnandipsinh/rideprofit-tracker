import type { Request, Response } from "express";
import { Vehicle } from "../models/Vehicle";
import { Trip } from "../models/Trip";
import { Settings } from "../models/Settings";
import { HttpError } from "../utils/http";
import { objectId, vehicleSchema } from "../utils/validators";

export async function listVehicles(_req: Request, res: Response) {
  const vehicles = await Vehicle.find().sort({ createdAt: 1 });
  res.json({ success: true, data: vehicles });
}

export async function getVehicle(req: Request, res: Response) {
  const id = objectId.parse(req.params.id);
  const vehicle = await Vehicle.findById(id);
  if (!vehicle) throw new HttpError(404, "Vehicle not found");
  res.json({ success: true, data: vehicle });
}

export async function createVehicle(req: Request, res: Response) {
  const body = vehicleSchema.parse(req.body);
  const vehicle = await Vehicle.create(body);
  res.status(201).json({ success: true, data: vehicle });
}

export async function updateVehicle(req: Request, res: Response) {
  const id = objectId.parse(req.params.id);
  const body = vehicleSchema.parse(req.body);
  const vehicle = await Vehicle.findByIdAndUpdate(id, body, { new: true, runValidators: true });
  if (!vehicle) throw new HttpError(404, "Vehicle not found");
  res.json({ success: true, data: vehicle });
}

export async function deleteVehicle(req: Request, res: Response) {
  const id = objectId.parse(req.params.id);
  const vehicle = await Vehicle.findByIdAndDelete(id);
  if (!vehicle) throw new HttpError(404, "Vehicle not found");

  const { deletedCount } = await Trip.deleteMany({ vehicleId: id });
  await Settings.updateOne({ defaultVehicleId: id }, { $set: { defaultVehicleId: null } });

  res.json({ success: true, data: { deletedTrips: deletedCount ?? 0 } });
}
