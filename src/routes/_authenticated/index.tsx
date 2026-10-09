import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BarChart,
  Bar,
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
  Fuel,
  Route as RouteIcon,
  Calendar,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { VehicleSelector } from "@/components/VehicleSelector";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useApp } from "@/lib/app-context";
import { useTrips } from "@/lib/queries";
import { aggregate, profitOf } from "@/lib/calc";
import { formatDateShort, formatIndianNumber, formatMoney, isoDayOnly } from "@/lib/format";
import { DASHBOARD_PRESETS, dashboardRange, type DashboardPreset } from "@/lib/date-ranges";
import { todayInput } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dashboard — Jay Mataji Transport" },
      {
        name: "description",
        content:
          "Vehicle-wise trip accounting dashboard: track daily income, diesel, driver payments, EMI share and net profit.",
      },
      { property: "og:title", content: "Dashboard — Jay Mataji Transport" },
      {
        property: "og:description",
        content: "Track daily trip income, expenses and profit for every vehicle in your fleet.",
      },
    ],
  }),
  component: Dashboard,
});

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function Dashboard() {
  const {
    symbol,
    appName,
    userName,
    selectedVehicleId,
    isAllVehicles,
    vehicles,
    activeVehicles,
    vehiclesLoading,
    vehiclesError,
  } = useApp();
  const [preset, setPreset] = useState<DashboardPreset>("month");
  const [custom, setCustom] = useState({ fromDate: todayInput(), toDate: todayInput() });

  const range = useMemo(() => dashboardRange(preset, custom), [preset, custom]);
  const tripsQuery = useTrips(
    { vehicleId: selectedVehicleId, fromDate: range.fromDate, toDate: range.toDate },
    Boolean(selectedVehicleId),
  );

  const activeVehicleIds = useMemo(
    () => new Set(activeVehicles.map((v) => v._id)),
    [activeVehicles],
  );
  const trips = useMemo(() => {
    const raw = tripsQuery.data ?? [];
    return raw.filter((t) => activeVehicleIds.has(t.vehicleId));
  }, [tripsQuery.data, activeVehicleIds]);
  const totals = useMemo(() => aggregate(trips), [trips]);
  const recentTrips = useMemo(
    () => [...trips].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
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

  const chartData = useMemo(() => {
    const byDay = new Map<
      string,
      { day: string; income: number; expense: number; profit: number }
    >();
    trips.forEach((t) => {
      const day = isoDayOnly(t.date);
      const expense = t.diesel + t.driverPayment + t.otherExpenses + t.emiShare;
      const entry = byDay.get(day) ?? { day, income: 0, expense: 0, profit: 0 };
      entry.income += t.income;
      entry.expense += expense;
      entry.profit += t.income - expense;
      byDay.set(day, entry);
    });
    return [...byDay.values()]
      .sort((a, b) => a.day.localeCompare(b.day))
      .slice(-14)
      .map((d) => ({ ...d, label: formatDateShort(d.day).slice(0, 5) }));
  }, [trips]);

  const presetLabel = DASHBOARD_PRESETS.find((p) => p.value === preset)?.label ?? "This Month";

  return (
    <AppShell>
      <div className="page-stack">
        <div className="flex items-center justify-between gap-2.5">
          <div className="min-w-0">
            <h2 className="truncate text-lg sm:text-xl md:text-2xl font-extrabold">
              {getGreeting()}
              {userName ? `, ${userName}` : ""}
            </h2>
            <p className="truncate text-xs sm:text-sm text-muted-foreground">{appName}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="glass-card rounded-xl px-2.5 py-1.5 text-xs font-semibold text-muted-foreground sm:px-3 sm:py-2">
              <Calendar className="mr-1.5 inline h-3.5 w-3.5 text-primary" />
              {presetLabel}
            </div>
          </div>
        </div>

        <VehicleSelector />

        <div className="glass-card rounded-2xl p-2.5 sm:p-3">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
            {DASHBOARD_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPreset(p.value)}
                className={cn(
                  "tap-scale shrink-0 min-h-[38px] sm:min-h-[42px] rounded-full border border-border px-3.5 sm:px-4 py-1.5 text-xs font-semibold text-muted-foreground transition-all",
                  preset === p.value
                    ? "border-primary/50 bg-primary/15 text-primary shadow-[var(--shadow-gold)] font-bold"
                    : "hover:bg-secondary/60 hover:text-foreground",
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
                onChange={(e) => setCustom((c) => ({ ...c, fromDate: e.target.value }))}
                className="h-10 sm:h-11 rounded-xl bg-secondary/60 text-xs sm:text-sm"
              />
              <Input
                type="date"
                value={custom.toDate}
                onChange={(e) => setCustom((c) => ({ ...c, toDate: e.target.value }))}
                className="h-10 sm:h-11 rounded-xl bg-secondary/60 text-xs sm:text-sm"
              />
            </div>
          ) : null}
        </div>

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
                className="h-11 rounded-xl px-5 font-semibold"
                onClick={() => window.location.reload()}
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
              <Button asChild className="h-11 rounded-xl px-5 font-semibold">
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
              <Button asChild className="h-11 rounded-xl px-5 font-semibold">
                <Link to="/vehicles">Go to Vehicles</Link>
              </Button>
            }
          />
        ) : tripsQuery.isError ? (
          <EmptyState
            icon={<RouteIcon className="h-6 w-6" />}
            title="Could not load trips"
            description={
              tripsQuery.error instanceof Error
                ? tripsQuery.error.message
                : "The trip data service is unavailable."
            }
            action={
              <Button
                type="button"
                className="h-11 rounded-xl px-5 font-semibold"
                onClick={() => void tripsQuery.refetch()}
              >
                Retry
              </Button>
            }
          />
        ) : tripsQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Vehicles"
                value={formatIndianNumber(activeVehicles.length)}
                tone="default"
                icon={<Truck className="h-4 w-4" />}
              />
              <StatCard
                label="Total Trips"
                value={formatIndianNumber(totals.trips)}
                tone="default"
                icon={<RouteIcon className="h-4 w-4" />}
              />
              <StatCard
                label="Total Income"
                value={formatMoney(totals.income, symbol)}
                tone="success"
                icon={<IndianRupee className="h-4 w-4" />}
              />
              <StatCard
                label="Total Expense"
                value={formatMoney(totals.totalExpense, symbol)}
                tone="danger"
                icon={<TrendingDown className="h-4 w-4" />}
              />
            </div>

            <div className="glass-card rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Net Profit
                </span>
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <p
                className={cn(
                  "mt-2 text-2xl font-extrabold tabular-nums sm:text-3xl lg:text-4xl",
                  totals.profit >= 0 ? "text-primary" : "text-destructive",
                )}
              >
                {formatMoney(totals.profit, symbol)}
              </p>
            </div>

            {recentTrips.length > 0 ? (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold">Recent Trips</h3>
                  <Link to="/trips" className="text-xs font-semibold text-primary hover:underline">
                    View All
                  </Link>
                </div>
                <ul className="space-y-2">
                  {recentTrips.map((t) => {
                    const profit = profitOf(t);
                    return (
                      <li key={t._id} className="glass-card glass-card-hover rounded-2xl p-3">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">
                              {vehicleLabel.get(t.vehicleId) ?? "Vehicle"}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {formatDateShort(t.date)}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "text-sm font-bold tabular-nums",
                              profit >= 0 ? "text-success" : "text-destructive",
                            )}
                          >
                            {formatMoney(profit, symbol)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {chartData.length === 0 ? (
              <EmptyState
                icon={<RouteIcon className="h-6 w-6" />}
                title="No trips in this period"
                description="Record trips in the Trips section to see income and expenses for this period."
                action={
                  <Button asChild className="h-10 rounded-xl px-4 font-semibold">
                    <Link to="/trips">Go to Trips</Link>
                  </Button>
                }
              />
            ) : (
              <>
                <div className="grid gap-4 xl:grid-cols-2">
                  <ChartCard title="Income vs Expense">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={chartData}
                        margin={{ top: 8, right: 4, left: -18, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(0 0% 100% / 0.08)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10 }}
                          stroke="currentColor"
                          opacity={0.5}
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          stroke="currentColor"
                          opacity={0.5}
                          width={44}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(0 0% 8%)",
                            border: "1px solid hsl(0 0% 100% / 0.1)",
                            borderRadius: 12,
                            fontSize: 12,
                          }}
                          formatter={(v: number) => formatMoney(v, symbol)}
                        />
                        <Bar
                          dataKey="income"
                          name="Income"
                          fill="var(--color-primary)"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="expense"
                          name="Expense"
                          fill="var(--color-destructive)"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Profit trend">
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart
                        data={chartData}
                        margin={{ top: 8, right: 4, left: -18, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(0 0% 100% / 0.08)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10 }}
                          stroke="currentColor"
                          opacity={0.5}
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          stroke="currentColor"
                          opacity={0.5}
                          width={44}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(0 0% 8%)",
                            border: "1px solid hsl(0 0% 100% / 0.1)",
                            borderRadius: 12,
                            fontSize: 12,
                          }}
                          formatter={(v: number) => formatMoney(v, symbol)}
                        />
                        <Line
                          type="monotone"
                          dataKey="profit"
                          name="Profit"
                          stroke="var(--color-primary)"
                          strokeWidth={2.5}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-2xl p-3 sm:p-4">
      <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-xs">
        {title}
      </p>
      {children}
    </div>
  );
}
