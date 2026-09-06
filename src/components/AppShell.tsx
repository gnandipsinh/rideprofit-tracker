import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, Truck, Route as RouteIcon, FileText, Settings as SettingsIcon, Plus, PlugZap, X, LogOut } from "lucide-react";
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

export function AppShell({ children, showAddTrip = true }: { children: ReactNode; showAddTrip?: boolean }) {
  const { appName, vehicles } = useApp();
  const health = useHealth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [tripOpen, setTripOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const offline = health.isError;

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
              <Truck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold leading-tight sm:text-lg">{appName}</h1>
              <p className="truncate text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-primary/80">
                Fleet Accounting
              </p>
            </div>
          </div>
          <nav className="hidden shrink-0 items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "tap-scale rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                  pathname === item.to && "bg-primary/15 text-primary",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="h-px w-full gold-rule opacity-30" />
      </header>

      {offline && !dismissed ? (
        <div className="mx-auto max-w-5xl px-4 pt-4">
          <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-secondary/40 p-3">
            <PlugZap className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 text-xs text-foreground/90">
              <p className="font-semibold">Backend not connected yet</p>
              <p className="mt-0.5 text-muted-foreground">
                Add your deployed Express API URL in Settings → Backend Connection, or run the server in{" "}
                <span className="font-mono">/server</span> with <span className="font-mono">npm run dev</span>.
              </p>
              <Link to="/settings" className="mt-1.5 inline-block font-semibold text-primary underline">
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


      <main className="mx-auto max-w-5xl px-4 py-4">{children}</main>

      {showAddTrip && vehicles.length > 0 ? (
        <>
          <Button
            onClick={() => setTripOpen(true)}
            className="fixed bottom-24 right-4 z-30 h-14 rounded-full px-5 text-sm font-bold shadow-[var(--shadow-gold)] md:bottom-8"
          >
            <Plus className="mr-1.5 h-5 w-5" /> Add Trip
          </Button>
          <TripFormDialog open={tripOpen} onOpenChange={setTripOpen} />
        </>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-5xl grid-cols-5">
          {NAV.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-h-[4rem] flex-col items-center justify-center gap-1 px-1 py-2 text-[0.65rem] font-semibold tap-scale active:scale-95",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
