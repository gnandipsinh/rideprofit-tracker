import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2, Truck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useDeleteVehicle, useSaveVehicle } from "@/lib/queries";
import { VEHICLE_TYPES, type Vehicle, type VehiclePayload } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/vehicles")({
  head: () => ({
    meta: [
      { title: "Vehicles — Fleet Manager" },
      {
        name: "description",
        content: "Add, edit and remove vehicles. Every vehicle keeps its own trips, expenses and profit reports.",
      },
      { property: "og:title", content: "Vehicles — Fleet Manager" },
      { property: "og:description", content: "Manage your fleet and keep trip accounting separated per vehicle." },
    ],
  }),
  component: VehiclesPage,
});

const empty: VehiclePayload = { name: "", type: "Eicher", model: "", vehicleNumber: "", notes: "" };

function VehiclesPage() {
  const { vehicles, vehiclesLoading } = useApp();
  const save = useSaveVehicle();
  const remove = useDeleteVehicle();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<VehiclePayload>(empty);
  const [confirm, setConfirm] = useState<Vehicle | null>(null);

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (v: Vehicle) => {
    setEditing(v);
    setForm({ name: v.name, type: v.type, model: v.model, vehicleNumber: v.vehicleNumber, notes: v.notes ?? "" });
    setOpen(true);
  };

  const submit = () => {
    if (!form.name.trim()) return toast.error("Vehicle name is required");
    save.mutate(
      { id: editing?._id, payload: { ...form, name: form.name.trim() } },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <AppShell showAddTrip={false}>
      <div className="space-y-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">Vehicles</h2>
            <p className="text-xs text-muted-foreground">{vehicles.length} vehicle(s) in your fleet</p>
          </div>
          <Button onClick={openNew} className="h-11 shrink-0 rounded-xl px-4 font-semibold">
            <Plus className="mr-1.5 h-4 w-4" /> Add
          </Button>
        </div>

        {vehiclesLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : vehicles.length === 0 ? (
          <EmptyState
            icon={<Truck className="h-6 w-6" />}
            title="No vehicles yet"
            description="Add a vehicle to start recording trips and profit."
            action={
              <Button onClick={openNew} className="h-11 rounded-xl px-5 font-semibold">
                Add Vehicle
              </Button>
            }
          />
        ) : (
          <ul className="space-y-3">
            {vehicles.map((v) => (
              <li key={v._id} className="glass-card rounded-2xl p-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold">{v.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {[v.type, v.model, v.vehicleNumber].filter(Boolean).join(" · ") || "No details"}
                    </p>
                    {v.notes ? <p className="mt-1.5 line-clamp-2 text-xs text-foreground/70">{v.notes}</p> : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${v.name}`}
                      className="h-10 w-10 rounded-xl text-primary hover:bg-primary/10"
                      onClick={() => openEdit(v)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${v.name}`}
                      className="h-10 w-10 rounded-xl text-destructive hover:bg-destructive/10"
                      onClick={() => setConfirm(v)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto rounded-2xl p-4 sm:p-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-lg">{editing ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle>
            <DialogDescription className="text-xs">Trips and reports stay separated per vehicle.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Field label="Vehicle name" id="v-name">
              <Input
                id="v-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Eicher 1109"
                className="h-12 rounded-xl bg-secondary/60 text-base"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Type">
                <Select value={form.type} onValueChange={(t) => setForm((f) => ({ ...f, type: t }))}>
                  <SelectTrigger className="h-12 rounded-xl bg-secondary/60 text-base">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Model" id="v-model">
                <Input
                  id="v-model"
                  value={form.model}
                  onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                  placeholder="2021"
                  className="h-12 rounded-xl bg-secondary/60 text-base"
                />
              </Field>
            </div>
            <Field label="Vehicle number" id="v-number">
              <Input
                id="v-number"
                value={form.vehicleNumber}
                onChange={(e) => setForm((f) => ({ ...f, vehicleNumber: e.target.value.toUpperCase() }))}
                placeholder="GJ 01 AB 1234"
                className="h-12 rounded-xl bg-secondary/60 text-base uppercase"
              />
            </Field>
            <Field label="Notes" id="v-notes">
              <Textarea
                id="v-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Driver name, route, EMI details…"
                className="min-h-20 rounded-xl bg-secondary/60 text-base"
              />
            </Field>
          </div>

          <DialogFooter className="mt-2 flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="h-12 w-full rounded-xl sm:w-auto" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="h-12 w-full rounded-xl font-bold sm:w-auto" onClick={submit} disabled={save.isPending}>
              {editing ? "Save changes" : "Add vehicle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(confirm)} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent className="w-[calc(100vw-1.5rem)] max-w-sm rounded-2xl">
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle>Delete {confirm?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the vehicle and every trip recorded for it.
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

function Field({ label, id, children }: { label: string; id?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <Label
        htmlFor={id}
        className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
      >
        {label}
      </Label>
      {children}
    </div>
  );
}
