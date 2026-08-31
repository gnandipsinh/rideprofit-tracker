import mongoose from "mongoose";
import { Vehicle } from "../models/Vehicle";
import { Settings } from "../models/Settings";

export async function connectDatabase(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Copy .env.example to .env and fill it in.");
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  console.log("[db] connected");

  await seedDefaults();
}

/** Creates the default vehicle / settings document only when the DB is empty. */
async function seedDefaults(): Promise<void> {
  const vehicleCount = await Vehicle.countDocuments();
  if (vehicleCount === 0) {
    await Vehicle.create({
      name: "Eicher Pro 2114",
      model: "Eicher Pro 2114 24 Ft",
      type: "Truck",
      vehicleNumber: "",
      notes: "",
    });
    console.log("[db] seeded default vehicle");
  }

  const settings = await Settings.findOne();
  if (!settings) {
    await Settings.create({ appName: "Vehicle Calculation System", currency: "INR" });
    console.log("[db] seeded default settings");
  }
}
