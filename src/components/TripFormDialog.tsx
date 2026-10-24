import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Loader2, MapPin, User, Gauge, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoneyInput } from "@/components/MoneyInput";
import { useApp } from "@/lib/app-context";
import { useSaveTrip } from "@/lib/queries";
import { formatMoney, isoDayOnly, todayInput } from "@/lib/format";
import { profitOf, sumOtherExpenses, totalExpenseOf } from "@/lib/calc";
import { calculateMileage } from "@/lib/whatsapp";
import type { OtherExpenseItem, Trip } from "@/lib/types";

interface TripFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip?: Trip | null;
}

interface FormState {
  vehicleId: string;
  date: string;
  route: string;
  driverName: string;
  totalKm: number;
  dieselLiters: number;
  income: number;
  diesel: number;
  driverPayment: number;
  emiShare: number;
  otherExpenseItems: OtherExpenseItem[];
  notes: string;
}

const QUICK_EXPENSE_PILLS = [
  "Toll Tax",
  "Tyre / Puncture",
  "Loading / Unloading",
  "Police / RTO",
  "Servicing / Repair",
  "Driver Food / Allowance",
];

export function TripFormDialog({ open, onOpenChange, trip }: TripFormDialogProps) {
  const { activeVehicles, selectedVehicleId, isAllVehicles, symbol } = useApp();
  const saveTrip = useSaveTrip();

  const fallbackVehicle =
    isAllVehicles || !selectedVehicleId ? (activeVehicles[0]?._id ?? "") : selectedVehicleId;

  const [form, setForm] = useState<FormState>({
    vehicleId: fallbackVehicle,
    date: todayInput(),
    route: "",
    driverName: "",
    totalKm: 0,
    dieselLiters: 0,
    income: 0,
    diesel: 0,
    driverPayment: 0,
    emiShare: 0,
    otherExpenseItems: [],
    notes: "",
  });

  useEffect(() => {
    if (!open) return;
    if (trip) {
      setForm({
        vehicleId: trip.vehicleId,
        date: isoDayOnly(trip.date),
        route: trip.route ?? "",
        driverName: trip.driverName ?? "",
        totalKm: trip.totalKm ?? 0,
        dieselLiters: trip.dieselLiters ?? 0,
        income: trip.income,
        diesel: trip.diesel,
        driverPayment: trip.driverPayment,
        emiShare: trip.emiShare,
        otherExpenseItems: (trip.otherExpenseItems ?? []).map((i) => ({
          name: i.name,
          amount: i.amount,
        })),
        notes: trip.notes ?? "",
      });
    } else {
      setForm({
        vehicleId: fallbackVehicle,
        date: todayInput(),
        route: "",
        driverName: "",
        totalKm: 0,
        dieselLiters: 0,
        income: 0,
        diesel: 0,
        driverPayment: 0,
        emiShare: 0,
        otherExpenseItems: [],
        notes: "",
      });
    }
  }, [open, trip?._id, fallbackVehicle, trip]);

  const otherExpenses = useMemo(
    () => sumOtherExpenses(form.otherExpenseItems),
    [form.otherExpenseItems],
  );
  const amounts = { ...form, otherExpenses };
  const totalExpense = totalExpenseOf(amounts);
  const profit = profitOf(amounts);
  const mileage = useMemo(
    () => calculateMileage(form.totalKm, form.dieselLiters),
    [form.totalKm, form.dieselLiters],
  );

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const updateItem = (index: number, patch: Partial<OtherExpenseItem>) =>
    setForm((f) => ({
      ...f,
      otherExpenseItems: f.otherExpenseItems.map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      ),
    }));

  const handleAddQuickExpense = (name: string) => {
    // If empty input exists, fill it, otherwise append
    setForm((f) => {
      const emptyIdx = f.otherExpenseItems.findIndex((i) => !i.name.trim());
      if (emptyIdx >= 0) {
        return {
          ...f,
          otherExpenseItems: f.otherExpenseItems.map((item, idx) =>
            idx === emptyIdx ? { ...item, name } : item,
          ),
        };
      }
      return {
        ...f,
        otherExpenseItems: [...f.otherExpenseItems, { name, amount: 0 }],
      };
    });
  };

  const submit = () => {
    if (saveTrip.isPending) return;
    if (!form.vehicleId) {
      toast.error("Please select a vehicle");
      return;
    }
    if (!form.date) {
      toast.error("Please choose a date");
      return;
    }
    const invalid = form.otherExpenseItems.find((i) => !i.name.trim());
    if (invalid) {
      toast.error("Every other expense needs a name");
      return;
    }

    saveTrip.mutate(
      {
        id: trip?._id,
        payload: {
          vehicleId: form.vehicleId,
          date: form.date,
          route: form.route.trim(),
          driverName: form.driverName.trim(),
          totalKm: Number(form.totalKm) || 0,
          dieselLiters: Number(form.dieselLiters) || 0,
          income: form.income,
          diesel: form.diesel,
          driverPayment: form.driverPayment,
          emiShare: form.emiShare,
          otherExpenseItems: form.otherExpenseItems
            .filter((i) => i.name.trim())
            .map((i) => ({ name: i.name.trim(), amount: i.amount })),
          notes: form.notes.trim(),
        },
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-y-auto rounded-3xl p-4 sm:p-6">
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl font-extrabold flex items-center justify-between">
            <span>{trip ? "Edit Trip" : "Add Trip"}</span>
            {mileage ? (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                ⚡ {mileage} km/L
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Totals, expenses and profit are calculated automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date & Vehicle */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <Label
                htmlFor="trip-date"
                className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              >
                Date
              </Label>
              <Input
                id="trip-date"
                type="date"
                value={form.date}
                onChange={(e) => update("date", e.target.value)}
                className="h-11 rounded-xl bg-secondary/60 text-base"
              />
            </div>
            <div className="min-w-0">
              <Label className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Vehicle
              </Label>
              <Select value={form.vehicleId} onValueChange={(v) => update("vehicleId", v)}>
                <SelectTrigger className="h-11 rounded-xl bg-secondary/60 text-base">
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {activeVehicles.map((v) => (
                    <SelectItem key={v._id} value={v._id}>
                      {v.type || v.name}
                      {v.vehicleNumber ? ` · ${v.vehicleNumber}` : ""}
                    </SelectItem>
                  ))}
                  {trip && !activeVehicles.some((v) => v._id === trip.vehicleId) ? (
                    <SelectItem value={trip.vehicleId}>Inactive vehicle</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Route & Driver Name (Suggestions 2 & 4) */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <Label
                htmlFor="trip-route"
                className="mb-1.5 flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-cyan-400"
              >
                <MapPin className="h-3.5 w-3.5" />
                <span>Route (From ➔ To)</span>
              </Label>
              <Input
                id="trip-route"
                placeholder="e.g. Ahmedabad ➔ Surat"
                value={form.route}
                onChange={(e) => update("route", e.target.value)}
                className="h-11 rounded-xl bg-secondary/60 text-sm"
              />
            </div>
            <div className="min-w-0">
              <Label
                htmlFor="trip-driver"
                className="mb-1.5 flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-cyan-400"
              >
                <User className="h-3.5 w-3.5" />
                <span>Driver Name</span>
              </Label>
              <Input
                id="trip-driver"
                placeholder="e.g. Ramesh Patel"
                value={form.driverName}
                onChange={(e) => update("driverName", e.target.value)}
                className="h-11 rounded-xl bg-secondary/60 text-sm"
              />
            </div>
          </div>

          {/* Primary Financials */}
          <div className="grid gap-3 sm:grid-cols-2">
            <MoneyInput
              label="Trip Income / Freight (₹)"
              value={form.income}
              onChange={(v) => update("income", v)}
              symbol={symbol}
            />
            <MoneyInput
              label="Diesel Expense (₹)"
              value={form.diesel}
              onChange={(v) => update("diesel", v)}
              symbol={symbol}
            />
            <MoneyInput
              label="Driver Payment (₹)"
              value={form.driverPayment}
              onChange={(v) => update("driverPayment", v)}
              symbol={symbol}
              hint="Editable for every trip"
            />
            <MoneyInput
              label="EMI Share (₹)"
              value={form.emiShare}
              onChange={(v) => update("emiShare", v)}
              symbol={symbol}
            />
          </div>

          {/* Trip Distance & Diesel Mileage Calculator (Suggestion 3) */}
          <div className="rounded-2xl border border-cyan-500/20 bg-slate-900/60 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Gauge className="h-4 w-4 text-cyan-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Mileage Calculator (Optional)
                </span>
              </div>
              {mileage ? (
                <span className="text-xs font-extrabold text-cyan-400">
                  Calculated: {mileage} km/L
                </span>
              ) : (
                <span className="text-[0.68rem] text-muted-foreground">
                  Enter KM & Liters for auto-mileage
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[0.68rem] text-muted-foreground uppercase font-semibold">
                  Run Distance (KM)
                </Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="e.g. 280"
                  value={form.totalKm ? form.totalKm : ""}
                  onChange={(e) => update("totalKm", parseFloat(e.target.value) || 0)}
                  className="h-10 rounded-xl bg-background/60 text-sm"
                />
              </div>
              <div>
                <Label className="text-[0.68rem] text-muted-foreground uppercase font-semibold">
                  Diesel Liters (L)
                </Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="e.g. 70"
                  value={form.dieselLiters ? form.dieselLiters : ""}
                  onChange={(e) => update("dieselLiters", parseFloat(e.target.value) || 0)}
                  className="h-10 rounded-xl bg-background/60 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Other Expenses Panel with Quick Expense Pills (Suggestion 5) */}
          <div className="fleet-panel rounded-2xl p-4 space-y-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                <p className="min-w-0 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Other Itemized Expenses
                </p>
              </div>
              <span className="shrink-0 text-sm font-bold tabular-nums text-primary">
                {formatMoney(otherExpenses, symbol)}
              </span>
            </div>

            {/* Quick Expense Pills (1-click add) */}
            <div>
              <p className="text-[0.65rem] text-slate-400 mb-1.5 font-medium">
                Quick Shortcuts (Click to add):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_EXPENSE_PILLS.map((pill) => (
                  <button
                    key={pill}
                    type="button"
                    onClick={() => handleAddQuickExpense(pill)}
                    className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:border-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors tap-scale"
                  >
                    + {pill}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {form.otherExpenseItems.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No items added yet. Click a shortcut above or the button below.
                </p>
              ) : null}
              {form.otherExpenseItems.map((item, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(5.5rem,0.75fr)_2.5rem] items-center gap-2"
                >
                  <Input
                    value={item.name}
                    placeholder="Expense Name (Toll, Food…)"
                    onChange={(e) => updateItem(index, { name: e.target.value })}
                    className="h-11 w-full min-w-0 rounded-xl bg-background/60 text-sm"
                  />
                  <MoneyInput
                    value={item.amount}
                    onChange={(v) => updateItem(index, { amount: v })}
                    symbol={symbol}
                    className="[&>div]:h-11"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Delete expense"
                    className="h-11 w-9 shrink-0 rounded-xl text-destructive hover:bg-destructive/10"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        otherExpenseItems: f.otherExpenseItems.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-10 w-full rounded-xl border-primary/40 text-primary hover:bg-primary/10 text-xs font-semibold"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  otherExpenseItems: [...f.otherExpenseItems, { name: "", amount: 0 }],
                }))
              }
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Custom Expense Item
            </Button>
          </div>

          {/* Notes */}
          <div>
            <Label
              htmlFor="trip-notes"
              className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            >
              Notes (optional)
            </Label>
            <Textarea
              id="trip-notes"
              value={form.notes}
              rows={2}
              placeholder="Goods details, party name, challan number…"
              onChange={(e) => update("notes", e.target.value)}
              className="rounded-xl bg-secondary/60 text-sm"
            />
          </div>

          {/* Profit Summary Preview */}
          <div className="glass-card rounded-2xl p-4 border border-cyan-500/20">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">Total Combined Expenses</span>
              <span className="font-bold tabular-nums text-slate-200">
                {formatMoney(totalExpense, symbol)}
              </span>
            </div>
            <div className="mt-2 h-px w-full bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
            <div className="mt-2 flex items-center justify-between gap-2">
              <div>
                <span className="text-sm font-bold text-foreground">Estimated Profit</span>
                <p className="text-[0.68rem] text-muted-foreground">Income minus all expenses</p>
              </div>
              <span
                className={`text-xl font-black tabular-nums ${profit >= 0 ? "text-success" : "text-destructive"}`}
              >
                {formatMoney(profit, symbol)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4 flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="h-11 w-full rounded-xl sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="h-11 w-full rounded-xl font-bold bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500 sm:w-auto"
            onClick={submit}
            disabled={saveTrip.isPending}
          >
            {saveTrip.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {trip ? "Update Trip" : "Save Trip"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
