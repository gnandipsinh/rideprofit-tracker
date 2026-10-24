import type { Trip, ReportPayload } from "./types";
import { formatMoney, formatDate } from "./format";
import { profitOf, totalExpenseOf } from "./calc";

/**
 * Calculates vehicle mileage (km per liter) safely.
 */
export function calculateMileage(totalKm?: number, dieselLiters?: number): number | null {
  if (!totalKm || !dieselLiters || totalKm <= 0 || dieselLiters <= 0) {
    return null;
  }
  const val = totalKm / dieselLiters;
  return Number.isFinite(val) ? Number(val.toFixed(2)) : null;
}

/**
 * Builds a formatted WhatsApp text message for a single trip.
 */
export function formatTripWhatsAppMessage(
  trip: Trip,
  vehicleLabel: string,
  companyName: string = "Fleet Transport",
  symbol: string = "₹",
): string {
  const profit = profitOf(trip);
  const totalExp = totalExpenseOf(trip);
  const isProf = profit >= 0;
  const mileage = calculateMileage(trip.totalKm, trip.dieselLiters);

  const lines: string[] = [
    `🚛 *${companyName}*`,
    `📋 *Trip Accounting Summary*`,
    `──────────────────────────`,
    `📅 *Date:* ${formatDate(trip.date)}`,
    `🚛 *Vehicle:* ${vehicleLabel}`,
  ];

  if (trip.route) {
    lines.push(`📍 *Route:* ${trip.route}`);
  }
  if (trip.driverName) {
    lines.push(`👨‍✈️ *Driver:* ${trip.driverName}`);
  }
  if (trip.totalKm || trip.dieselLiters) {
    const kmStr = trip.totalKm ? `${trip.totalKm} km` : "";
    const litStr = trip.dieselLiters ? `${trip.dieselLiters} L` : "";
    const mlStr = mileage ? ` (${mileage} km/L)` : "";
    lines.push(`🛣️ *Run / Mileage:* ${[kmStr, litStr].filter(Boolean).join(" · ")}${mlStr}`);
  }

  lines.push(
    `──────────────────────────`,
    `💰 *Trip Income:* ${formatMoney(trip.income, symbol)}`,
    `⛽ *Diesel Expense:* ${formatMoney(trip.diesel, symbol)}`,
  );

  if (trip.driverPayment > 0) {
    lines.push(`💵 *Driver Payment:* ${formatMoney(trip.driverPayment, symbol)}`);
  }
  if (trip.emiShare > 0) {
    lines.push(`💳 *EMI Share:* ${formatMoney(trip.emiShare, symbol)}`);
  }
  if (trip.otherExpenses > 0) {
    const itemDetails = (trip.otherExpenseItems ?? [])
      .filter((i) => i.name && Number(i.amount) > 0)
      .map((i) => `${i.name}: ${formatMoney(i.amount, symbol)}`)
      .join(", ");
    lines.push(
      `🧾 *Other Expenses:* ${formatMoney(trip.otherExpenses, symbol)}${itemDetails ? ` (${itemDetails})` : ""}`,
    );
  }

  lines.push(
    `──────────────────────────`,
    `📉 *Total Expenses:* ${formatMoney(totalExp, symbol)}`,
    `${isProf ? "✅" : "⚠️"} *${isProf ? "Net Profit" : "Net Loss"}:* ${formatMoney(profit, symbol)}`,
  );

  if (trip.notes) {
    lines.push(`📝 *Notes:* ${trip.notes}`);
  }

  lines.push(`\n_Generated via RideProfit Tracker_`);
  return lines.join("\n");
}

/**
 * Builds a formatted WhatsApp text message for a full report statement.
 */
export function formatReportWhatsAppMessage(
  report: ReportPayload,
  companyName: string = "Fleet Transport",
  symbol: string = "₹",
): string {
  const { summary } = report;
  const isProf = summary.profit >= 0;
  const margin = summary.income > 0 ? Math.round((summary.profit / summary.income) * 100) : 0;

  const lines: string[] = [
    `📊 *${companyName}*`,
    `📑 *Fleet Performance Statement*`,
    `──────────────────────────`,
    `🚛 *Vehicle:* ${report.vehicleLabel}`,
    `📅 *Period:* ${formatDate(report.fromDate)} to ${formatDate(report.toDate)}`,
    `🔢 *Total Trips:* ${summary.trips} completed run(s)`,
    `──────────────────────────`,
    `💰 *Total Income:* ${formatMoney(summary.income, symbol)}`,
    `⛽ *Total Diesel:* ${formatMoney(summary.diesel, symbol)}`,
    `👨‍✈️ *Driver Payments:* ${formatMoney(summary.driverPayment, symbol)}`,
    `💳 *EMI Share:* ${formatMoney(summary.emiShare, symbol)}`,
    `🧾 *Other Expenses:* ${formatMoney(summary.otherExpenses, symbol)}`,
    `──────────────────────────`,
    `📉 *Total Expenses:* ${formatMoney(summary.totalExpense, symbol)}`,
    `${isProf ? "✅" : "⚠️"} *${isProf ? "NET PROFIT" : "NET LOSS"}:* ${formatMoney(summary.profit, symbol)} (${margin}% margin)`,
    `──────────────────────────`,
    `_Generated via RideProfit Fleet Tracker_`,
  ];

  return lines.join("\n");
}

/**
 * Opens WhatsApp with the given text message.
 */
export function openWhatsAppShare(text: string): void {
  const encoded = encodeURIComponent(text);
  const url = `https://wa.me/?text=${encoded}`;
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
