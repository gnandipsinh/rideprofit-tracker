import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Truck,
  Route as RouteIcon,
  FileText,
  Settings as SettingsIcon,
  PlugZap,
  X,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PWAInstallButton } from "@/components/PWAInstallButton";
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
  showAddTrip: _showAddTrip,
}: {
  children: ReactNode;
  showAddTrip?: boolean;
}) {
  const { appName } = useApp();
  const health = useHealth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
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
      await navigate({ to: "/landing", replace: true });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col md:pb-10"
      style={{
        paddingBottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <header
        className="sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur-xl"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        <div className="app-container grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 py-2.5 sm:py-3 md:py-4">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div className="grid h-10 w-10 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-2xl bg-cyan-500/15 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.35)] ring-1 ring-cyan-400/35">
              <Truck className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm sm:text-base md:text-xl font-extrabold leading-tight text-white flex items-center">
                RideProfit
                <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
              </h1>
              <p className="truncate text-[0.62rem] sm:text-[0.65rem] font-bold uppercase tracking-[0.24em] sm:tracking-[0.28em] text-cyan-400/90 -mt-0.5">
                Tracker
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <nav className="hidden shrink-0 items-center gap-1 md:flex rounded-full border border-slate-800/80 bg-slate-900/60 p-1 backdrop-blur-md">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  preload="intent"
                  className={cn(
                    "tap-scale rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all duration-200",
                    pathname === item.to
                      ? "bg-gradient-to-r from-purple-600/30 to-cyan-500/30 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400/40"
                      : "text-slate-400 hover:bg-slate-800/60 hover:text-white",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <PWAInstallButton />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={signingOut}
              onClick={handleSignOut}
              className="tap-scale gap-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
      </header>

      {offline && !dismissed ? (
        <div className="app-container pt-3 sm:pt-4">
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
              className="ml-auto text-muted-foreground hover:text-foreground"
              aria-label="Dismiss warning"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      <main className="app-container flex-1 py-4 sm:py-6">{children}</main>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/80 bg-background/95 backdrop-blur-xl md:hidden"
        style={{
          paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="app-container grid grid-cols-5 gap-1 py-1.5">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                preload="intent"
                className={cn(
                  "tap-scale flex flex-col items-center justify-center gap-1 rounded-2xl py-1.5 text-center transition-all duration-200",
                  active
                    ? "bg-cyan-500/15 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400/40"
                    : "text-slate-400 hover:text-white",
                )}
              >
                <Icon className={cn("h-4 w-4", active && "scale-110")} />
                <span className="truncate text-[0.62rem] font-bold tracking-tight">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
