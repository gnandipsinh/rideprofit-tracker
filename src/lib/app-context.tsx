import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSettings, useVehicles } from "./queries";
import { currencySymbol } from "./format";
import { ALL_VEHICLES, type AppSettings, type Vehicle } from "./types";

const SELECTED_KEY = "vcs.selectedVehicleId";

interface AppContextValue {
  vehicles: Vehicle[];
  activeVehicles: Vehicle[];
  vehiclesLoading: boolean;
  vehiclesError: Error | null;
  settings: AppSettings | undefined;
  appName: string;
  symbol: string;
  selectedVehicleId: string;
  setSelectedVehicleId: (id: string) => void;
  selectedVehicle: Vehicle | null;
  selectedLabel: string;
  isAllVehicles: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const vehiclesQuery = useVehicles();
  const settingsQuery = useSettings();
  const [selectedVehicleId, setSelected] = useState<string>("");

  const vehicles = useMemo(() => vehiclesQuery.data ?? [], [vehiclesQuery.data]);
  const activeVehicles = useMemo(() => vehicles.filter((v) => v.isActive), [vehicles]);
  const settings = settingsQuery.data;

  // Restore last selection among active vehicles only; inactive vehicles are not selectable.
  useEffect(() => {
    if (vehicles.length === 0) return;
    const ids = activeVehicles.map((v) => v._id);
    if (
      selectedVehicleId &&
      (selectedVehicleId === ALL_VEHICLES || ids.includes(selectedVehicleId))
    )
      return;

    const stored = typeof window !== "undefined" ? window.localStorage.getItem(SELECTED_KEY) : null;
    const next =
      stored && (stored === ALL_VEHICLES || ids.includes(stored))
        ? stored
        : settings?.defaultVehicleId && ids.includes(settings.defaultVehicleId)
          ? settings.defaultVehicleId
          : ids[0];
    setSelected(next ?? "");
  }, [vehicles, activeVehicles, settings?.defaultVehicleId, selectedVehicleId]);

  const setSelectedVehicleId = (id: string) => {
    setSelected(id);
    if (typeof window !== "undefined") window.localStorage.setItem(SELECTED_KEY, id);
  };

  const value = useMemo<AppContextValue>(() => {
    const selectedVehicle = activeVehicles.find((v) => v._id === selectedVehicleId) ?? null;
    const isAllVehicles = selectedVehicleId === ALL_VEHICLES;
    return {
      vehicles,
      activeVehicles,
      vehiclesLoading: vehiclesQuery.isLoading,
      vehiclesError: (vehiclesQuery.error as Error | null) ?? null,
      settings,
      appName: settings?.transportationName || settings?.appName || "Vehicle Calculation System",
      symbol: currencySymbol(settings?.currency ?? "INR"),
      selectedVehicleId,
      setSelectedVehicleId,
      selectedVehicle,
      selectedLabel: isAllVehicles
        ? "All Vehicles"
        : selectedVehicle
          ? [selectedVehicle.type || selectedVehicle.name, selectedVehicle.vehicleNumber]
              .filter(Boolean)
              .join(" · ") || "No vehicle selected"
          : "No vehicle selected",
      isAllVehicles,
    };
  }, [
    vehicles,
    activeVehicles,
    settings,
    selectedVehicleId,
    vehiclesQuery.isLoading,
    vehiclesQuery.error,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
