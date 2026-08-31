import { Schema, model, Types, type InferSchemaType } from "mongoose";

const otherExpenseItemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: true },
);

const tripSchema = new Schema(
  {
    vehicleId: { type: Types.ObjectId, ref: "Vehicle", required: true, index: true },
    date: { type: Date, required: true, index: true },
    income: { type: Number, required: true, min: 0, default: 0 },
    diesel: { type: Number, required: true, min: 0, default: 0 },
    driverPayment: { type: Number, required: true, min: 0, default: 0 },
    otherExpenseItems: { type: [otherExpenseItemSchema], default: [] },
    otherExpenses: { type: Number, required: true, min: 0, default: 0 },
    emiShare: { type: Number, required: true, min: 0, default: 0 },
    notes: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

tripSchema.index({ vehicleId: 1, date: -1 });

/** Server is the source of truth for derived amounts. */
tripSchema.pre("validate", function (next) {
  const items = (this.otherExpenseItems ?? []) as Array<{ amount: number }>;
  if (items.length > 0) {
    this.otherExpenses = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }
  next();
});

export type TripDoc = InferSchemaType<typeof tripSchema>;
export const Trip = model("Trip", tripSchema);
