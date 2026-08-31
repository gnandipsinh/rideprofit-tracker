import { Router } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../utils/http";
import * as vehicles from "../controllers/vehicleController";
import * as trips from "../controllers/tripController";
import * as reports from "../controllers/reportController";
import * as settings from "../controllers/settingsController";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  res.json({
    success: true,
    data: { status: "ok", database: states[mongoose.connection.readyState] ?? "unknown" },
  });
});

// Vehicles
apiRouter.get("/vehicles", asyncHandler(vehicles.listVehicles));
apiRouter.get("/vehicles/:id", asyncHandler(vehicles.getVehicle));
apiRouter.post("/vehicles", asyncHandler(vehicles.createVehicle));
apiRouter.put("/vehicles/:id", asyncHandler(vehicles.updateVehicle));
apiRouter.delete("/vehicles/:id", asyncHandler(vehicles.deleteVehicle));
apiRouter.get("/vehicles/:vehicleId/trips", asyncHandler(trips.listTripsByVehicle));

// Trips
apiRouter.get("/trips", asyncHandler(trips.listTrips));
apiRouter.get("/trips/:id", asyncHandler(trips.getTrip));
apiRouter.post("/trips", asyncHandler(trips.createTrip));
apiRouter.put("/trips/:id", asyncHandler(trips.updateTrip));
apiRouter.delete("/trips/:id", asyncHandler(trips.deleteTrip));

// Reports
apiRouter.get("/reports", asyncHandler(reports.getReport));

// Settings
apiRouter.get("/settings", asyncHandler(settings.getSettings));
apiRouter.put("/settings", asyncHandler(settings.updateSettings));
