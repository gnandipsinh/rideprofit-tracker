import type { Request, Response } from "express";
import { Trip } from "../models/Trip";
import { Vehicle } from "../models/Vehicle";
import { reportQuerySchema, parseDayEnd, parseDayStart } from "../utils/validators";
import { profit, totalExpense } from "../utils/calc";

export async function getReport(req: Request, res: Response) {
  const { vehicleId, fromDate, toDate } = reportQuerySchema.parse(req.query);

  const from = parseDayStart(fromDate);
  const to = parseDayEnd(toDate);

  const userId = req.authUser!.id;
  const filter: Record<string, unknown> = { userId, date: { $gte: from, $lte: to } };
  if (vehicleId !== "all") filter.vehicleId = vehicleId;

  const [trips, vehicles] = await Promise.all([
    Trip.find(filter).sort({ date: 1, createdAt: 1 }).lean(),
    Vehicle.find({ userId }).lean(),
  ]);

  const vehicleName = new Map(vehicles.map((v) => [String(v._id), v.name]));

  const rows = trips.map((t) => {
    const amounts = {
      income: t.income,
      diesel: t.diesel,
      driverPayment: t.driverPayment,
      otherExpenses: t.otherExpenses,
      emiShare: t.emiShare,
    };
    return {
      ...t,
      vehicleName: vehicleName.get(String(t.vehicleId)) ?? "Unknown vehicle",
      totalExpense: totalExpense(amounts),
      profit: profit(amounts),
    };
  });

  const summary = rows.reduce(
    (acc, r) => ({
      trips: acc.trips + 1,
      income: acc.income + r.income,
      diesel: acc.diesel + r.diesel,
      driverPayment: acc.driverPayment + r.driverPayment,
      otherExpenses: acc.otherExpenses + r.otherExpenses,
      emiShare: acc.emiShare + r.emiShare,
      totalExpense: acc.totalExpense + r.totalExpense,
      profit: acc.profit + r.profit,
    }),
    {
      trips: 0,
      income: 0,
      diesel: 0,
      driverPayment: 0,
      otherExpenses: 0,
      emiShare: 0,
      totalExpense: 0,
      profit: 0,
    },
  );

  res.json({
    success: true,
    data: {
      vehicleId,
      vehicleLabel: vehicleId === "all" ? "All Vehicles" : (vehicleName.get(vehicleId) ?? "Unknown vehicle"),
      fromDate,
      toDate,
      summary,
      rows,
    },
  });
}
