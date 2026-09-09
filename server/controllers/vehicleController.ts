import type { Request, Response } from "express";
import { Vehicle } from "../models/Vehicle";
import { Trip } from "../models/Trip";
import { Settings } from "../models/Settings";
import { HttpError } from "../utils/http";
import { objectId, vehicleSchema } from "../utils/validators";

export async function listVehicles(req: Request, res: Response) {
  const userId = req.authUser!.id;
  const vehicles = await Vehicle.find({ userId }).sort({ createdAt: 1 });
  res.json({ success: true, data: vehicles });
}

export async function getVehicle(req: Request, res: Response) {
  const id = objectId.parse(req.params.id);
  const vehicle = await Vehicle.findOne({ _id: id, userId: req.authUser!.id });
  if (!vehicle) throw new HttpError(404, "Vehicle not found");
  res.json({ success: true, data: vehicle });
}

export async function createVehicle(req: Request, res: Response) {
  const body = vehicleSchema.parse(req.body);
  const vehicle = await Vehicle.create({ ...body, userId: req.authUser!.id });
  res.status(201).json({ success: true, data: vehicle });
}

export async function updateVehicle(req: Request, res: Response) {
  const id = objectId.parse(req.params.id);
  const body = vehicleSchema.parse(req.body);
  const vehicle = await Vehicle.findOneAndUpdate({ _id: id, userId: req.authUser!.id }, body, {
    new: true,
    runValidators: true,
  });
  if (!vehicle) throw new HttpError(404, "Vehicle not found");
  res.json({ success: true, data: vehicle });
}

export async function deleteVehicle(req: Request, res: Response) {
  const id = objectId.parse(req.params.id);
  const userId = req.authUser!.id;
  const vehicle = await Vehicle.findOneAndDelete({ _id: id, userId });
  if (!vehicle) throw new HttpError(404, "Vehicle not found");

  const { deletedCount } = await Trip.deleteMany({ vehicleId: id, userId });
  await Settings.updateOne({ userId, defaultVehicleId: id }, { $set: { defaultVehicleId: null } });

  res.json({ success: true, data: { deletedTrips: deletedCount ?? 0 } });
}
