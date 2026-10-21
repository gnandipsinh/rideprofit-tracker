import { Link } from "@tanstack/react-router";
import { ArrowRight, CreditCard, ShieldCheck, Clock } from "lucide-react";

export function CtaBanner() {
  return (
    <section className="relative py-16 lg:py-24 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-[#040a16] via-[#091528] to-[#040914] p-6 sm:p-10 lg:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
          {/* Subtle neon background accents */}
          <div
            className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-cyan-500/20 blur-[100px]"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-purple-600/20 blur-[100px]"
            aria-hidden="true"
          />

          <div className="grid items-center gap-8 lg:grid-cols-12">
            {/* Left Column: Truck Visual Asset */}
            <div className="lg:col-span-5 relative">
              <div className="overflow-hidden rounded-2xl border border-cyan-500/20 shadow-2xl bg-slate-950">
                <img
                  src="/assets/landing/cta-truck.png"
                  alt="Modern Heavy Fleet Truck on Highway"
                  referrerPolicy="no-referrer"
                  className="w-full h-48 sm:h-56 object-cover object-center"
                />
              </div>
            </div>

            {/* Right Column: Copy, Action Buttons & Perks */}
            <div className="lg:col-span-7 flex flex-col justify-center">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight">
                Ready to Manage Your Fleet Smarter?
              </h2>

              <p className="mt-3 text-sm sm:text-base text-slate-300">
                Join hundreds of transport operators who trust RideProfit Tracker.
              </p>

              {/* Action Buttons */}
              <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <Link
                  to="/auth"
                  search={{ mode: "register" }}
                  className="landing-btn-primary group flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-sm sm:text-base font-bold"
                >
                  <span>Get Started Free</span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
                <Link
                  to="/auth"
                  className="landing-btn-glass flex items-center justify-center rounded-xl px-7 py-3.5 text-sm sm:text-base font-bold text-slate-200"
                >
                  Login to Account
                </Link>
              </div>

              {/* Perks List */}
              <div className="mt-8 flex flex-wrap items-center gap-5 sm:gap-8 text-xs sm:text-sm font-semibold text-slate-300 border-t border-slate-800/80 pt-5">
                <span className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-cyan-400" />
                  No Credit Card Required
                </span>
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-cyan-400" />
                  Secure & Private
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-cyan-400" />
                  Start in Minutes
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
