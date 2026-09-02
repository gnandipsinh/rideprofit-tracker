import type { Request, Response } from "express";
import { Settings } from "../models/Settings";
import { settingsSchema } from "../utils/validators";

export async function getSettings(_req: Request, res: Response) {
  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({ appName: "Vehicle Calculation System", currency: "INR" });
  }
  res.json({ success: true, data: settings });
}

export async function updateSettings(req: Request, res: Response) {
  const body = settingsSchema.parse(req.body);
  const settings = await Settings.findOneAndUpdate({}, body, {
    new: true,
    upsert: true,
    runValidators: true,
    setDefaultsOnInsert: true,
  });
  res.json({ success: true, data: settings });
}
