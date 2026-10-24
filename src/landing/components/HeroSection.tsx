import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Zap,
  ShieldCheck,
  TrendingUp,
  Truck,
  IndianRupee,
  Route as RouteIcon,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function HeroSection() {
  const navigate = useNavigate();
  const [demoLoading, setDemoLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("This Month");
  const [monthMenuOpen, setMonthMenuOpen] = useState(false);

  type PresetData = {
    profit: string;
    trips: number;
    income: string;
    expense: string;
    bars: { month: string; height: string; active?: boolean }[];
  };

  const defaultMonthData: PresetData = {
    profit: "₹2,48,500",
    trips: 48,
    income: "₹5,20,000",
    expense: "₹2,71,500",
    bars: [
      { month: "Jan", height: "45%" },
      { month: "Feb", height: "60%" },
      { month: "Mar", height: "55%" },
      { month: "Apr", height: "70%" },
      { month: "May", height: "90%", active: true },
      { month: "Jun", height: "65%" },
    ],
  };

  const monthPresets: Record<string, PresetData> = {
    "This Month": defaultMonthData,
    "Last Month": {
      profit: "₹2,21,800",
      trips: 44,
      income: "₹4,85,000",
      expense: "₹2,63,200",
      bars: [
        { month: "Jan", height: "45%" },
        { month: "Feb", height: "60%" },
        { month: "Mar", height: "55%" },
        { month: "Apr", height: "85%", active: true },
        { month: "May", height: "65%" },
        { month: "Jun", height: "50%" },
      ],
    },
    "Last 3 Months": {
      profit: "₹6,90,300",
      trips: 138,
      income: "₹14,80,000",
      expense: "₹7,89,700",
      bars: [
        { month: "Jan", height: "50%" },
        { month: "Feb", height: "55%" },
        { month: "Mar", height: "75%", active: true },
        { month: "Apr", height: "80%", active: true },
        { month: "May", height: "95%", active: true },
        { month: "Jun", height: "60%" },
      ],
    },
  };

  const currentData: PresetData = monthPresets[selectedMonth] ?? defaultMonthData;

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    try {
      const { error } = await supabase.auth.signInAsDemo();
      if (error) {
        toast.error(error.message || "Failed to load demo account");
        return;
      }
      toast.success("Welcome to Demo Mode! Exploring Express Logistics Fleet.");
      await navigate({ to: "/" });
    } catch {
      toast.error("An error occurred starting demo account.");
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <section
      id="home"
      className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 scroll-mt-24"
    >
      {/* Background glow effects */}
      <div
        className="pointer-events-none absolute -top-40 left-1/4 h-[550px] w-[550px] -translate-x-1/2 rounded-full bg-cyan-600/15 blur-[120px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-10 right-10 h-[500px] w-[500px] rounded-full bg-purple-600/15 blur-[140px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-20 left-1/2 h-[350px] w-[700px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-[130px]"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
          {/* Left Column: Headline, Copy & CTAs */}
          <div className="lg:col-span-6 xl:col-span-5 text-left">
            {/* Pill Badge */}
            <div className="inline-block mb-6">
              <span className="landing-pill-badge">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                VEHICLE MANAGEMENT SYSTEM
              </span>
            </div>

            {/* Display Headline */}
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.12]">
              Track Your Vehicles.{" "}
              <span className="block mt-1 landing-gradient-text">Calculate Real Profit.</span>
            </h1>

            {/* Subtitle */}
            <p className="mt-5 text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
              Manage vehicles, trips, income, expenses and get real profit insights — all in one
              simple and powerful platform for transport business.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
              <Link
                to="/auth"
                search={{ mode: "register" }}
                className="landing-btn-primary group flex items-center justify-center gap-2.5 rounded-2xl px-6 py-4 text-base font-bold shadow-[0_0_25px_rgba(6,182,212,0.4)]"
              >
                <span>Get Started Free</span>
                <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={demoLoading}
                className="landing-btn-glass flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-base font-bold text-cyan-300 hover:text-white border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-500/10 transition-all cursor-pointer disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4 text-cyan-400 animate-pulse" />
                <span>{demoLoading ? "Starting Demo…" : "Try Demo Account"}</span>
              </button>
            </div>

            {/* Trust highlights */}
            <div className="mt-10 pt-6 border-t border-slate-800/80 flex flex-wrap items-center gap-6 text-xs sm:text-sm font-semibold text-slate-300">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-cyan-500/15 text-cyan-400">
                  <Zap className="h-4 w-4" />
                </div>
                <span>Easy to Use</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-blue-500/15 text-blue-400">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <span>Secure Data</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-purple-500/15 text-purple-400">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <span>Real Profit Tracking</span>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Graphic (Night Electric Truck + Floating Realistic Dashboard) */}
          <div className="lg:col-span-6 xl:col-span-7 relative">
            <div className="relative mx-auto w-full max-w-2xl lg:max-w-none">
              {/* Decorative background glow behind dashboard */}
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-600/20 blur-2xl -z-10" />

              {/* Composition: Truck + Glass Dashboard Mockup */}
              <div className="relative rounded-3xl border border-cyan-500/20 bg-[#060e1b]/80 p-3 sm:p-5 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
                {/* Truck Visual Header Bar with dusk highway graphic */}
                <div className="relative mb-4 h-48 sm:h-64 w-full overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-[#0a1728] to-[#040913]">
                  <img
                    src="/assets/landing/hero-showcase.png"
                    alt="RideProfit Heavy Vehicle Fleet on Glowing Highway"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover object-left"
                  />
                  {/* Gradient overlay for seamless blending */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#060e1b] via-transparent to-transparent opacity-90" />
                  <div className="absolute bottom-3 left-4 flex items-center gap-2 text-xs font-semibold text-cyan-300 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-cyan-500/30 backdrop-blur-md">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                    <span>Real-Time Fleet Telemetry & Calculation</span>
                  </div>
                </div>

                {/* Realistic Dashboard Showcase Card */}
                <div className="landing-glass rounded-2xl p-4 sm:p-5 border border-cyan-500/20">
                  {/* Dashboard Top Header */}
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-500/20 text-cyan-400">
                        <Truck className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white leading-tight">RideProfit</p>
                        <p className="text-[0.62rem] font-medium text-cyan-400/80 uppercase tracking-wider">
                          Tracker Live
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[0.68rem] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        ● Live Sync
                      </span>
                    </div>
                  </div>

                  {/* Top 2 Stat KPI Cards */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {/* Total Profit Card */}
                    <div className="rounded-xl border border-cyan-500/20 bg-slate-900/70 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[0.68rem] font-semibold text-slate-400 uppercase tracking-wider">
                          Total Profit
                        </span>
                        <div className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-500/15 text-emerald-400">
                          <IndianRupee className="h-3 w-3" />
                        </div>
                      </div>
                      <p className="mt-1.5 text-lg sm:text-2xl font-extrabold text-white tabular-nums transition-all">
                        {currentData.profit}
                      </p>
                      <p className="mt-1 text-[0.68rem] font-bold text-emerald-400 flex items-center gap-0.5">
                        <span>↑ 12%</span>
                        <span className="text-slate-400 font-normal">from last month</span>
                      </p>
                    </div>

                    {/* Total Trips Card */}
                    <div className="rounded-xl border border-purple-500/20 bg-slate-900/70 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[0.68rem] font-semibold text-slate-400 uppercase tracking-wider">
                          Total Trips
                        </span>
                        <div className="grid h-6 w-6 place-items-center rounded-lg bg-purple-500/15 text-purple-400">
                          <RouteIcon className="h-3 w-3" />
                        </div>
                      </div>
                      <p className="mt-1.5 text-lg sm:text-2xl font-extrabold text-white tabular-nums transition-all">
                        {currentData.trips}
                      </p>
                      <p className="mt-1 text-[0.68rem] font-bold text-purple-400 flex items-center gap-0.5">
                        <span>↑ 8%</span>
                        <span className="text-slate-400 font-normal">from last month</span>
                      </p>
                    </div>
                  </div>

                  {/* Profit Overview Bar Chart Container */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 mb-4 relative">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-slate-200">Profit Overview</span>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setMonthMenuOpen(!monthMenuOpen)}
                          className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-[0.68rem] font-semibold text-cyan-400 hover:border-cyan-500/40 transition-colors"
                        >
                          <span>{selectedMonth}</span>
                          <ChevronDown
                            className={`h-3 w-3 transition-transform ${monthMenuOpen ? "rotate-180" : ""}`}
                          />
                        </button>

                        {/* Interactive Dropdown Menu */}
                        {monthMenuOpen ? (
                          <div className="absolute right-0 top-full mt-1.5 z-20 w-36 rounded-xl border border-cyan-500/30 bg-slate-900 p-1.5 shadow-2xl backdrop-blur-xl">
                            {Object.keys(monthPresets).map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => {
                                  setSelectedMonth(m);
                                  setMonthMenuOpen(false);
                                }}
                                className={`w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold transition-all ${
                                  selectedMonth === m
                                    ? "bg-cyan-500/20 text-cyan-300"
                                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                }`}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* Chart Bars (Jan - Jun) */}
                    <div className="flex items-end justify-between gap-2 h-24 pt-2 px-1">
                      {currentData.bars.map((b) => (
                        <div
                          key={b.month}
                          className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group"
                        >
                          <div
                            style={{ height: b.height }}
                            className={`w-full max-w-[28px] rounded-t-md transition-all duration-300 ${
                              b.active
                                ? "bg-gradient-to-t from-cyan-600 to-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.6)]"
                                : "bg-cyan-500/30 group-hover:bg-cyan-500/50"
                            }`}
                          />
                          <span
                            className={`text-[0.65rem] font-medium ${b.active ? "text-cyan-400 font-bold" : "text-slate-500"}`}
                          >
                            {b.month}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bottom Three KPI Breakdown Badges */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2">
                      <p className="text-[0.62rem] font-semibold text-slate-400 uppercase">
                        Total Income
                      </p>
                      <p className="mt-1 text-xs sm:text-sm font-bold text-white tabular-nums">
                        {currentData.income}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2">
                      <p className="text-[0.62rem] font-semibold text-slate-400 uppercase">
                        Total Expenses
                      </p>
                      <p className="mt-1 text-xs sm:text-sm font-bold text-rose-400 tabular-nums">
                        {currentData.expense}
                      </p>
                    </div>
                    <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/30 p-2">
                      <p className="text-[0.62rem] font-bold text-cyan-400 uppercase">Net Profit</p>
                      <p className="mt-1 text-xs sm:text-sm font-extrabold text-cyan-300 tabular-nums">
                        {currentData.profit}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
