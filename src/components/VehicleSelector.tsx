import { Truck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/lib/app-context";
import { ALL_VEHICLES } from "@/lib/types";

export function VehicleSelector({ includeAll = true }: { includeAll?: boolean }) {
  const { vehicles, selectedVehicleId, setSelectedVehicleId, selectedLabel } = useApp();

  return (
    <div className="glass-card rounded-2xl p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-primary">Vehicle</p>
          <p className="truncate text-xs text-muted-foreground">{selectedLabel}</p>
        </div>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted/60 text-primary">
          <Truck className="h-4 w-4" />
        </div>
      </div>
      <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
        <SelectTrigger className="mt-3 h-12 w-full rounded-xl border-input bg-secondary/60 text-base font-semibold">
          <SelectValue placeholder={vehicles.length ? "Select a vehicle" : "No vehicles yet"} />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {includeAll && vehicles.length > 1 ? <SelectItem value={ALL_VEHICLES}>All Vehicles</SelectItem> : null}
          {vehicles.map((v) => (
            <SelectItem key={v._id} value={v._id}>
              {v.name}
              {v.vehicleNumber ? ` · ${v.vehicleNumber}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
