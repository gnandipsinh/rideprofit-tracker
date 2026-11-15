import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Pencil,
  Route as RouteIcon,
  Search,
  Trash2,
  MessageCircle,
  MapPin,
  User,
  Gauge,
  Plus,
  IndianRupee,
  Calendar,
  Fuel,
  Receipt,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { VehicleSelector } from "@/components/VehicleSelector";
import { EmptyState } from "@/components/EmptyState";
import { TripFormDialog } from "@/components/TripFormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { calculateMileage, formatTripWhatsAppMessage, openWhatsAppShare } from "@/lib/whatsapp";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useApp } from "@/lib/app-context";
import { useDeleteTrip, useTrips } from "@/lib/queries";
import { aggregate, profitOf } from "@/lib/calc";
import { formatDate, formatDateShort, formatMoney, todayInput, toDateInput } from "@/lib/format";
import type { Trip } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/trips")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { tab?: "trips" | "expenses" | undefined } =>
    search["tab"] === "expenses" ? { tab: "expenses" } : {},
  head: () => ({
    meta: [
      { title: "Trips & Expenses — RideProfit Tracker" },
      {
        name: "description",
        content:
          "Record and review daily trips, mileage, diesel expenses, driver payments, and net profit.",
      },
      { property: "og:title", content: "Trips & Expenses — RideProfit Tracker" },
      {
        property: "og:description",
        content: "Add and edit daily vehicle trips with automatic financial calculations.",
      },
    ],
  }),
  component: TripsPage,
});

function firstOfMonth(): string {
  const now = new Date();
  return toDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
}

