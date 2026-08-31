import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoneyInput } from "@/components/MoneyInput";
import { useApp } from "@/lib/app-context";
import { useSaveTrip } from "@/lib/queries";
import { formatMoney, isoDayOnly, todayInput } from "@/lib/format";
import { profitOf, sumOtherExpenses, totalExpenseOf } from "@/lib/calc";
import type { OtherExpenseItem, Trip } from "@/lib/types";

interface TripFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip?: Trip | null;
}

interface FormState {
  vehicleId: string;
  date: string;
  income: number;
  diesel: number;
  driverPayment: number;
  emiShare: number;
  otherExpenseItems: OtherExpenseItem[];
  notes: string;
}

export function TripFormDialog({ open, onOpenChange, trip }: TripFormDialogProps) {
  const { vehicles, selectedVehicleId, isAllVehicles, symbol } = useApp();
  const saveTrip = useSaveTrip();

  const fallbackVehicle = isAllVehicles || !selectedVehicleId ? (vehicles[0]?._id ?? "") : selectedVehicleId;

  const [form, setForm] = useState<FormState>({
    vehicleId: fallbackVehicle,
    date: todayInput(),
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
        income: trip.income,
        diesel: trip.diesel,
        driverPayment: trip.driverPayment,
        emiShare: trip.emiShare,
        otherExpenseItems: (trip.otherExpenseItems ?? []).map((i) => ({ name: i.name, amount: i.amount })),
        notes: trip.notes ?? "",
      });
    } else {
      setForm({
        vehicleId: fallbackVehicle,
        date: todayInput(),
        income: 0,
        diesel: 0,
        driverPayment: 0,
        emiShare: 0,
        otherExpenseItems: [],
        notes: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, trip?._id]);

  const otherExpenses = useMemo(() => sumOtherExpenses(form.otherExpenseItems), [form.otherExpenseItems]);
  const amounts = { ...form, otherExpenses };
  const totalExpense = totalExpenseOf(amounts);
  const profit = profitOf(amounts);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const updateItem = (index: number, patch: Partial<OtherExpenseItem>) =>
    setForm((f) => ({
      ...f,
      otherExpenseItems: f.otherExpenseItems.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));

  const submit = () => {
    if (!form.vehicleId) return toast.error("Please select a vehicle");
    if (!form.date) return toast.error("Please choose a date");
    const invalid = form.otherExpenseItems.find((i) => !i.name.trim());
    if (invalid) return toast.error("Every other expense needs a name");

    saveTrip.mutate(
      {
        id: trip?._id,
        payload: {
          vehicleId: form.vehicleId,
          date: form.date,
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
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto rounded-2xl p-4 sm:p-6">
        <DialogHeader className="text-left">
          <DialogTitle className="text-lg">{trip ? "Edit Trip" : "Add Trip"}</DialogTitle>
          <DialogDescription className="text-xs">
            Totals and profit are calculated automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
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
                className="h-12 rounded-xl bg-secondary/60 text-base"
              />
            </div>
            <div className="min-w-0">
              <Label className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Vehicle
              </Label>
              <Select value={form.vehicleId} onValueChange={(v) => update("vehicleId", v)}>
                <SelectTrigger className="h-12 rounded-xl bg-secondary/60 text-base">
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v._id} value={v._id}>
                      {v.name}
                      {v.vehicleNumber ? ` · ${v.vehicleNumber}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyInput label="Income" value={form.income} onChange={(v) => update("income", v)} symbol={symbol} />
            <MoneyInput label="Diesel" value={form.diesel} onChange={(v) => update("diesel", v)} symbol={symbol} />
            <MoneyInput
              label="Driver Payment"
              value={form.driverPayment}
              onChange={(v) => update("driverPayment", v)}
              symbol={symbol}
              hint="Editable for every trip"
            />
            <MoneyInput
              label="EMI Share"
              value={form.emiShare}
              onChange={(v) => update("emiShare", v)}
              symbol={symbol}
            />
          </div>

          <div className="rounded-2xl border border-border bg-secondary/40 p-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <p className="min-w-0 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Other Expenses
              </p>
              <span className="shrink-0 text-sm font-bold tabular-nums text-primary">
                {formatMoney(otherExpenses, symbol)}
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {form.otherExpenseItems.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No items yet. Add toll, parking, food, loading and more.
                </p>
              ) : null}
              {form.otherExpenseItems.map((item, index) => (
                <div key={index} className="grid grid-cols-[minmax(0,1fr)_7.5rem_2.5rem] items-center gap-2">
                  <Input
                    value={item.name}
                    placeholder="Toll, Parking…"
                    onChange={(e) => updateItem(index, { name: e.target.value })}
                    className="h-11 min-w-0 rounded-xl bg-background/60 text-sm"
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
                    className="h-11 w-10 shrink-0 text-destructive hover:bg-destructive/10"
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
              className="mt-3 h-11 w-full rounded-xl border-primary/40 text-primary hover:bg-primary/10"
              onClick={() =>
                setForm((f) => ({ ...f, otherExpenseItems: [...f.otherExpenseItems, { name: "", amount: 0 }] }))
              }
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add Other Expense
            </Button>
          </div>

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
              onChange={(e) => update("notes", e.target.value)}
              className="rounded-xl bg-secondary/60"
            />
          </div>

          <div className="glass-card rounded-2xl p-3">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">Total Expense</span>
              <span className="font-bold tabular-nums">{formatMoney(totalExpense, symbol)}</span>
            </div>
            <div className="mt-2 h-px w-full gold-rule opacity-40" />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">Profit</span>
              <span
                className={`text-lg font-bold tabular-nums ${profit >= 0 ? "text-success" : "text-destructive"}`}
              >
                {formatMoney(profit, symbol)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-2 flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="h-12 w-full rounded-xl sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button className="h-12 w-full rounded-xl font-semibold sm:w-auto" onClick={submit} disabled={saveTrip.isPending}>
            {saveTrip.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {trip ? "Update Trip" : "Save Trip"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
