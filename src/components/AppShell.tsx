import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Truck,
  Route as RouteIcon,
  FileText,
  Settings as SettingsIcon,
  Plus,
  PlugZap,
  X,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TripFormDialog } from "@/components/TripFormDialog";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { useHealth } from "@/lib/queries";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/vehicles", label: "Vehicles", icon: Truck },
  { to: "/trips", label: "Trips", icon: RouteIcon },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function AppShell({
  children,
  showAddTrip = true,
}: {
  children: ReactNode;
  showAddTrip?: boolean;
}) {
  const { appName, activeVehicles } = useApp();
  const health = useHealth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [tripOpen, setTripOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const offline = health.isError;

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
      if (typeof window !== "undefined") window.localStorage.removeItem("vcs.selectedVehicleId");
      await navigate({ to: "/auth", replace: true });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen pb-24 pb-[env(safe-area-inset-bottom)] md:pb-8">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/86 backdrop-blur-xl">
        <div className="app-container grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 md:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary shadow-[var(--shadow-gold)] ring-1 ring-primary/35">
              <Truck className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-extrabold leading-tight sm:text-lg md:text-xl">
                {appName}
              </h1>
              <p className="truncate text-[0.65rem] font-bold uppercase tracking-[0.28em] text-primary/85">
                Fleet Accounting
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <nav className="hidden shrink-0 items-center gap-1 md:flex">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "tap-scale rounded-xl border border-transparent px-3 py-2 text-sm font-semibold text-muted-foreground hover:border-border/80 hover:bg-secondary/70 hover:text-foreground lg:px-4",
                    pathname === item.to &&
                      "border-primary/35 bg-primary/15 text-primary shadow-[var(--shadow-gold)]",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={signingOut}
              onClick={handleSignOut}
              className="tap-scale gap-1.5 rounded-xl text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
        <div className="h-px w-full gold-rule opacity-30" />
      </header>

      {offline && !dismissed ? (
        <div className="app-container pt-4">
          <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-secondary/40 p-3">
            <PlugZap className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 text-xs text-foreground/90">
              <p className="font-semibold">Backend not connected yet</p>
              <p className="mt-0.5 text-muted-foreground">
                Add your deployed Express API URL in Settings → Backend Connection, or run the
                server in <span className="font-mono">/server</span> with{" "}
                <span className="font-mono">npm run dev</span>.
              </p>
              <Link
                to="/settings"
                className="mt-1.5 inline-block font-semibold text-primary underline"
              >
                Configure backend
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss"
              className="ml-auto shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      <main className="app-container py-4 md:py-6">{children}</main>

      {showAddTrip && activeVehicles.length > 0 ? (
        <>
          <Button
            onClick={() => setTripOpen(true)}
            className="fixed bottom-24 right-4 z-30 h-14 rounded-full px-5 text-sm font-bold shadow-[var(--shadow-gold)] md:bottom-8 md:right-8 pb-1"
          >
            <Plus className="mr-1.5 h-5 w-5" /> Add Trip
          </Button>
          <TripFormDialog open={tripOpen} onOpenChange={setTripOpen} />
        </>
      ) : null}

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 shadow-[0_-18px_40px_-28px_#39c9ff] backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-h-[4.15rem] flex-col items-center justify-center gap-1 px-1 py-2 text-[0.65rem] font-semibold tap-scale active:scale-95",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-xl border border-transparent",
                    active && "border-primary/30 bg-primary/15 shadow-[var(--shadow-gold)]",
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
