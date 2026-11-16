import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  HardDrive,
  IndianRupee,
  Route as RouteIcon,
  Truck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function HeroSection() {
  const navigate = useNavigate();
  const [deviceLoading, setDeviceLoading] = useState(false);

  const handleDeviceStart = async () => {
    setDeviceLoading(true);
    try {
      const { error } = await supabase.auth.signInAsDemo();
      if (error) {
        toast.error(error.message || "Failed to open workspace");
        return;
      }
      toast.success("Workspace opened. All your vehicles and trips stay saved here.");
      await navigate({ to: "/" });
    } catch {
      toast.error("Could not start workspace.");
    } finally {
      setDeviceLoading(false);
    }
  };

  return (
    <section id="home" className="relative pt-12 pb-16 lg:pt-16 lg:pb-24 scroll-mt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-12">
          <div className="lg:col-span-6 text-left">
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl leading-[1.15]">
              Simple Vehicle &amp; <span className="text-cyan-400">Trip Profit Tracker</span>
            </h1>

            <p className="mt-4 text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
              Record daily trips, diesel, driver payments, and vehicle expenses — see your real net
              profit in seconds without complicated setup.
            </p>

            <div className="mt-6 space-y-2.5">
              {[
                "Vehicle-wise trip & diesel entry",
                "Automatic net profit calculation",
                "PDF statements & WhatsApp sharing",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2.5 text-sm sm:text-base font-medium text-slate-200"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-400" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                type="button"
                onClick={handleDeviceStart}
                disabled={deviceLoading}
                className="flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-6 py-3.5 text-sm sm:text-base font-bold text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer disabled:opacity-60"
              >
                <HardDrive className="h-4 w-4" />
                <span>{deviceLoading ? "Opening..." : "Open App (Save on Device)"}</span>
              </button>

              <Link
                to="/auth"
                className="flex items-center justify-center gap-2 rounded-xl border border-[#1C2B44] bg-[#10192A] px-6 py-3.5 text-sm sm:text-base font-bold text-white hover:bg-[#172844] transition-colors"
              >
                <span>Sign In with Google</span>
                <ArrowRight className="h-4 w-4 text-cyan-400" />
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="rounded-2xl border border-[#1C2B44] bg-[#10192A] p-4 sm:p-5 shadow-xl">
              <div className="mb-4 h-48 sm:h-56 w-full overflow-hidden rounded-xl border border-[#1C2B44] bg-[#080D18]">
                <img
                  src="/assets/landing/hero-showcase.png"
                  alt="RideProfit Fleet Trucks"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover object-left"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="rounded-xl border border-[#1C2B44] bg-[#080D18] p-3">
                  <div className="flex items-center justify-center gap-1 text-[0.68rem] font-semibold text-slate-400 uppercase">
                    <Truck className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Vehicles</span>
                  </div>
                  <p className="mt-1 text-sm sm:text-base font-bold text-white">Multi-Fleet</p>
                </div>
                <div className="rounded-xl border border-[#1C2B44] bg-[#080D18] p-3">
                  <div className="flex items-center justify-center gap-1 text-[0.68rem] font-semibold text-slate-400 uppercase">
                    <RouteIcon className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Trips</span>
                  </div>
                  <p className="mt-1 text-sm sm:text-base font-bold text-white">Daily Hisab</p>
                </div>
                <div className="rounded-xl border border-[#1C2B44] bg-[#080D18] p-3">
                  <div className="flex items-center justify-center gap-1 text-[0.68rem] font-semibold text-slate-400 uppercase">
                    <IndianRupee className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Reports</span>
                  </div>
                  <p className="mt-1 text-sm sm:text-base font-bold text-emerald-400">
                    PDF &amp; WA
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
