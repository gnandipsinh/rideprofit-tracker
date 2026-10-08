import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Route as RouteIcon, Search, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { VehicleSelector } from "@/components/VehicleSelector";
import { EmptyState } from "@/components/EmptyState";
import { TripFormDialog } from "@/components/TripFormDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import { formatDate, formatMoney, todayInput, toDateInput } from "@/lib/format";
import type { Trip } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/trips")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Trips — Jay Mataji Transport" },
      {
        name: "description",
        content:
          "Record daily trips with income, diesel, editable driver payment, multiple other expenses and EMI share.",
      },
      { property: "og:title", content: "Trips — Jay Mataji Transport" },
      {
        property: "og:description",
        content: "Add and edit daily trips with automatic profit calculation.",
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
  const { symbol, selectedVehicleId, activeVehicles } = useApp();
  const remove = useDeleteTrip();

  const [range, setRange] = useState({ fromDate: firstOfMonth(), toDate: todayInput() });
  const [formTrip, setFormTrip] = useState<Trip | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirm, setConfirm] = useState<Trip | null>(null);
  const [search, setSearch] = useState("");

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
      const date = formatDate(t.date).toLowerCase();
      return vName.includes(q) || vNum.includes(q) || date.includes(q);
    });
  }, [trips, search, vehicleName, vehicleNumber]);

  return (
    <AppShell>
      <div className="page-stack">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div>
            <h2 className="text-xl font-extrabold sm:text-2xl">Trips</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Daily income, expenses and profit
            </p>
          </div>
          <Button
            onClick={() => {
              setFormTrip(null);
              setFormOpen(true);
            }}
            className="h-11 shrink-0 rounded-xl px-4 font-semibold"
          >
            <span className="mr-1.5">+</span> Add Trip
          </Button>
        </div>

        <VehicleSelector />

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search trips..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-12 rounded-xl bg-secondary/60 pl-9 text-base"
            />
          </div>

          <div className="glass-card grid grid-cols-2 gap-2 rounded-2xl p-2">
            <Input
              type="date"
              aria-label="From date"
              value={range.fromDate}
              onChange={(e) => setRange((r) => ({ ...r, fromDate: e.target.value }))}
              className="h-11 min-w-0 rounded-xl bg-secondary/60"
            />
            <Input
              type="date"
              aria-label="To date"
              value={range.toDate}
              onChange={(e) => setRange((r) => ({ ...r, toDate: e.target.value }))}
              className="h-11 min-w-0 rounded-xl bg-secondary/60"
            />
          </div>
        </div>

        <div className="fleet-panel grid grid-cols-3 gap-3 rounded-2xl p-3 sm:p-4">
          <div className="text-center">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Income
            </p>
            <p className="mt-1 truncate text-sm font-bold tabular-nums text-primary sm:text-base">
              {formatMoney(totals.income, symbol)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Expense
            </p>
            <p className="mt-1 truncate text-sm font-bold tabular-nums text-destructive sm:text-base">
              {formatMoney(totals.totalExpense, symbol)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Profit
            </p>
            <p
              className={`mt-1 truncate text-sm font-bold tabular-nums sm:text-base ${totals.profit >= 0 ? "text-success" : "text-destructive"}`}
            >
              {formatMoney(totals.profit, symbol)}
            </p>
          </div>
        </div>

        {tripsQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<RouteIcon className="h-6 w-6" />}
            title={search ? "No trips found" : "No trips found"}
            description={
              search
                ? "Try adjusting your search."
                : "Use the Add Trip button to record your first entry for this period."
            }
          />
        ) : (
          <ul className="grid gap-3 xl:grid-cols-2">
            {filtered.map((t) => {
              const profit = profitOf(t);
              const totalExpense = t.diesel + t.driverPayment + t.otherExpenses + t.emiShare;
              const vName = vehicleName.get(t.vehicleId) ?? "Vehicle";
              const vNum = vehicleNumber.get(t.vehicleId);
              const vType = activeVehicles.find((v) => v._id === t.vehicleId)?.type ?? "";
              return (
                <li key={t._id} className="glass-card overflow-hidden rounded-2xl">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3 gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-bold">{formatDate(t.date)}</h3>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {vType || vName}
                          {vNum ? ` · ${vNum}` : ""}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit trip on ${formatDate(t.date)}`}
                          className="h-9 w-9 rounded-xl text-primary hover:bg-primary/10"
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
                          aria-label={`Delete trip on ${formatDate(t.date)}`}
                          className="h-9 w-9 rounded-xl text-destructive hover:bg-destructive/10"
                          onClick={() => setConfirm(t)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                      <div>
                        <p className="text-muted-foreground">Income</p>
                        <p className="font-bold tabular-nums">{formatMoney(t.income, symbol)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Diesel</p>
                        <p className="font-bold tabular-nums">{formatMoney(t.diesel, symbol)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Driver</p>
                        <p className="font-bold tabular-nums">
                          {formatMoney(t.driverPayment, symbol)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Other</p>
                        <p className="font-bold tabular-nums">
                          {formatMoney(t.otherExpenses, symbol)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">EMI</p>
                        <p className="font-bold tabular-nums">{formatMoney(t.emiShare, symbol)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-bold tabular-nums">
                          {formatMoney(totalExpense, symbol)}
                        </p>
                      </div>
                    </div>

                    {t.otherExpenseItems && t.otherExpenseItems.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {t.otherExpenseItems.map((item, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 rounded-lg bg-secondary/60 px-2 py-1 text-xs text-muted-foreground"
                          >
                            {item.name} - {formatMoney(item.amount, symbol)}
                          </span>
                        ))}
                      </div>
                    )}

                    {t.notes ? (
                      <p className="mt-3 rounded-xl border border-border/55 bg-background/25 px-3 py-2 text-xs leading-relaxed text-foreground/75">
                        {t.notes}
                      </p>
                    ) : null}

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Profit
                      </p>
                      <span
                        className={cn(
                          "text-lg font-bold tabular-nums",
                          profit >= 0 ? "text-success" : "text-destructive",
                        )}
                      >
                        {profit >= 0 ? "" : "-"}
                        {formatMoney(Math.abs(profit), symbol)}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <TripFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setFormTrip(null);
        }}
        trip={formTrip}
      />

      <AlertDialog open={Boolean(confirm)} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent className="w-[calc(100vw-1.5rem)] max-w-sm rounded-2xl">
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle>Delete this trip?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm ? `Trip of ${formatDate(confirm.date)} will be permanently removed.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel className="h-11 w-full rounded-xl sm:w-auto">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11 w-full rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
              onClick={() => {
                if (confirm) remove.mutate(confirm._id);
                setConfirm(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
