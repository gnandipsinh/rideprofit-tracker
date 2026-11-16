import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronRight,
  MoreVertical,
  Pencil,
  Plus,
  Power,
  Search,
  Trash2,
  Truck,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useApp } from "@/lib/app-context";
import { useDeleteVehicle, useSaveVehicle, useToggleVehicleStatus, useTrips } from "@/lib/queries";
import { VEHICLE_TYPES, type Vehicle, type VehiclePayload } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { aggregate } from "@/lib/calc";
import { formatDateShort, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/vehicles")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Vehicles — RideProfit Tracker" },
      {
        name: "description",
        content:
          "Manage fleet vehicles, monitor operating status, and inspect per-vehicle trip accounting.",
      },
      { property: "og:title", content: "Vehicles — RideProfit Tracker" },
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
      // toast handled in useToggleVehicleStatus
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
      <div className="space-y-6">
        {/* Header Bar with Search & "+ Add Vehicle" */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Vehicles</h2>
            <p className="text-xs sm:text-sm text-slate-400">
              {vehicles.length} vehicle(s) registered in your fleet
            </p>
          </div>

          <Button
            onClick={openNew}
            className="h-11 px-5 rounded-xl font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-md shadow-cyan-500/20 tap-scale flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Vehicle</span>
          </Button>
        </div>

        {/* Search bar & Type Filter Pills */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search vehicle by number, model or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 rounded-xl border-[#1C2B44] bg-[#10192A] pl-11 text-sm text-white placeholder:text-slate-400 focus-visible:border-cyan-500 focus-visible:ring-1 focus-visible:ring-cyan-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {filterTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setFilterType(tab.value)}
                className={cn(
                  "tap-scale shrink-0 min-h-[38px] rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all",
                  filterType === tab.value
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20"
                    : "border border-[#1C2B44] bg-[#10192A] text-slate-400 hover:text-white hover:bg-[#132137]",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Vehicle Grid & Details Split */}
        <div
          className={cn(
            "grid gap-4 transition-[grid-template-columns] duration-300 ease-out",
            detailVehicle
              ? "lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_26rem]"
              : "lg:grid-cols-1",
          )}
        >
          <div className="min-w-0">
            {vehiclesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-2xl bg-[#10192A]" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<Truck className="h-6 w-6" />}
                title={search || filterType !== "all" ? "No vehicles found" : "No vehicles yet"}
                description={
                  search || filterType !== "all"
                    ? "Try adjusting your search query or vehicle type filter."
                    : "Add your first vehicle to start recording trips and calculating real profits."
                }
                action={
                  !search && filterType === "all" ? (
                    <Button
                      onClick={openNew}
                      className="h-11 rounded-xl px-5 font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                    >
                      Add Vehicle
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="space-y-3">
                {filtered.map((v) => {
                  const isSelected = detailVehicle?._id === v._id;
                  return (
                    <div
                      key={v._id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      onClick={() => openDetails(v._id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openDetails(v._id);
                        }
                      }}
                      className={cn(
                        "rounded-2xl border p-3.5 sm:p-4.5 transition-all duration-150 cursor-pointer text-left flex items-center justify-between gap-3 sm:gap-4",
                        isSelected
                          ? "border-cyan-500 bg-[#13223A] shadow-lg shadow-cyan-500/10"
                          : "border-[#1C2B44] bg-[#10192A] hover:border-cyan-500/40 hover:bg-[#132137]",
                      )}
                    >
                      {/* Left: Clean Truck Icon Badge */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-cyan-500/25 bg-cyan-500/10 text-cyan-400">
                          <Truck className="h-5 w-5" />
                        </div>

                        {/* Middle: Details */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm sm:text-base font-bold text-white truncate">
                              {v.name}
                            </h3>
                            <span
                              className={cn(
                                "shrink-0 rounded-md px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider",
                                v.isActive
                                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                  : "bg-rose-500/15 text-rose-400 border border-rose-500/30",
                              )}
                            >
                              {v.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-slate-400">
                            <span className="font-mono font-bold text-cyan-400 uppercase tracking-wider">
                              {v.vehicleNumber || "No plate"}
                            </span>
                            <span>·</span>
                            <span>{v.type}</span>
                            {v.model ? (
                              <>
                                <span>·</span>
                                <span>{v.model}</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions menu */}
                      <div
                        className="flex items-center gap-2 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-xl text-slate-400 hover:text-white hover:bg-[#172844] border border-transparent hover:border-[#1C2B44]"
                              aria-label="Vehicle actions"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-44 rounded-xl border-[#1C2B44] bg-[#080D18] text-slate-200"
                          >
                            <DropdownMenuItem
                              onClick={() => toggleActive(v)}
                              className="cursor-pointer text-xs"
                            >
                              <Power className="h-3.5 w-3.5 mr-2 text-cyan-400" />
                              <span>{v.isActive ? "Set Inactive" : "Set Active"}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openEdit(v)}
                              className="cursor-pointer text-xs"
                            >
                              <Pencil className="h-3.5 w-3.5 mr-2 text-cyan-400" />
                              <span>Edit Details</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-[#1C2B44]" />
                            <DropdownMenuItem
                              onClick={() => {
                                setMobileDetailsOpen(false);
                                setConfirm(v);
                              }}
                              className="cursor-pointer text-xs text-rose-400 focus:text-rose-400"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" />
                              <span>Delete Vehicle</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <ChevronRight className="hidden sm:block h-4 w-4 text-slate-500" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Desktop Right Panel for Selected Vehicle */}
          {detailVehicle ? (
            <div className="hidden lg:block">
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

      {/* Mobile Details Modal Sheet */}
      {detailVehicle && mobileDetailsOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#0B111E] lg:hidden">
          <div className="flex shrink-0 items-center justify-between border-b border-[#1C2B44] bg-[#080D18] px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={clearSelection}
                className="grid h-9 w-9 place-items-center rounded-xl border border-[#1C2B44] bg-[#10192A] text-slate-200"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <p className="text-[0.65rem] font-bold uppercase tracking-wider text-cyan-400">
                  Vehicle Details
                </p>
                <p className="text-sm font-bold text-white truncate">
                  {detailVehicle.vehicleNumber || detailVehicle.name}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={clearSelection}
              className="text-xs font-bold text-slate-400 hover:text-white"
            >
              Done
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 pb-12">
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

      {/* Add / Edit Vehicle Modal Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto rounded-3xl p-5 sm:p-6 bg-[#080D18] border-[#1C2B44] text-white">
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl font-black text-white">
              {editing ? "Edit Vehicle" : "Add Vehicle"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Trip logs, fuel records, and profit calculations stay isolated per vehicle.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Field label="Vehicle Type" id="v-type">
              <div className="flex flex-wrap gap-2 pb-1">
                {VEHICLE_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, type: t }))}
                    className={cn(
                      "tap-scale shrink-0 rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-all",
                      form.type === t
                        ? "border-cyan-500 bg-cyan-500 text-slate-950 font-bold"
                        : "border-[#1C2B44] bg-[#10192A] text-slate-400 hover:border-cyan-500/40",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Vehicle Number / Plate" id="v-number">
              <Input
                id="v-number"
                value={form.vehicleNumber}
                onChange={(e) =>
                  setForm((f) => ({ ...f, vehicleNumber: e.target.value.toUpperCase() }))
                }
                placeholder="e.g. GJ04 AB 1234"
                className="h-11 rounded-xl bg-[#10192A] border-[#1C2B44] text-sm text-white uppercase placeholder:text-slate-400 font-mono font-bold"
              />
            </Field>

            <Field label="Vehicle Name / Model" id="v-name">
              <Input
                id="v-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Eicher Pro 2114"
                className="h-11 rounded-xl bg-[#10192A] border-[#1C2B44] text-sm text-white placeholder:text-slate-400"
              />
            </Field>

            <Field label="Manufacturing Year / Model" id="v-model">
              <Input
                id="v-model"
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                placeholder="e.g. 2024"
                className="h-11 rounded-xl bg-[#10192A] border-[#1C2B44] text-sm text-white placeholder:text-slate-400"
              />
            </Field>

            <Field label="Operating Notes / Route / Driver" id="v-notes">
              <Textarea
                id="v-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Driver details, regular routes, EMI terms..."
                className="min-h-20 rounded-xl bg-[#10192A] border-[#1C2B44] text-sm text-white placeholder:text-slate-400"
              />
            </Field>
          </div>

          <DialogFooter className="mt-4 flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="h-11 w-full rounded-xl sm:w-auto border-[#1C2B44] bg-[#10192A] text-slate-300 hover:bg-[#172844] hover:text-white"
              onClick={() => setOpen(false)}
              disabled={save.isPending}
            >
              Cancel
            </Button>
            <Button
              className="h-11 w-full rounded-xl font-bold sm:w-auto bg-cyan-500 text-slate-950 hover:bg-cyan-400"
              onClick={submit}
              disabled={save.isPending}
            >
              {save.isPending ? (
                <span className="mr-1.5 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : null}
              {editing ? "Save Changes" : "Save Vehicle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={Boolean(confirm)} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent className="w-[calc(100vw-1.5rem)] max-w-sm rounded-2xl bg-[#080D18] border-[#1C2B44] text-white">
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle className="text-lg font-bold text-white">
              Delete {confirm?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-400">
              This will permanently delete this vehicle and all associated trip accounting records.
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
        className="mb-1.5 block text-xs font-semibold text-slate-400 uppercase tracking-wider"
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
    ["Plate Number", vehicle.vehicleNumber || "Not specified"],
    ["Vehicle Name", vehicle.name],
    ["Model / Year", vehicle.model || "Not specified"],
    ["Registered", formatDateShort(vehicle.createdAt)],
    [
      "Status",
      <span
        key="status"
        className={cn(
          "inline-flex rounded-md px-2 py-0.5 text-[0.65rem] font-bold uppercase",
          vehicle.isActive
            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
            : "bg-rose-500/15 text-rose-400 border border-rose-500/30",
        )}
      >
        {vehicle.isActive ? "Active" : "Inactive"}
      </span>,
    ],
  ];

  return (
    <aside
      className={cn(
        "rounded-2xl border border-[#1C2B44] bg-[#10192A] p-5",
        sticky && "lg:sticky lg:top-24 lg:h-fit",
      )}
    >
      {hideHeader ? null : (
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#1C2B44]">
          <div className="min-w-0">
            <span className="text-[0.65rem] font-bold uppercase tracking-wider text-cyan-400 block">
              Vehicle Overview
            </span>
            <h3 className="mt-1 text-lg font-black text-white truncate">{vehicle.name}</h3>
            <p className="text-xs font-mono font-bold text-cyan-400">{vehicle.vehicleNumber}</p>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white text-lg font-bold p-1"
            >
              ×
            </button>
          ) : null}
        </div>
      )}

      {/* Specifications */}
      <div className="mt-4 divide-y divide-[#1C2B44]/60 rounded-xl border border-[#1C2B44] bg-[#080D18]/70 px-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between py-2 text-xs">
            <span className="text-slate-400">{label}</span>
            <span className="font-semibold text-white">{value}</span>
          </div>
        ))}
      </div>

      {/* Performance KPIs for this vehicle */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-[#1C2B44] bg-[#080D18]/70 p-3">
          <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">
            Total Trips
          </p>
          <p className="text-base font-black text-white tabular-nums mt-1">
            {tripsLoading ? "..." : totalsUnavailable ? "—" : totals.trips}
          </p>
        </div>

        <div className="rounded-xl border border-[#1C2B44] bg-[#080D18]/70 p-3">
          <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">
            Net Profit
          </p>
          <p
            className={cn(
              "text-base font-black tabular-nums mt-1",
              totalsUnavailable
                ? "text-white"
                : totals.profit >= 0
                  ? "text-emerald-400"
                  : "text-rose-400",
            )}
          >
            {tripsLoading ? "..." : totalsUnavailable ? "—" : formatMoney(totals.profit, symbol)}
          </p>
        </div>

        <div className="rounded-xl border border-[#1C2B44] bg-[#080D18]/70 p-3">
          <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">Income</p>
          <p className="text-base font-black text-white tabular-nums mt-1">
            {tripsLoading ? "..." : totalsUnavailable ? "—" : formatMoney(totals.income, symbol)}
          </p>
        </div>

        <div className="rounded-xl border border-[#1C2B44] bg-[#080D18]/70 p-3">
          <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">
            Expenses
          </p>
          <p className="text-base font-black text-rose-400 tabular-nums mt-1">
            {tripsLoading
              ? "..."
              : totalsUnavailable
                ? "—"
                : formatMoney(totals.totalExpense, symbol)}
          </p>
        </div>
      </div>

      {vehicle.notes ? (
        <div className="mt-4 rounded-xl border border-[#1C2B44] bg-[#080D18]/70 p-3 text-xs">
          <p className="font-bold text-slate-400 uppercase tracking-wider text-[0.65rem]">Notes</p>
          <p className="mt-1 text-slate-300 leading-relaxed">{vehicle.notes}</p>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          onClick={onEdit}
          className="h-10 rounded-xl border-[#1C2B44] bg-[#080D18] text-slate-300 hover:text-white"
        >
          <Pencil className="mr-1.5 h-3.5 w-3.5 text-cyan-400" />
          Edit
        </Button>
        <Button
          variant="destructive"
          onClick={onDelete}
          className="h-10 rounded-xl bg-rose-600/20 text-rose-400 border border-rose-500/30 hover:bg-rose-600 hover:text-white"
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Delete
        </Button>
      </div>
    </aside>
  );
}
