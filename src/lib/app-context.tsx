import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSettings, useVehicles } from "./queries";
import { currencySymbol } from "./format";
import { ALL_VEHICLES, type AppSettings, type Vehicle } from "./types";

interface AppContextValue {
  vehicles: Vehicle[];
  activeVehicles: Vehicle[];
  vehiclesLoading: boolean;
  vehiclesError: Error | null;
  refetchVehicles: () => Promise<unknown>;
  settings: AppSettings | undefined;
  appName: string;
  userName: string;
  sessionEmail: string;
  isDemo: boolean;
  symbol: string;
  selectedVehicleId: string;
  setSelectedVehicleId: (id: string) => void;
  selectedVehicle: Vehicle | null;
  selectedLabel: string;
  isAllVehicles: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

import { supabase } from "@/integrations/supabase/client";

export function AppProvider({ children }: { children: ReactNode }) {
  const [hasSession, setHasSession] = useState<boolean>(false);
  const [sessionEmail, setSessionEmail] = useState<string>("");
  const [sessionName, setSessionName] = useState<string>("");
  const [isDemo, setIsDemo] = useState<boolean>(false);

  const [selectedVehicleId, setSelected] = useState<string>("");

  useEffect(() => {
    let active = true;
    const syncSession = (
      session: {
        access_token?: string;
        user?: {
          email?: string;
          fullName?: string;
          app_metadata?: Record<string, unknown>;
          user_metadata?: Record<string, unknown>;
        };
      } | null,
    ) => {
      const authed = Boolean(session?.access_token);
      setHasSession(authed);
      setSessionEmail(session?.user?.email ?? "");
      setSessionName(
        session?.user?.fullName ||
          (typeof session?.user?.user_metadata?.["full_name"] === "string"
            ? session.user.user_metadata["full_name"]
            : ""),
      );
      setIsDemo(
        session?.user?.app_metadata?.["provider"] === "demo" ||
          Boolean(session?.user?.user_metadata?.["is_demo"]),
      );
      if (!authed) setSelected("");
    };

    void supabase.auth
      .getSession()
      .then((res) => {
        if (!active) return;
        syncSession(res.data?.session ?? null);
      })
      .catch(() => undefined);

    const { data } = supabase.auth.onAuthStateChange(
      (
        _event: string,
        session: {
          access_token?: string;
          user?: {
            email?: string;
            fullName?: string;
            app_metadata?: Record<string, unknown>;
            user_metadata?: Record<string, unknown>;
          };
        } | null,
      ) => {
        syncSession(session);
      },
    );
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const vehiclesQuery = useVehicles(hasSession);
  const settingsQuery = useSettings(hasSession);

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

  const refetchVehiclesFn = vehiclesQuery.refetch;

  const value = useMemo<AppContextValue>(() => {
    const selectedVehicle = activeVehicles.find((v) => v._id === selectedVehicleId) ?? null;
    const isAllVehicles = selectedVehicleId === ALL_VEHICLES;
    const fallbackEmailName = sessionEmail ? (sessionEmail.split("@")[0] ?? "") : "";
    const resolvedName = settings?.fullName || sessionName || fallbackEmailName;

    return {
      vehicles,
      activeVehicles,
      vehiclesLoading: vehiclesQuery.isLoading,
      vehiclesError: (vehiclesQuery.error as Error | null) ?? null,
      refetchVehicles: () => refetchVehiclesFn(),
      settings,
      appName: settings?.transportationName || settings?.appName || "Vehicle Calculation System",
      userName: resolvedName,
      sessionEmail,
      isDemo,
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
    sessionName,
    sessionEmail,
    isDemo,
    selectedVehicleId,
    vehiclesQuery.isLoading,
    vehiclesQuery.error,
    refetchVehiclesFn,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
