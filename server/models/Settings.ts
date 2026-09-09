import { Schema, model, Types, type InferSchemaType } from "mongoose";

const settingsSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    appName: { type: String, required: true, trim: true, default: "Vehicle Calculation System" },
    currency: { type: String, required: true, trim: true, default: "INR" },
    defaultVehicleId: { type: Types.ObjectId, ref: "Vehicle", default: null },
  },
  { timestamps: true },
);

export type SettingsDoc = InferSchemaType<typeof settingsSchema>;
export const Settings = model("Settings", settingsSchema);
