import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Zap, Sparkles, ArrowRight } from "lucide-react";

export function PricingSection() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const plans = [
    {
      name: "Free Starter",
      badge: "Get Started",
      description: "Ideal for single truck owners and owner-operators getting started.",
      price: "₹0",
      period: "forever",
      highlighted: false,
      features: [
        "Up to 3 Vehicles",
        "Unlimited Trip Profit Records",
        "Diesel & Toll Expense Tracking",
        "Mobile App / PWA Support",
        "Local Offline Sync",
      ],
      ctaText: "Start Free",
      ctaTo: "/auth",
    },
    {
      name: "Fleet Pro",
      badge: "Most Popular",
      description: "For transport operators running growing vehicle fleets.",
      price: billingCycle === "monthly" ? "₹499" : "₹399",
      period: "/ month",
      yearlyNote: billingCycle === "yearly" ? "Billed annually (Save 20%)" : undefined,
      highlighted: true,
      features: [
        "Unlimited Heavy Vehicles",
        "Real-Time Net Profit Analytics",
        "Itemized Expenses & Maintenance",
        "One-Click PDF Summary Reports",
        "Multi-Device Cloud Backup",
        "24/7 Priority Support",
      ],
      ctaText: "Start 14-Day Free Trial",
      ctaTo: "/auth",
    },
    {
      name: "Enterprise",
      badge: "Custom Scale",
      description: "Tailored for logistics companies with large truck fleets.",
      price: "Custom",
      period: "",
      highlighted: false,
      features: [
        "Unlimited Multi-Branch Fleets",
        "Driver & Dispatcher Roles",
        "Custom CA / Accountant Exports",
        "Dedicated Account Manager",
        "Custom API Integrations",
      ],
      ctaText: "Contact Us",
      ctaTo: "/auth",
    },
  ];

  return (
    <section id="pricing" className="relative py-20 lg:py-28 overflow-hidden scroll-mt-24">
      {/* Ambient background glow */}
      <div
        className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-cyan-600/10 blur-[140px]"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <div className="text-left sm:text-center max-w-3xl mx-auto mb-14">
          <div className="inline-block mb-4">
            <span className="landing-pill-badge">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              PRICING PLANS
            </span>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl leading-tight">
            Simple, Transparent <span className="landing-gradient-text">Pricing</span>
          </h2>

          <p className="mt-4 text-base sm:text-lg text-slate-300">
            No surprise fees. Start for free and upgrade as your transport business grows.
          </p>

          {/* Monthly / Yearly Toggle */}
          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 p-1.5 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={`rounded-full px-5 py-2 text-xs sm:text-sm font-bold transition-all ${
                billingCycle === "monthly"
                  ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("yearly")}
              className={`flex items-center gap-1.5 rounded-full px-5 py-2 text-xs sm:text-sm font-bold transition-all ${
                billingCycle === "yearly"
                  ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>Yearly</span>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[0.65rem] font-extrabold text-emerald-400 border border-emerald-500/30">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* 3 Pricing Cards */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3 max-w-6xl mx-auto items-stretch">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col justify-between rounded-3xl p-7 transition-all duration-300 ${
                plan.highlighted
                  ? "bg-gradient-to-b from-[#071328] to-[#040916] border-2 border-cyan-400/50 shadow-[0_0_40px_rgba(6,182,212,0.25)] md:-translate-y-2"
                  : "bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 backdrop-blur-md"
              }`}
            >
              {plan.highlighted ? (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-1 text-xs font-extrabold text-white shadow-lg">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>MOST POPULAR</span>
                </div>
              ) : null}

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xl font-extrabold text-white">{plan.name}</h3>
                  <span className="text-[0.68rem] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20">
                    {plan.badge}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-400 mb-6 leading-relaxed">
                  {plan.description}
                </p>

                <div className="mb-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white tracking-tight">
                    {plan.price}
                  </span>
                  {plan.period ? (
                    <span className="text-sm font-semibold text-slate-400">{plan.period}</span>
                  ) : null}
                </div>
                {plan.yearlyNote ? (
                  <p className="text-xs text-emerald-400 font-semibold -mt-4 mb-5">
                    {plan.yearlyNote}
                  </p>
                ) : null}

                {/* Features List */}
                <div className="space-y-3 border-t border-slate-800/80 pt-6 mb-8">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Included Features:
                  </p>
                  {plan.features.map((feat) => (
                    <div
                      key={feat}
                      className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200"
                    >
                      <div className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan-500/15 text-cyan-400">
                        <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                      </div>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Link
                to={plan.ctaTo}
                search={{ mode: "register" }}
                className={`group flex items-center justify-center gap-2 rounded-2xl py-3.5 px-6 text-sm font-bold transition-all ${
                  plan.highlighted
                    ? "landing-btn-primary"
                    : "landing-btn-glass text-white hover:text-cyan-300"
                }`}
              >
                <span>{plan.ctaText}</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
