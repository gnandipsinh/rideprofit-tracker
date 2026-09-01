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
import { IndianRupee, TrendingDown, TrendingUp, Truck, Fuel, Route as RouteIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { VehicleSelector } from "@/components/VehicleSelector";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useApp } from "@/lib/app-context";
import { useTrips } from "@/lib/queries";
import { aggregate } from "@/lib/calc";
import { formatDateShort, formatIndianNumber, formatMoney, isoDayOnly } from "@/lib/format";
import { DASHBOARD_PRESETS, dashboardRange, type DashboardPreset } from "@/lib/date-ranges";
import { todayInput } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Vehicle Trip Profit Tracker" },
      {
        name: "description",
        content:
          "Vehicle-wise trip accounting dashboard: track daily income, diesel, driver payments, EMI share and net profit.",
      },
      { property: "og:title", content: "Dashboard — Vehicle Trip Profit Tracker" },
      {
        property: "og:description",
        content: "Track daily trip income, expenses and profit for every vehicle in your fleet.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { symbol, selectedVehicleId, isAllVehicles, vehicles, vehiclesLoading } = useApp();
  const [preset, setPreset] = useState<DashboardPreset>("month");
  const [custom, setCustom] = useState({ fromDate: todayInput(), toDate: todayInput() });

  const range = useMemo(() => dashboardRange(preset, custom), [preset, custom]);
  const tripsQuery = useTrips(
    { vehicleId: selectedVehicleId, fromDate: range.fromDate, toDate: range.toDate },
    Boolean(selectedVehicleId),
  );

  const trips = tripsQuery.data ?? [];
  const totals = useMemo(() => aggregate(trips), [trips]);

  const chartData = useMemo(() => {
    const byDay = new Map<string, { day: string; income: number; expense: number; profit: number }>();
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

  return (
    <AppShell>
      <div className="space-y-4">
        <VehicleSelector />

        <div className="glass-card rounded-2xl p-3">
          <div className="flex flex-wrap gap-2">
            {DASHBOARD_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPreset(p.value)}
                className={cn(
                  "tap-scale rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground",
                  preset === p.value && "border-primary/50 bg-primary/15 text-primary",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === "custom" ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={custom.fromDate}
                onChange={(e) => setCustom((c) => ({ ...c, fromDate: e.target.value }))}
                className="h-11 rounded-xl bg-secondary/60"
              />
              <Input
                type="date"
                value={custom.toDate}
                onChange={(e) => setCustom((c) => ({ ...c, toDate: e.target.value }))}
                className="h-11 rounded-xl bg-secondary/60"
              />
            </div>
          ) : null}
        </div>

        {!vehiclesLoading && vehicles.length === 0 ? (
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
        ) : tripsQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Income"
                value={formatMoney(totals.income, symbol)}
                tone="gold"
                icon={<IndianRupee className="h-4 w-4" />}
              />
              <StatCard
                label="Total Expense"
                value={formatMoney(totals.totalExpense, symbol)}
                tone="danger"
                icon={<TrendingDown className="h-4 w-4" />}
              />
              <StatCard
                label="Net Profit"
                value={formatMoney(totals.profit, symbol)}
                tone={totals.profit >= 0 ? "success" : "danger"}
                icon={<TrendingUp className="h-4 w-4" />}
                sub={`${totals.trips} trip(s) · ${isAllVehicles ? "all vehicles" : "this vehicle"}`}
              />
              <StatCard
                label="Trips"
                value={formatIndianNumber(totals.trips)}
                icon={<RouteIcon className="h-4 w-4" />}
                sub={`Avg profit ${formatMoney(totals.trips ? totals.profit / totals.trips : 0, symbol)}`}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Diesel" value={formatMoney(totals.diesel, symbol)} icon={<Fuel className="h-4 w-4" />} />
              <StatCard label="Driver Payment" value={formatMoney(totals.driverPayment, symbol)} />
              <StatCard label="Other Expenses" value={formatMoney(totals.otherExpenses, symbol)} />
              <StatCard label="EMI Share" value={formatMoney(totals.emiShare, symbol)} />
            </div>

            {chartData.length === 0 ? (
              <EmptyState
                icon={<RouteIcon className="h-6 w-6" />}
                title="No trips in this period"
                description="Use the Add Trip button to record income and expenses for a day."
              />
            ) : (
              <>
                <ChartCard title="Income vs Expense">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.08)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="currentColor" opacity={0.5} />
                      <YAxis tick={{ fontSize: 10 }} stroke="currentColor" opacity={0.5} width={44} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(0 0% 8%)",
                          border: "1px solid hsl(0 0% 100% / 0.1)",
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                        formatter={(v: number) => formatMoney(v, symbol)}
                      />
                      <Bar dataKey="income" name="Income" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expense" name="Expense" fill="var(--color-destructive)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Profit trend">
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={chartData} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.08)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="currentColor" opacity={0.5} />
                      <YAxis tick={{ fontSize: 10 }} stroke="currentColor" opacity={0.5} width={44} />
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
    <div className="glass-card rounded-2xl p-3">
      <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}
