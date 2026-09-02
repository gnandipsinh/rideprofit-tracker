import { Schema, model, type InferSchemaType } from "mongoose";

const vehicleSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true, default: "Truck" },
    model: { type: String, default: "", trim: true },
    vehicleNumber: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

vehicleSchema.index({ name: 1 });

export type VehicleDoc = InferSchemaType<typeof vehicleSchema>;
export const Vehicle = model("Vehicle", vehicleSchema);
