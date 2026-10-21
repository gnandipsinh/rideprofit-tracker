import { Truck } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/lib/app-context";
import { ALL_VEHICLES } from "@/lib/types";

export function VehicleSelector({ includeAll = true }: { includeAll?: boolean }) {
  const { activeVehicles, selectedVehicleId, setSelectedVehicleId, selectedLabel } = useApp();

  if (activeVehicles.length === 0) {
    return null;
  }

  return (
    <div className="glass-card rounded-2xl p-3 sm:p-4 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(15rem,0.9fr)] sm:items-center sm:gap-4 border border-cyan-500/15">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-cyan-400">
            Selected Vehicle
          </p>
          <p className="truncate text-xs sm:text-sm font-semibold text-white">{selectedLabel}</p>
        </div>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.2)]">
          <Truck className="h-4 w-4" />
        </div>
      </div>

      <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
        <SelectTrigger className="mt-2.5 sm:mt-0 h-11 w-full rounded-xl border border-slate-800 bg-slate-900/80 hover:border-cyan-500/40 text-sm font-semibold text-white">
          <SelectValue placeholder="Select a vehicle" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {includeAll && activeVehicles.length > 1 ? (
            <SelectItem value={ALL_VEHICLES}>All Vehicles</SelectItem>
          ) : null}
          {activeVehicles.map((v) => (
            <SelectItem key={v._id} value={v._id}>
              {v.type || v.name}
              {v.vehicleNumber ? ` · ${v.vehicleNumber}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
