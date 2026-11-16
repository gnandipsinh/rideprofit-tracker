import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  IndianRupee,
  TrendingDown,
  TrendingUp,
  Truck,
  Route as RouteIcon,
  Gauge,
  MapPin,
  User,
  ArrowUpRight,
  Plus,
  FileText,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { VehicleSelector } from "@/components/VehicleSelector";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { TripFormDialog } from "@/components/TripFormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useApp } from "@/lib/app-context";
import { useTrips } from "@/lib/queries";
import { aggregate, profitOf, roundCurrency, totalExpenseOf } from "@/lib/calc";
import { calculateMileage } from "@/lib/whatsapp";
import {
  formatDateShort,
  formatIndianNumber,
  formatMoney,
  isoDayOnly,
  todayInput,
} from "@/lib/format";
import { DASHBOARD_PRESETS, dashboardRange, type DashboardPreset } from "@/lib/date-ranges";
import { cn } from "@/lib/utils";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

export function DashboardPage() {
  const {
    symbol,
    appName,
    userName,
    selectedVehicleId,
    vehicles,
    activeVehicles,
    vehiclesLoading,
    vehiclesError,
    refetchVehicles,
  } = useApp();
  const [preset, setPreset] = useState<DashboardPreset>("month");
  const [tripDialogOpen, setTripDialogOpen] = useState(false);
  const [custom, setCustom] = useState({
    fromDate: todayInput(),
    toDate: todayInput(),
  });

  const range = useMemo(() => dashboardRange(preset, custom), [preset, custom]);
  const tripsQuery = useTrips({
    vehicleId: selectedVehicleId || "all",
    fromDate: range.fromDate,
    toDate: range.toDate,
  });

  const activeVehicleIds = useMemo(
    () => new Set(activeVehicles.map((v) => v._id)),
    [activeVehicles],
  );
  const trips = useMemo(() => {
    const raw = tripsQuery.data ?? [];
    if (activeVehicleIds.size === 0) return raw;
    return raw.filter((t) => activeVehicleIds.has(t.vehicleId));
  }, [tripsQuery.data, activeVehicleIds]);

  const totals = useMemo(() => aggregate(trips), [trips]);
  const recentTrips = useMemo(
    () => [...trips].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6),
    [trips],
  );
  const vehicleLabel = useMemo(
    () =>
      new Map(
        activeVehicles.map((v) => [
          v._id,
          v.vehicleNumber ? `${v.type || v.name} · ${v.vehicleNumber}` : v.type || v.name,
        ]),
      ),
    [activeVehicles],
  );

  // Time-series chart data
  const chartData = useMemo(() => {
    const byDay = new Map<
      string,
      { day: string; income: number; expense: number; profit: number }
    >();
    trips.forEach((t) => {
      const day = isoDayOnly(t.date);
      const expense = totalExpenseOf(t);
      const profit = profitOf(t);
      const entry = byDay.get(day) ?? {
        day,
        income: 0,
        expense: 0,
        profit: 0,
      };
      entry.income = roundCurrency(entry.income + (Number(t.income) || 0));
      entry.expense = roundCurrency(entry.expense + expense);
      entry.profit = roundCurrency(entry.profit + profit);
      byDay.set(day, entry);
    });

    const items = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));

    // If data is small, provide monthly or continuous markers
    if (items.length === 0) {
      return [];
    }

    return items.slice(-14).map((d) => ({
      ...d,
      label: formatDateShort(d.day).slice(0, 6),
    }));
  }, [trips]);

  const profitMarginPercent = useMemo(() => {
    if (totals.income <= 0) return 0;
    const margin = (totals.profit / totals.income) * 100;
    return Math.round(margin * 10) / 10;
  }, [totals]);

  const presetLabel = DASHBOARD_PRESETS.find((p) => p.value === preset)?.label ?? "This Month";

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Top Controls: Greeting & Quick Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {getGreeting()}
              {userName ? `, ${userName}` : ""}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              {appName || "RideProfit Tracker"} · Vehicle accounting & profit tracker
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => setTripDialogOpen(true)}
              className="h-10 px-4 rounded-xl font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-md shadow-cyan-500/20"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add Trip
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-10 px-4 rounded-xl font-semibold border-[#1C2B44] bg-[#10192A] text-white hover:bg-[#132137]"
            >
              <Link to="/vehicles">
                <Truck className="mr-1.5 h-4 w-4 text-cyan-400" />
                Add Vehicle
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-10 px-4 rounded-xl font-semibold border-[#1C2B44] bg-[#10192A] text-slate-300 hover:text-white hover:bg-[#132137]"
            >
              <Link to="/reports">
                <FileText className="mr-1.5 h-4 w-4 text-cyan-400" />
                Reports
              </Link>
            </Button>
          </div>
        </div>

        {/* Vehicle Selector Strip */}
        <div className="rounded-2xl border border-[#1C2B44] bg-[#10192A] p-3.5">
          <VehicleSelector />
        </div>

        {/* Date Presets Row */}
        <div className="rounded-2xl border border-[#1C2B44] bg-[#10192A] p-2 sm:p-2.5">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
            {DASHBOARD_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPreset(p.value)}
                className={cn(
                  "tap-scale shrink-0 min-h-[36px] rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all",
                  preset === p.value
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20"
                    : "text-slate-400 hover:text-white hover:bg-[#132137]",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === "custom" ? (
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={custom.fromDate}
                onChange={(e) =>
                  setCustom((c) => ({
                    ...c,
                    fromDate: e.target.value,
                  }))
                }
                className="h-10 rounded-xl bg-[#080D18] border-[#1C2B44] text-xs text-white"
              />
              <Input
                type="date"
                value={custom.toDate}
                onChange={(e) =>
                  setCustom((c) => ({
                    ...c,
                    toDate: e.target.value,
                  }))
                }
                className="h-10 rounded-xl bg-[#080D18] border-[#1C2B44] text-xs text-white"
              />
            </div>
          ) : null}
        </div>

        {/* 4 KPI Cards (Matching Mockup exactly) */}
        {vehiclesError ? (
          <EmptyState
            icon={<Truck className="h-6 w-6" />}
            title="Could not load your vehicles"
            description={
              vehiclesError.message || "The vehicle data service is unavailable. Try again shortly."
            }
            action={
              <Button
                type="button"
                className="h-11 rounded-xl px-5 font-semibold bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                onClick={() => void refetchVehicles()}
              >
                Retry
              </Button>
            }
          />
        ) : !vehiclesLoading && vehicles.length === 0 ? (
          <EmptyState
            icon={<Truck className="h-6 w-6" />}
            title="Add your first vehicle"
            description="Vehicles keep every trip, expense and report separated."
            action={
              <Button
                asChild
                className="h-11 rounded-xl px-5 font-semibold bg-cyan-500 text-slate-950 hover:bg-cyan-400"
              >
                <Link to="/vehicles">Add Vehicle</Link>
              </Button>
            }
          />
        ) : !vehiclesLoading && activeVehicles.length === 0 ? (
          <EmptyState
            icon={<Truck className="h-6 w-6" />}
            title="No active vehicles"
            description="Activate a vehicle on the Vehicles page to see dashboard stats."
            action={
              <Button
                asChild
                className="h-11 rounded-xl px-5 font-semibold bg-cyan-500 text-slate-950 hover:bg-cyan-400"
              >
                <Link to="/vehicles">Go to Vehicles</Link>
              </Button>
            }
          />
        ) : tripsQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl bg-[#10192A]" />
            ))}
          </div>
        ) : tripsQuery.isError ? (
          <EmptyState
            icon={<RouteIcon className="h-6 w-6" />}
            title="Could not load trip records"
            description={
              tripsQuery.error instanceof Error
                ? tripsQuery.error.message
                : "The trip service is temporarily unavailable."
            }
            action={
              <Button
                type="button"
                className="h-11 rounded-xl px-5 font-semibold bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                onClick={() => void tripsQuery.refetch()}
              >
                Retry
              </Button>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {/* 1. Total Income */}
              <StatCard
                label="Total Income"
                value={formatMoney(totals.income, symbol)}
                tone="cyan"
                icon={<IndianRupee className="h-5 w-5" />}
                sub={
                  totals.trips > 0
                    ? `${presetLabel} · ${totals.trips} trip${totals.trips === 1 ? "" : "s"}`
                    : `${presetLabel} · No trips yet`
                }
              />

              {/* 2. Total Expenses */}
              <StatCard
                label="Total Expenses"
                value={formatMoney(totals.totalExpense, symbol)}
                tone="danger"
                icon={<TrendingDown className="h-5 w-5" />}
                sub={
                  totals.income > 0
                    ? `${Math.round((totals.totalExpense / totals.income) * 100)}% of income`
                    : "Diesel, driver & EMI"
                }
              />

              {/* 3. Net Profit */}
              <StatCard
                label="Net Profit"
                value={formatMoney(totals.profit, symbol)}
                tone={totals.profit >= 0 ? "success" : "danger"}
                icon={<TrendingUp className="h-5 w-5" />}
                sub={`${profitMarginPercent}% profit margin`}
              />

              {/* 4. Total Trips */}
              <StatCard
                label="Total Trips"
                value={formatIndianNumber(totals.trips)}
                tone="purple"
                icon={<RouteIcon className="h-5 w-5" />}
                sub={`${activeVehicles.length} active vehicle${activeVehicles.length === 1 ? "" : "s"}`}
              />
            </div>

            {/* Recent Trips Table directly below KPIs */}
            <div className="rounded-2xl border border-[#1C2B44] bg-[#10192A] overflow-hidden">
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#1C2B44]">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Recent Trips</h3>
                  <p className="text-xs text-slate-400">Latest trip entries in selected period</p>
                </div>
                <Link
                  to="/trips"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-400 hover:text-cyan-300"
                >
                  <span>View All Trips</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {recentTrips.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm font-semibold text-slate-300">No trips recorded yet</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Tap Add Trip above to record your first vehicle run.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#080D18] text-slate-400 uppercase tracking-wider font-semibold border-b border-[#1C2B44]">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Vehicle</th>
                        <th className="px-4 py-3">Route</th>
                        <th className="px-4 py-3">Driver</th>
                        <th className="px-4 py-3">Mileage</th>
                        <th className="px-4 py-3 text-right">Income</th>
                        <th className="px-4 py-3 text-right">Expenses</th>
                        <th className="px-4 py-3 text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1C2B44]/70">
                      {recentTrips.map((t) => {
                        const profit = profitOf(t);
                        const expense = totalExpenseOf(t);
                        const mileage =
                          t.totalKm && t.dieselLiters
                            ? calculateMileage(t.totalKm, t.dieselLiters)
                            : null;
                        return (
                          <tr key={t._id} className="hover:bg-[#132137]/50 transition-colors">
                            <td className="px-4 py-3.5 text-slate-300 font-medium whitespace-nowrap">
                              {formatDateShort(t.date)}
                            </td>
                            <td className="px-4 py-3.5 font-bold text-white whitespace-nowrap">
                              {vehicleLabel.get(t.vehicleId) ?? "Vehicle"}
                            </td>
                            <td className="px-4 py-3.5 text-slate-300 whitespace-nowrap">
                              {t.route ? (
                                <span className="inline-flex items-center gap-1 text-cyan-400">
                                  <MapPin className="h-3 w-3" />
                                  {t.route}
                                </span>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-slate-300 whitespace-nowrap">
                              {t.driverName ? (
                                <span className="inline-flex items-center gap-1">
                                  <User className="h-3 w-3 text-slate-400" />
                                  {t.driverName}
                                </span>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              {mileage !== null ? (
                                <span className="inline-flex items-center gap-1 font-semibold text-amber-400 tabular-nums">
                                  <Gauge className="h-3 w-3" />
                                  {mileage} km/L
                                </span>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-right font-semibold text-white tabular-nums whitespace-nowrap">
                              {formatMoney(Number(t.income) || 0, symbol)}
                            </td>
                            <td className="px-4 py-3.5 text-right font-semibold text-rose-400 tabular-nums whitespace-nowrap">
                              {formatMoney(expense, symbol)}
                            </td>
                            <td className="px-4 py-3.5 text-right font-bold tabular-nums whitespace-nowrap">
                              <span
                                className={cn(profit >= 0 ? "text-emerald-400" : "text-rose-400")}
                              >
                                {formatMoney(profit, symbol)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Single Clean Income vs Expenses Chart */}
            <div className="rounded-2xl border border-[#1C2B44] bg-[#10192A] p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Income vs Expenses
                  </h3>
                  <p className="text-xs text-slate-400">
                    Daily revenue and expenses in selected period
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-cyan-400">
                    <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 inline-block" />
                    Income
                  </span>
                  <span className="flex items-center gap-1.5 text-purple-400">
                    <span className="h-2.5 w-2.5 rounded-full bg-purple-400 inline-block" />
                    Expenses
                  </span>
                </div>
              </div>

              {chartData.length === 0 ? (
                <div className="h-52 flex flex-col items-center justify-center text-center p-4">
                  <p className="text-sm font-semibold text-slate-300">
                    No trip data in this period
                  </p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Add trips with diesel and income to view your trend chart.
                  </p>
                </div>
              ) : (
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1C2B44" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "#94A3B8" }}
                        axisLine={{ stroke: "#1C2B44" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#94A3B8" }}
                        axisLine={false}
                        tickLine={false}
                        width={48}
                        tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#080D18",
                          borderColor: "#1C2B44",
                          borderRadius: "0.75rem",
                          color: "#fff",
                          fontSize: "12px",
                        }}
                        formatter={(v: unknown) => formatMoney(Number(v) || 0, symbol)}
                      />
                      <Line
                        type="monotone"
                        dataKey="income"
                        name="Income"
                        stroke="#06B6D4"
                        strokeWidth={3}
                        dot={{ r: 3, fill: "#06B6D4" }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="expense"
                        name="Expense"
                        stroke="#A855F7"
                        strokeWidth={3}
                        dot={{ r: 3, fill: "#A855F7" }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <TripFormDialog open={tripDialogOpen} onOpenChange={setTripDialogOpen} />
    </AppShell>
  );
}

export const Route = createFileRoute("/_authenticated/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dashboard — RideProfit Tracker" },
      {
        name: "description",
        content:
          "Fleet-wide accounting dashboard: track daily income, diesel, driver payments, and net profit.",
      },
      { property: "og:title", content: "Dashboard — RideProfit Tracker" },
      {
        property: "og:description",
        content: "Track daily trip income, expenses and profit for every vehicle in your fleet.",
      },
    ],
  }),
  component: DashboardPage,
});