function TripsPage() {
  const { symbol, selectedVehicleId, activeVehicles, appName } = useApp();
  const remove = useDeleteTrip();
  const { tab } = Route.useSearch();
  const isExpenseView = tab === "expenses";

  const [range, setRange] = useState({ fromDate: firstOfMonth(), toDate: todayInput() });
  const [formTrip, setFormTrip] = useState<Trip | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirm, setConfirm] = useState<Trip | null>(null);
  const [search, setSearch] = useState("");

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

  const vehicleName = useMemo(
    () => new Map(activeVehicles.map((v) => [v._id, v.name])),
    [activeVehicles],
  );

  const vehicleNumber = useMemo(
    () => new Map(activeVehicles.map((v) => [v._id, v.vehicleNumber])),
    [activeVehicles],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return trips;
    const q = search.toLowerCase();
    return trips.filter((t) => {
      const vName = vehicleName.get(t.vehicleId)?.toLowerCase() ?? "";
      const vNum = vehicleNumber.get(t.vehicleId)?.toLowerCase() ?? "";
      const route = t.route?.toLowerCase() ?? "";
      const driver = t.driverName?.toLowerCase() ?? "";
      const date = formatDate(t.date).toLowerCase();
      return (
        vName.includes(q) ||
        vNum.includes(q) ||
        route.includes(q) ||
        driver.includes(q) ||
        date.includes(q)
      );
    });
  }, [trips, search, vehicleName, vehicleNumber]);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {isExpenseView ? "Fleet Expenses" : "Trips & Expenses"}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              {isExpenseView
                ? "Itemized diesel, driver wages, EMI share, and miscellaneous trip costs"
                : "Track routes, diesel, driver payroll, and net profit per trip"}
            </p>
          </div>

          <Button
            onClick={() => {
              setFormTrip(null);
              setFormOpen(true);
            }}
            className="h-11 px-5 rounded-xl font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-md shadow-cyan-500/20 tap-scale flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Trip</span>
          </Button>
        </div>

        {/* Vehicle Filter Strip */}
        <div className="rounded-2xl border border-[#1C2B44] bg-[#10192A] p-3.5">
          <VehicleSelector />
        </div>

        {/* 3 Summary Metric Cards */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <div className="rounded-2xl border border-[#1C2B44] bg-[#10192A] p-3.5 sm:p-4 text-center">
            <span className="text-[0.65rem] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Total Income
            </span>
            <p className="mt-1 text-base sm:text-xl font-black text-cyan-400 tabular-nums">
              {formatMoney(totals.income, symbol)}
            </p>
          </div>

          <div className="rounded-2xl border border-[#1C2B44] bg-[#10192A] p-3.5 sm:p-4 text-center">
            <span className="text-[0.65rem] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Total Expenses
            </span>
            <p className="mt-1 text-base sm:text-xl font-black text-rose-400 tabular-nums">
              {formatMoney(totals.totalExpense, symbol)}
            </p>
          </div>

          <div className="rounded-2xl border border-[#1C2B44] bg-[#10192A] p-3.5 sm:p-4 text-center">
            <span className="text-[0.65rem] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Net Profit
            </span>
            <p
              className={cn(
                "mt-1 text-base sm:text-xl font-black tabular-nums",
                totals.profit >= 0 ? "text-emerald-400" : "text-rose-400",
              )}
            >
              {formatMoney(totals.profit, symbol)}
            </p>
          </div>
        </div>

        {isExpenseView ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-rose-500/25 bg-[#10192A] p-3.5">
              <span className="text-[0.65rem] font-semibold text-slate-400 uppercase tracking-wider block">
                Diesel Fuel
              </span>
              <p className="mt-1 text-base sm:text-lg font-black text-rose-400 tabular-nums">
                {formatMoney(totals.diesel, symbol)}
              </p>
            </div>
            <div className="rounded-2xl border border-[#1C2B44] bg-[#10192A] p-3.5">
              <span className="text-[0.65rem] font-semibold text-slate-400 uppercase tracking-wider block">
                Driver Wages
              </span>
              <p className="mt-1 text-base sm:text-lg font-black text-white tabular-nums">
                {formatMoney(totals.driverPayment, symbol)}
              </p>
            </div>
            <div className="rounded-2xl border border-[#1C2B44] bg-[#10192A] p-3.5">
              <span className="text-[0.65rem] font-semibold text-slate-400 uppercase tracking-wider block">
                EMI Share
              </span>
              <p className="mt-1 text-base sm:text-lg font-black text-purple-400 tabular-nums">
                {formatMoney(totals.emiShare, symbol)}
              </p>
            </div>
            <div className="rounded-2xl border border-[#1C2B44] bg-[#10192A] p-3.5">
              <span className="text-[0.65rem] font-semibold text-slate-400 uppercase tracking-wider block">
                Other Costs
              </span>
              <p className="mt-1 text-base sm:text-lg font-black text-amber-400 tabular-nums">
                {formatMoney(totals.otherExpenses, symbol)}
              </p>
            </div>
          </div>
        ) : null}

        {/* Filters: Search & Date Range */}
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by vehicle, driver, route or date..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 rounded-xl border-[#1C2B44] bg-[#10192A] pl-11 text-sm text-white placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-[#1C2B44] bg-[#10192A] p-1">
            <Input
              type="date"
              aria-label="From date"
              value={range.fromDate}
              onChange={(e) => setRange((r) => ({ ...r, fromDate: e.target.value }))}
              className="h-9 w-36 rounded-lg bg-[#080D18] border-[#1C2B44] text-xs text-white"
            />
            <span className="text-slate-500 text-xs">to</span>
            <Input
              type="date"
              aria-label="To date"
              value={range.toDate}
              onChange={(e) => setRange((r) => ({ ...r, toDate: e.target.value }))}
              className="h-9 w-36 rounded-lg bg-[#080D18] border-[#1C2B44] text-xs text-white"
            />
          </div>
        </div>

        {/* Trips Content */}
        {tripsQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl bg-[#10192A]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<RouteIcon className="h-6 w-6" />}
            title={search ? "No matching trips found" : "No trips recorded for this range"}
            description={
              search
                ? "Try adjusting your search criteria or resetting filters."
                : "Click Add Trip above to record your first vehicle run with income and diesel costs."
            }
            action={
              !search ? (
                <Button
                  onClick={() => {
                    setFormTrip(null);
                    setFormOpen(true);
                  }}
                  className="h-11 rounded-xl px-5 font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                >
                  Add Trip
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((t) => {
              const profit = profitOf(t);
              const totalExpense = t.diesel + t.driverPayment + t.otherExpenses + t.emiShare;
              const vName = vehicleName.get(t.vehicleId) ?? "Vehicle";
              const vNum = vehicleNumber.get(t.vehicleId);
              const vType = activeVehicles.find((v) => v._id === t.vehicleId)?.type ?? "";
              const mileage =
                t.totalKm && t.dieselLiters ? calculateMileage(t.totalKm, t.dieselLiters) : null;

              return (
                <div
                  key={t._id}
                  className="rounded-2xl border border-[#1C2B44] bg-[#10192A] p-4 sm:p-5 transition-all hover:border-cyan-500/40"
                >
                  {/* Top Row: Date, Vehicle, Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1C2B44]/70">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/30">
                        <RouteIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-white">{formatDate(t.date)}</h3>
                          <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                            {vNum || vName}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{vType || vName}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Share on WhatsApp"
                        aria-label="Share trip summary on WhatsApp"
                        className="h-9 px-3 rounded-xl text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/15 border border-[#1C2B44]"
                        onClick={() => {
                          const vLabel = [vType || vName, vNum].filter(Boolean).join(" · ");
                          const msg = formatTripWhatsAppMessage(t, vLabel, appName, symbol);
                          openWhatsAppShare(msg);
                        }}
                      >
                        <MessageCircle className="h-4 w-4 mr-1.5" />
                        <span className="text-xs font-semibold">Share</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Edit trip"
                        className="h-9 w-9 rounded-xl text-cyan-400 hover:text-white hover:bg-cyan-500/15 border border-[#1C2B44]"
                        onClick={() => {
                          setFormTrip(t);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete trip"
                        className="h-9 w-9 rounded-xl text-rose-400 hover:text-white hover:bg-rose-500/15 border border-[#1C2B44]"
                        onClick={() => setConfirm(t)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Middle Row: Route, Driver, Mileage Tags */}
                  {(t.route || t.driverName || mileage) && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      {t.route ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-medium">
                          <MapPin className="h-3.5 w-3.5 text-cyan-400" />
                          <span>{t.route}</span>
                        </span>
                      ) : null}

                      {t.driverName ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#080D18] border border-[#1C2B44] text-slate-300 font-medium">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          <span>{t.driverName}</span>
                        </span>
                      ) : null}

                      {mileage ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 font-bold tabular-nums">
                          <Gauge className="h-3.5 w-3.5 text-amber-400" />
                          <span>
                            {mileage} km/L ({t.totalKm} km / {t.dieselLiters} L)
                          </span>
                        </span>
                      ) : null}
                    </div>
                  )}

                  {/* Financial Grid */}
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-[#1C2B44]/70">
                    <div className="rounded-xl bg-[#080D18]/70 border border-[#1C2B44] p-2.5">
                      <span className="text-[0.65rem] font-semibold text-slate-400 uppercase tracking-wider block">
                        Income
                      </span>
                      <span className="text-sm font-bold text-white tabular-nums">
                        {formatMoney(Number(t.income) || 0, symbol)}
                      </span>
                    </div>

                    <div className="rounded-xl bg-[#080D18]/70 border border-[#1C2B44] p-2.5">
                      <span className="text-[0.65rem] font-semibold text-slate-400 uppercase tracking-wider block">
                        Diesel
                      </span>
                      <span className="text-sm font-bold text-rose-400 tabular-nums">
                        {formatMoney(t.diesel, symbol)}
                      </span>
                    </div>

                    <div className="rounded-xl bg-[#080D18]/70 border border-[#1C2B44] p-2.5">
                      <span className="text-[0.65rem] font-semibold text-slate-400 uppercase tracking-wider block">
                        Driver + Other
                      </span>
                      <span className="text-sm font-bold text-slate-300 tabular-nums">
                        {formatMoney(t.driverPayment + t.otherExpenses + t.emiShare, symbol)}
                      </span>
                    </div>

                    <div className="rounded-xl bg-[#080D18]/70 border border-[#1C2B44] p-2.5">
                      <span className="text-[0.65rem] font-semibold text-slate-400 uppercase tracking-wider block">
                        Net Profit
                      </span>
                      <span
                        className={cn(
                          "text-sm font-black tabular-nums",
                          profit >= 0 ? "text-emerald-400" : "text-rose-400",
                        )}
                      >
                        {formatMoney(profit, symbol)}
                      </span>
                    </div>
                  </div>

                  {/* Itemized expenses if any */}
                  {t.otherExpenseItems && t.otherExpenseItems.length > 0 ? (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[0.7rem] text-slate-400">
                      <span className="font-semibold text-slate-500">Expenses:</span>
                      {t.otherExpenseItems.map((item, idx) => (
                        <span
                          key={idx}
                          className="rounded bg-[#080D18] px-2 py-0.5 border border-[#1C2B44] text-slate-300"
                        >
                          {item.name}: {formatMoney(item.amount, symbol)}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {t.notes ? (
                    <p className="mt-2 text-xs text-slate-400 italic">"{t.notes}"</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {/* Trip Form Dialog */}
        <TripFormDialog open={formOpen} onOpenChange={setFormOpen} trip={formTrip} />

        {/* Delete Confirmation Alert */}
        <AlertDialog open={Boolean(confirm)} onOpenChange={(o) => !o && setConfirm(null)}>
          <AlertDialogContent className="w-[calc(100vw-1.5rem)] max-w-sm rounded-2xl bg-[#080D18] border-[#1C2B44] text-white">
            <AlertDialogHeader className="text-left">
              <AlertDialogTitle className="text-lg font-bold text-white">
                Delete Trip?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-slate-400">
                This will permanently delete this trip entry and reverse its financial impact.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
              <AlertDialogCancel className="h-10 w-full rounded-xl sm:w-auto border-[#1C2B44] bg-[#10192A] text-slate-300">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="h-10 w-full rounded-xl bg-rose-600 text-white hover:bg-rose-500 font-bold sm:w-auto"
                onClick={() => {
                  const id = confirm?._id;
                  if (id) remove.mutate(id);
                  setConfirm(null);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppShell>
  );
}
