import type { Request, Response } from "express";
import { Settings } from "../models/Settings";
import { settingsSchema } from "../utils/validators";

export async function getSettings(req: Request, res: Response) {
  const userId = req.authUser!.id;
  let settings = await Settings.findOne({ userId });
  if (!settings) {
    settings = await Settings.create({ userId, appName: "Vehicle Calculation System", currency: "INR" });
  }
  res.json({ success: true, data: settings });
}

export async function updateSettings(req: Request, res: Response) {
  const body = settingsSchema.parse(req.body);
  const settings = await Settings.findOneAndUpdate({ userId: req.authUser!.id }, { ...body, userId: req.authUser!.id }, {
    new: true,
    upsert: true,
    runValidators: true,
    setDefaultsOnInsert: true,
  });
  res.json({ success: true, data: settings });
}
