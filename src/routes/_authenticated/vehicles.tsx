import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, Pencil, Plus, Power, Search, Trash2, Truck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import { useDeleteVehicle, useSaveVehicle, useToggleVehicleStatus, useTrips } from "@/lib/queries";
import { VEHICLE_TYPES, type Vehicle, type VehiclePayload } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { aggregate } from "@/lib/calc";
import { formatDateShort, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/vehicles")({
  head: () => ({
    meta: [
      { title: "Vehicles — Jay Mataji Transport" },
      {
        name: "description",
        content:
          "Add, edit and remove vehicles. Every vehicle keeps its own trips, expenses and profit reports.",
      },
      { property: "og:title", content: "Vehicles — Jay Mataji Transport" },
      {
        property: "og:description",
        content: "Manage your fleet and keep trip accounting separated per vehicle.",
      },
    ],
  }),
  component: VehiclesPage,
});

const empty: VehiclePayload = {
  name: "",
  type: "Eicher",
  model: "",
  vehicleNumber: "",
  notes: "",
  isActive: true,
};

function VehiclesPage() {
  const toggle = useToggleVehicleStatus();
  const { vehicles, vehiclesLoading } = useApp();
  const save = useSaveVehicle();
  const remove = useDeleteVehicle();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<VehiclePayload>(empty);
  const [confirm, setConfirm] = useState<Vehicle | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  useEffect(() => {
    if (selectedVehicleId && !vehicles.some((v) => v._id === selectedVehicleId)) {
      setSelectedVehicleId(null);
      setMobileDetailsOpen(false);
    }
  }, [vehicles, selectedVehicleId]);

  const selectedVehicle = selectedVehicleId
    ? (vehicles.find((v) => v._id === selectedVehicleId) ?? null)
    : null;

  const clearSelection = () => {
    setSelectedVehicleId(null);
    setMobileDetailsOpen(false);
  };

  const openDetails = (id: string) => {
    setSelectedVehicleId(id);
    const isDesktop =
      typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
    setMobileDetailsOpen(!isDesktop);
  };

  const toggleActive = async (v: Vehicle) => {
    try {
      await toggle.mutateAsync({ id: v._id, isActive: !v.isActive });
    } catch {
      // toast handled in useToggleVehicleStatus onError
    }
  };

  const filtered = useMemo(() => {
    let list = vehicles;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.vehicleNumber.toLowerCase().includes(q) ||
          v.model.toLowerCase().includes(q),
      );
    }
    if (filterType !== "all") {
      list = list.filter((v) => v.type === filterType);
    }
    return list;
  }, [vehicles, search, filterType]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: vehicles.length };
    for (const v of vehicles) {
      counts[v.type] = (counts[v.type] ?? 0) + 1;
    }
    return counts;
  }, [vehicles]);

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (v: Vehicle) => {
    setMobileDetailsOpen(false);
    setEditing(v);
    setForm({
      name: v.name,
      type: v.type,
      model: v.model,
      vehicleNumber: v.vehicleNumber,
      notes: v.notes ?? "",
      isActive: v.isActive,
    });
    setOpen(true);
  };

  const submit = () => {
    if (!form.name.trim()) {
      toast.error("Vehicle name is required");
      return;
    }
    save.mutate(
      { id: editing?._id, payload: { ...form, name: form.name.trim() } },
      { onSuccess: () => setOpen(false) },
    );
  };

  const filterTabs = [
    { value: "all", label: `All (${typeCounts["all"] ?? 0})` },
    ...VEHICLE_TYPES.filter((t) => typeCounts[t]).map((t) => ({
      value: t,
      label: `${t} (${typeCounts[t] ?? 0})`,
    })),
  ];

  const detailVehicle = selectedVehicle;
  const detailTrips = useTrips(
    detailVehicle?._id ? { vehicleId: detailVehicle._id } : {},
    Boolean(detailVehicle?._id),
  );
  const detailTotals = useMemo(() => aggregate(detailTrips.data ?? []), [detailTrips.data]);
  const detailTotalsUnavailable = detailTrips.isError;

  return (
    <AppShell showAddTrip={false}>
      <div className="page-stack">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold sm:text-2xl">Vehicles</h2>
            <p className="text-xs text-muted-foreground">
              {vehicles.length} vehicle(s) in your fleet
            </p>
          </div>
          <Button onClick={openNew} className="h-11 shrink-0 rounded-xl px-4 font-semibold">
            <Plus className="mr-1.5 h-4 w-4" /> Add
          </Button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search vehicles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-12 rounded-2xl border-border/70 bg-secondary/40 pl-11 text-base placeholder:text-muted-foreground/80 focus-visible:border-primary/50 focus-visible:ring-primary/40"
          />
        </div>

        <div className="-mx-0.5 flex flex-wrap gap-2 overflow-x-auto px-0.5 pb-0.5 no-scrollbar">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setFilterType(tab.value)}
              className={cn(
                "tap-scale shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition-colors",
                filterType === tab.value
                  ? "border-primary/60 bg-primary/15 text-primary shadow-[0_0_18px_-8px_color-mix(in_srgb,var(--primary)_70%,transparent)]"
                  : "border-border/70 bg-secondary/40 text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          className={cn(
            "grid gap-4 transition-[grid-template-columns] duration-300 ease-out",
            detailVehicle
              ? "lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_26rem] 2xl:grid-cols-[minmax(0,1fr)_28rem]"
              : "lg:grid-cols-1",
          )}
        >
          <div className="min-w-0">
            {vehiclesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-2xl" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<Truck className="h-6 w-6" />}
                title={search || filterType !== "all" ? "No vehicles found" : "No vehicles yet"}
                description={
                  search || filterType !== "all"
                    ? "Try adjusting your search or filter."
                    : "Add a vehicle to start recording trips and profit."
                }
                action={
                  !search && filterType === "all" ? (
                    <Button onClick={openNew} className="h-11 rounded-xl px-5 font-semibold">
                      Add Vehicle
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <ul
                className={cn(
                  "grid grid-cols-1 gap-3 min-[400px]:grid-cols-2",
                  !detailVehicle && "min-[1100px]:grid-cols-3",
                )}
              >
                {filtered.map((v) => (
                  <li key={v._id}>
                    <div
                      role="button"
                      tabIndex={0}
                      aria-pressed={detailVehicle?._id === v._id}
                      onClick={() => openDetails(v._id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openDetails(v._id);
                        }
                      }}
                      className={cn(
                        "glass-card glass-card-hover w-full cursor-pointer rounded-2xl p-4 transition-all duration-200",
                        detailVehicle?._id === v._id
                          ? "border-primary/70 bg-primary/[0.06] shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_35%,transparent),0_12px_40px_-24px_color-mix(in_srgb,var(--primary)_55%,transparent)]"
                          : "hover:border-cyan-400/40",
                      )}
                    >
                      <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 text-left">
                        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-background/55 text-primary ring-1 ring-border/80">
                          <Truck className="h-7 w-7" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                            <p className="min-w-0 max-w-full truncate text-sm font-extrabold sm:text-base">
                              {v.vehicleNumber || v.name}
                            </p>
                            <span
                              className={cn(
                                "shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-bold",
                                v.isActive
                                  ? "bg-success/15 text-success"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              {v.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {[v.name, v.type, v.model].filter(Boolean).join(" · ") || "No details"}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                      <div
                        className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Badge variant="gold" className="min-w-0 max-w-full truncate">
                          {v.type}
                        </Badge>
                        <div className="ml-auto flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="iconSm"
                            aria-label={`Toggle ${v.name} status`}
                            className="rounded-xl text-success hover:bg-success/10"
                            onClick={() => toggleActive(v)}
                            disabled={toggle.isPending}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="iconSm"
                            aria-label={`Edit ${v.name}`}
                            className="rounded-xl text-primary hover:bg-primary/10"
                            onClick={() => openEdit(v)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="iconSm"
                            aria-label={`Delete ${v.name}`}
                            className="rounded-xl text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              setMobileDetailsOpen(false);
                              setConfirm(v);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {detailVehicle ? (
            <div className="details-panel-enter hidden lg:block">
              <VehicleDetailsCard
                vehicle={detailVehicle}
                totals={detailTotals}
                tripsLoading={detailTrips.isLoading}
                totalsUnavailable={detailTotalsUnavailable}
                onEdit={() => openEdit(detailVehicle)}
                onDelete={() => {
                  setMobileDetailsOpen(false);
                  setConfirm(detailVehicle);
                }}
                onClose={clearSelection}
              />
            </div>
          ) : null}
        </div>
      </div>

      {detailVehicle && mobileDetailsOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-background lg:hidden">
          <div className="flex shrink-0 items-center gap-2 border-b border-border/60 bg-card/95 px-3 py-3 backdrop-blur">
            <button
              type="button"
              onClick={clearSelection}
              className="tap-scale grid h-10 w-10 place-items-center rounded-xl border border-border/70 bg-secondary/50 text-foreground"
              aria-label="Back to vehicles"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-primary">
                Vehicle Details
              </p>
              <p className="break-words text-sm font-extrabold">
                {detailVehicle.vehicleNumber || detailVehicle.name}
              </p>
            </div>
            <button
              type="button"
              onClick={clearSelection}
              className="tap-scale grid h-10 w-10 place-items-center rounded-xl border border-border/70 bg-secondary/50 text-muted-foreground"
              aria-label="Close vehicle details"
            >
              <span aria-hidden className="text-lg leading-none">
                ×
              </span>
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-8">
            <VehicleDetailsCard
              vehicle={detailVehicle}
              totals={detailTotals}
              tripsLoading={detailTrips.isLoading}
              totalsUnavailable={detailTotalsUnavailable}
              onEdit={() => openEdit(detailVehicle)}
              onDelete={() => setConfirm(detailVehicle)}
              onClose={clearSelection}
              sticky={false}
              hideHeader
            />
          </div>
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto rounded-3xl p-4 sm:p-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl font-extrabold">
              {editing ? "Edit Vehicle" : "Add Vehicle"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Trips and reports stay separated per vehicle.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Field label="Vehicle Type" id="v-type">
              <div className="flex flex-wrap gap-2 pb-1">
                {VEHICLE_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, type: t }))}
                    className={cn(
                      "tap-scale shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition-all",
                      form.type === t
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-secondary/60 text-muted-foreground hover:border-primary/50",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Vehicle Number" id="v-number">
              <Input
                id="v-number"
                value={form.vehicleNumber}
                onChange={(e) =>
                  setForm((f) => ({ ...f, vehicleNumber: e.target.value.toUpperCase() }))
                }
                placeholder="e.g. GJ04AX9209"
                className="h-12 rounded-xl bg-secondary/60 text-base uppercase"
              />
            </Field>
            <Field label="Vehicle Name" id="v-name">
              <Input
                id="v-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Eicher 1109"
                className="h-12 rounded-xl bg-secondary/60 text-base"
              />
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

          <DialogFooter className="mt-4 flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="h-12 w-full rounded-xl sm:w-auto"
              onClick={() => setOpen(false)}
              disabled={save.isPending}
            >
              Cancel
            </Button>
            <Button
              className="h-12 w-full rounded-xl font-bold sm:w-auto"
              onClick={submit}
              disabled={save.isPending}
            >
              {save.isPending ? (
                <span className="mr-1.5 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : null}
              {editing ? "Save changes" : "Save Vehicle"}
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
            <AlertDialogCancel className="h-11 w-full rounded-xl sm:w-auto">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11 w-full rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
              onClick={() => {
                const id = confirm?._id;
                if (id) {
                  remove.mutate(id, {
                    onSuccess: () => {
                      if (selectedVehicleId === id) clearSelection();
                    },
                  });
                }
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

function VehicleDetailsCard({
  vehicle,
  totals,
  tripsLoading,
  totalsUnavailable,
  onEdit,
  onDelete,
  onClose,
  sticky = true,
  hideHeader = false,
}: {
  vehicle: Vehicle;
  totals: ReturnType<typeof aggregate>;
  tripsLoading: boolean;
  totalsUnavailable: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onClose?: () => void;
  sticky?: boolean;
  hideHeader?: boolean;
}) {
  const { symbol } = useApp();
  const rows: Array<[string, React.ReactNode]> = [
    ["Vehicle type", vehicle.type],
    ["Vehicle number", vehicle.vehicleNumber || "Not added"],
    ["Vehicle name", vehicle.name],
    ["Model", vehicle.model || "Not added"],
    ["Added on", formatDateShort(vehicle.createdAt)],
    [
      "Status",
      <span
        key="status"
        className={cn(
          "inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-bold",
          vehicle.isActive ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
        )}
      >
        {vehicle.isActive ? "Active" : "Inactive"}
      </span>,
    ],
  ];

  return (
    <aside
      className={cn(
        "fleet-panel min-w-0 rounded-3xl p-4 sm:p-5",
        sticky && "lg:sticky lg:top-24 lg:h-fit",
      )}
    >
      {hideHeader ? null : (
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-primary">
              Vehicle Details
            </p>
            <h3 className="mt-1 break-words text-xl font-extrabold leading-tight">
              {vehicle.vehicleNumber || vehicle.name}
            </h3>
            <p className="mt-0.5 break-words text-sm text-muted-foreground">{vehicle.name}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30">
              <Truck className="h-6 w-6" />
            </div>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close vehicle details"
                className="tap-scale grid h-9 w-9 place-items-center rounded-xl border border-border/70 bg-secondary/50 text-muted-foreground hover:text-foreground"
              >
                <span aria-hidden className="text-lg leading-none">
                  ×
                </span>
              </button>
            ) : null}
          </div>
        </div>
      )}

      <div className="mt-4 divide-y divide-border/55 overflow-hidden rounded-2xl border border-border/65 bg-background/30 px-3">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2.5 text-xs"
          >
            <span className="shrink-0 text-muted-foreground">{label}</span>
            <span className="min-w-0 flex-1 break-words text-right font-semibold text-foreground">
              {value}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <DetailMetric
          label="Total trips"
          value={tripsLoading ? "..." : totalsUnavailable ? "—" : String(totals.trips)}
        />
        <DetailMetric
          label="Net profit"
          value={
            tripsLoading ? "..." : totalsUnavailable ? "—" : formatMoney(totals.profit, symbol)
          }
          tone={totalsUnavailable ? "default" : totals.profit >= 0 ? "success" : "danger"}
        />
        <DetailMetric
          label="Total income"
          value={
            tripsLoading ? "..." : totalsUnavailable ? "—" : formatMoney(totals.income, symbol)
          }
          tone={totalsUnavailable ? "default" : "success"}
        />
        <DetailMetric
          label="Total expense"
          value={
            tripsLoading
              ? "..."
              : totalsUnavailable
                ? "—"
                : formatMoney(totals.totalExpense, symbol)
          }
          tone={totalsUnavailable ? "default" : "danger"}
        />
      </div>
      {totalsUnavailable ? (
        <p className="mt-3 text-xs font-medium text-destructive">
          Trip totals could not be loaded. Try again shortly.
        </p>
      ) : null}

      {vehicle.notes ? (
        <div className="mt-4 rounded-2xl border border-border/65 bg-background/25 p-3">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Notes
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground/80">{vehicle.notes}</p>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={onEdit} className="h-11 rounded-xl">
          <Pencil className="mr-1.5 h-4 w-4" /> Edit
        </Button>
        <Button variant="destructive" onClick={onDelete} className="h-11 rounded-xl">
          <Trash2 className="mr-1.5 h-4 w-4" /> Delete
        </Button>
      </div>
      {onClose && sticky ? (
        <Button variant="ghost" onClick={onClose} className="mt-2 h-10 w-full rounded-xl">
          Close details
        </Button>
      ) : null}
    </aside>
  );
}

function DetailMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "danger";
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border/65 bg-background/30 p-3">
      <p className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 break-words text-sm font-extrabold tabular-nums sm:text-base",
          tone === "success" && "text-success",
          tone === "danger" && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}
