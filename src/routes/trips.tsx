import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Route as RouteIcon, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { VehicleSelector } from "@/components/VehicleSelector";
import { EmptyState } from "@/components/EmptyState";
import { TripFormDialog } from "@/components/TripFormDialog";
import { Button } from "@/components/ui/button";
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
import { aggregate, profitOf, totalExpenseOf } from "@/lib/calc";
import { formatDate, formatMoney, todayInput, toDateInput } from "@/lib/format";
import type { Trip } from "@/lib/types";

export const Route = createFileRoute("/trips")({
  head: () => ({
    meta: [
      { title: "Trips — Daily Trip Entry" },
      {
        name: "description",
        content:
          "Record daily trips with income, diesel, editable driver payment, multiple other expenses and EMI share.",
      },
      { property: "og:title", content: "Trips — Daily Trip Entry" },
      { property: "og:description", content: "Add and edit daily trips with automatic profit calculation." },
    ],
  }),
  component: TripsPage,
});

function firstOfMonth(): string {
  const now = new Date();
  return toDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
}

function TripsPage() {
  const { symbol, selectedVehicleId, vehicles, isAllVehicles } = useApp();
  const remove = useDeleteTrip();

  const [range, setRange] = useState({ fromDate: firstOfMonth(), toDate: todayInput() });
  const [editing, setEditing] = useState<Trip | null>(null);
  const [confirm, setConfirm] = useState<Trip | null>(null);

  const tripsQuery = useTrips(
    { vehicleId: selectedVehicleId, fromDate: range.fromDate, toDate: range.toDate },
    Boolean(selectedVehicleId),
  );
  const trips = tripsQuery.data ?? [];
  const totals = useMemo(() => aggregate(trips), [trips]);
  const vehicleName = useMemo(() => new Map(vehicles.map((v) => [v._id, v.name])), [vehicles]);

  return (
    <AppShell>
      <div className="space-y-4">
        <VehicleSelector />

        <div className="glass-card grid grid-cols-2 gap-2 rounded-2xl p-3">
          <Input
            type="date"
            aria-label="From date"
            value={range.fromDate}
            onChange={(e) => setRange((r) => ({ ...r, fromDate: e.target.value }))}
            className="h-11 rounded-xl bg-secondary/60"
          />
          <Input
            type="date"
            aria-label="To date"
            value={range.toDate}
            onChange={(e) => setRange((r) => ({ ...r, toDate: e.target.value }))}
            className="h-11 rounded-xl bg-secondary/60"
          />
        </div>

        <div className="glass-card grid grid-cols-3 gap-2 rounded-2xl p-3 text-center">
          <Mini label="Income" value={formatMoney(totals.income, symbol)} />
          <Mini label="Expense" value={formatMoney(totals.totalExpense, symbol)} />
          <Mini
            label="Profit"
            value={formatMoney(totals.profit, symbol)}
            tone={totals.profit >= 0 ? "text-success" : "text-destructive"}
          />
        </div>

        {tripsQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : trips.length === 0 ? (
          <EmptyState
            icon={<RouteIcon className="h-6 w-6" />}
            title="No trips found"
            description="Use the Add Trip button to record your first entry for this period."
          />
        ) : (
          <ul className="space-y-3">
            {trips.map((t) => {
              const expense = totalExpenseOf(t);
              const profit = profitOf(t);
              return (
                <li key={t._id} className="glass-card rounded-2xl p-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{formatDate(t.date)}</p>
                      {isAllVehicles ? (
                        <p className="truncate text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-primary/80">
                          {vehicleName.get(t.vehicleId) ?? "Unknown vehicle"}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Edit trip"
                        className="h-9 w-9 rounded-xl text-primary hover:bg-primary/10"
                        onClick={() => setEditing(t)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete trip"
                        className="h-9 w-9 rounded-xl text-destructive hover:bg-destructive/10"
                        onClick={() => setConfirm(t)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs sm:grid-cols-3">
                    <Row label="Income" value={formatMoney(t.income, symbol)} />
                    <Row label="Diesel" value={formatMoney(t.diesel, symbol)} />
                    <Row label="Driver" value={formatMoney(t.driverPayment, symbol)} />
                    <Row label="Other" value={formatMoney(t.otherExpenses, symbol)} />
                    <Row label="EMI" value={formatMoney(t.emiShare, symbol)} />
                    <Row label="Expense" value={formatMoney(expense, symbol)} />
                  </div>

                  {t.otherExpenseItems?.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {t.otherExpenseItems.map((i, idx) => (
                        <span
                          key={i._id ?? idx}
                          className="rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[0.7rem] text-foreground/80"
                        >
                          {i.name} · {formatMoney(i.amount, symbol)}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {t.notes ? <p className="mt-3 text-xs text-muted-foreground">{t.notes}</p> : null}

                  <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-3">
                    <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Profit
                    </span>
                    <span
                      className={`text-base font-bold tabular-nums ${profit >= 0 ? "text-success" : "text-destructive"}`}
                    >
                      {formatMoney(profit, symbol)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <TripFormDialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)} trip={editing} />

      <AlertDialog open={Boolean(confirm)} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent className="w-[calc(100vw-1.5rem)] max-w-sm rounded-2xl">
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle>Delete this trip?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm ? `Trip of ${formatDate(confirm.date)} will be permanently removed.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel className="h-11 w-full rounded-xl sm:w-auto">Cancel</AlertDialogCancel>
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

function Mini({ label, value, tone = "text-foreground" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={`mt-1 truncate text-sm font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2">
      <span className="truncate text-muted-foreground">{label}</span>
      <span className="shrink-0 font-semibold tabular-nums">{value}</span>
    </div>
  );
}
