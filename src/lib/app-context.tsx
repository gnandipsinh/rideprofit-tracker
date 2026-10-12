import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSettings, useVehicles } from "./queries";
import { currencySymbol } from "./format";
import { ALL_VEHICLES, type AppSettings, type Vehicle } from "./types";

interface AppContextValue {
  vehicles: Vehicle[];
  activeVehicles: Vehicle[];
  vehiclesLoading: boolean;
  vehiclesError: Error | null;
  settings: AppSettings | undefined;
  appName: string;
  userName: string;
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

  // Restore selection among active vehicles using database defaultVehicleId preference
  useEffect(() => {
    if (vehicles.length === 0) return;
    const ids = activeVehicles.map((v) => v._id);
    if (
      selectedVehicleId &&
      (selectedVehicleId === ALL_VEHICLES || ids.includes(selectedVehicleId))
    ) {
      return;
    }

    const next =
      settings?.defaultVehicleId && ids.includes(settings.defaultVehicleId)
        ? settings.defaultVehicleId
        : ids[0];
    setSelected(next ?? "");
  }, [vehicles, activeVehicles, settings?.defaultVehicleId, selectedVehicleId]);

  const setSelectedVehicleId = (id: string) => {
    setSelected(id);
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
      userName: settings?.fullName || "",
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
