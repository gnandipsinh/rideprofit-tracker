import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Truck,
  Route as RouteIcon,
  Receipt,
  FileText,
  TrendingUp,
  Settings as SettingsIcon,
  PlugZap,
  X,
  LogOut,
  Menu,
  Bell,
  User,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PWAInstallButton } from "@/components/PWAInstallButton";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { useHealth } from "@/lib/queries";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  matchPrefix?: boolean;
}

const SIDEBAR_NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/vehicles", label: "Vehicles", icon: Truck },
  { to: "/trips", label: "Trips", icon: RouteIcon },
  { to: "/trips?tab=expenses", label: "Expenses", icon: Receipt },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/reports?tab=profit", label: "Profit", icon: TrendingUp },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

const MOBILE_BOTTOM_NAV = [
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
  const { appName, userName, isDemo, settings } = useApp();
  const health = useHealth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const offline = health.isError || health.data?.status === "error";

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("vcs.selectedVehicleId");
      }
      await navigate({ to: "/landing", replace: true });
    } finally {
      setSigningOut(false);
    }
  }

  // Determine current active page label and subtitle for desktop header
  function getPageHeader() {
    if (pathname === "/vehicles") {
      return { title: "Vehicles", subtitle: "Manage and monitor your transport fleet" };
    }
    if (pathname === "/trips") {
      if (searchStr?.includes("tab=expenses")) {
        return {
          title: "Fleet Expenses",
          subtitle: "Track diesel, driver payments and other expenses",
        };
      }
      return { title: "Trips & Routes", subtitle: "Log daily vehicle trips, mileage and revenue" };
    }
    if (pathname === "/reports") {
      if (searchStr?.includes("tab=profit")) {
        return { title: "Profit Analysis", subtitle: "Net margins, revenue vs operating expenses" };
      }
      return {
        title: "Reports & Statement",
        subtitle: "Vehicle calculation reports and accounting statements",
      };
    }
    if (pathname === "/settings") {
      return { title: "Settings", subtitle: "Manage profile, company details and preferences" };
    }
    return { title: "Dashboard", subtitle: "Overview of your transport business" };
  }

  const { title, subtitle } = getPageHeader();

  const isNavActive = (item: NavItem) => {
    if (item.to.includes("?")) {
      const [path, query] = item.to.split("?");
      return Boolean(query && pathname === path && searchStr?.includes(query));
    }
    if (item.to === "/") {
      return pathname === "/";
    }
    // Don't mark trips active if we're on expenses tab
    if (item.to === "/trips" && searchStr?.includes("tab=expenses")) {
      return false;
    }
    if (item.to === "/reports" && searchStr?.includes("tab=profit")) {
      return false;
    }
    return pathname.startsWith(item.to);
  };

  return (
    <div className="min-h-screen bg-[#0B111E] text-slate-100 flex">
      {/* 1. Desktop Fixed Left Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 left-0 z-30 bg-[#080D18] border-r border-[#162238]">
        {/* Brand Lockup */}
        <div className="h-20 flex items-center gap-3 px-6 border-b border-[#162238]/80">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-400/30 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
            <Truck className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <span className="block text-base font-black tracking-tight text-white leading-tight">
              RideProfit
            </span>
            <span className="block text-[0.68rem] font-bold tracking-[0.2em] text-cyan-400 uppercase -mt-0.5">
              Tracker
            </span>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto no-scrollbar">
          {SIDEBAR_NAV.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(item);
            return (
              <Link
                key={item.to}
                to={item.to}
                preload="intent"
                className={cn(
                  "flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150",
                  active
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20"
                    : "text-slate-400 hover:text-white hover:bg-[#10192A]/80",
                )}
              >
                <Icon
                  className={cn("h-5 w-5 shrink-0", active ? "text-slate-950" : "text-slate-400")}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Fleet Promo Card at bottom of sidebar */}
        <div className="p-4 border-t border-[#162238]">
          <div className="rounded-2xl border border-cyan-500/25 bg-gradient-to-b from-[#10192A] to-[#0D1524] p-3.5 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-2">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-cyan-500/20 text-cyan-400">
                <ShieldCheck className="h-3.5 w-3.5" />
              </span>
              <span className="text-[0.68rem] font-bold uppercase tracking-wider text-cyan-400">
                Fleet Pro
              </span>
            </div>
            <p className="text-xs font-bold text-white leading-snug">
              Manage Your Fleet More Efficiently
            </p>
            <p className="text-[0.7rem] text-slate-400 mt-1">
              Live profit margins, automated WhatsApp summaries & PDF statements.
            </p>
          </div>
        </div>
      </aside>

      {/* 2. Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64 pb-20 md:pb-12">
        {/* Desktop Header */}
        <header className="hidden lg:flex h-20 items-center justify-between px-8 border-b border-[#162238] bg-[#080D18]/90 backdrop-blur-md sticky top-0 z-20">
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">{title}</h1>
            <p className="text-xs text-slate-400 font-medium">{subtitle}</p>
          </div>

          <div className="flex items-center gap-3">
            <PWAInstallButton />

            {/* Notification button */}
            <div
              className="grid h-10 w-10 place-items-center rounded-xl border border-[#1C2B44] bg-[#10192A] text-slate-400 hover:text-white hover:border-cyan-500/40 transition-colors cursor-pointer"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
            </div>

            {/* User Profile Pill - Links to Settings */}
            <Link
              to="/settings"
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-[#1C2B44] bg-[#10192A] hover:border-cyan-500/40 hover:bg-[#132137] transition-all group"
              title="Profile & Settings"
            >
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-500/15 text-cyan-400 font-bold text-xs ring-1 ring-cyan-500/20 group-hover:ring-cyan-500/40 transition-all">
                {(userName || "Fleet Operator").charAt(0).toUpperCase()}
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-white leading-tight truncate max-w-[140px] group-hover:text-cyan-300 transition-colors">
                  {userName || (isDemo ? "Demo Operator" : "Fleet Operator")}
                </p>
                <p className="text-[0.65rem] text-cyan-400/90 font-semibold tracking-wide">
                  {isDemo ? "Demo Mode" : settings?.userRole || "Super Admin"}
                </p>
              </div>
            </Link>

            {/* Sign Out */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={signingOut}
              onClick={handleSignOut}
              className="h-10 px-3 rounded-xl text-slate-400 hover:text-white hover:bg-[#10192A] border border-transparent hover:border-[#1C2B44]"
            >
              <LogOut className="h-4 w-4 mr-1.5" />
              <span>Sign out</span>
            </Button>
          </div>
        </header>

        {/* Mobile Top Header */}
        <header className="lg:hidden sticky top-0 z-20 flex h-16 items-center justify-between px-4 border-b border-[#162238] bg-[#080D18]/95 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-xl border border-[#1C2B44] bg-[#10192A] text-slate-200"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-500/20 text-cyan-400">
                <Truck className="h-4 w-4" />
              </div>
              <div>
                <span className="text-sm font-black text-white leading-none block">RideProfit</span>
                <span className="text-[0.62rem] font-bold uppercase tracking-wider text-cyan-400 block">
                  Tracker
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <PWAInstallButton />
            <button
              type="button"
              disabled={signingOut}
              onClick={handleSignOut}
              className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:text-white"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Offline Banner if any */}
        {offline && !dismissed ? (
          <div className="p-4">
            <div className="flex items-start gap-3 rounded-2xl border border-cyan-500/30 bg-[#10192A] p-3 text-xs">
              <PlugZap className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-white">Database in Offline Mode</p>
                <p className="mt-0.5 text-slate-400">
                  Data operations are buffered. Configure your live backend in Settings.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>

      {/* 3. Mobile Navigation Drawer Sheet */}
      {mobileDrawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Drawer content */}
          <div className="fixed inset-y-0 left-0 w-72 bg-[#080D18] border-r border-[#162238] p-5 flex flex-col z-10 shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between pb-5 border-b border-[#162238]">
              <div className="flex items-center gap-2.5">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-500/20 text-cyan-400">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-base font-black text-white leading-tight block">
                    RideProfit
                  </span>
                  <span className="text-[0.68rem] font-bold uppercase tracking-wider text-cyan-400 block">
                    Tracker
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:text-white bg-[#10192A]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* User Profile in Mobile Drawer */}
            <Link
              to="/settings"
              onClick={() => setMobileDrawerOpen(false)}
              className="flex items-center gap-3 p-3 my-3 rounded-xl border border-[#1C2B44] bg-[#10192A] hover:border-cyan-500/40 transition-colors"
            >
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-cyan-500/20 text-cyan-400 font-bold text-sm">
                {(userName || "Fleet Operator").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">
                  {userName || (isDemo ? "Demo Operator" : "Fleet Operator")}
                </p>
                <p className="text-[0.68rem] text-cyan-400 font-semibold">
                  {isDemo ? "Demo Mode" : settings?.userRole || "Super Admin"}
                </p>
              </div>
            </Link>

            <nav className="flex-1 py-2 space-y-1.5 overflow-y-auto">
              {SIDEBAR_NAV.map((item) => {
                const Icon = item.icon;
                const active = isNavActive(item);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    preload="intent"
                    onClick={() => setMobileDrawerOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors",
                      active
                        ? "bg-cyan-500 text-slate-950 font-bold"
                        : "text-slate-400 hover:text-white hover:bg-[#10192A]",
                    )}
                  >
                    <Icon className={cn("h-4 w-4", active ? "text-slate-950" : "text-slate-400")} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="pt-4 border-t border-[#162238] space-y-3">
              <div className="rounded-xl border border-cyan-500/20 bg-[#10192A] p-3">
                <p className="text-xs font-bold text-white">Manage Your Fleet More Efficiently</p>
                <p className="text-[0.68rem] text-slate-400 mt-1">RideProfit Transport System</p>
              </div>

              <Button
                type="button"
                variant="destructive"
                className="w-full justify-start rounded-xl text-xs font-semibold"
                onClick={() => {
                  setMobileDrawerOpen(false);
                  void handleSignOut();
                }}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 4. Mobile Bottom Nav Bar */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#162238] bg-[#080D18]/95 backdrop-blur-xl lg:hidden"
        style={{
          paddingBottom: "max(0.4rem, env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="grid grid-cols-5 gap-1 px-2 py-1.5">
          {MOBILE_BOTTOM_NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                preload="intent"
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-xl py-1 text-center transition-all",
                  active ? "text-cyan-400 font-bold" : "text-slate-400 hover:text-white",
                )}
              >
                <div
                  className={cn(
                    "p-1 rounded-lg transition-colors",
                    active && "bg-cyan-500/15 ring-1 ring-cyan-400/30",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span className="truncate text-[0.62rem] tracking-tight">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
