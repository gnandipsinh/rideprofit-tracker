import { UserCheck, Truck, TrendingUp, ArrowRight } from "lucide-react";

export function HowItWorksSection() {
  const steps = [
    {
      step: 1,
      title: "Create Your Account",
      description: "Sign up in seconds and set up your business profile.",
      icon: UserCheck,
      badgeColor: "bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.6)]",
      iconColor: "text-blue-400 bg-blue-500/10",
    },
    {
      step: 2,
      title: "Add Vehicles & Trips",
      description: "Add your vehicles, record trips and track all details.",
      icon: Truck,
      badgeColor: "bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.6)]",
      iconColor: "text-cyan-400 bg-cyan-500/10",
    },
    {
      step: 3,
      title: "See Real Profit",
      description: "Get instant insights on income, expenses and net profit.",
      icon: TrendingUp,
      badgeColor: "bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.6)]",
      iconColor: "text-emerald-400 bg-emerald-500/10",
    },
  ];

  return (
    <section
      id="how-it-works"
      className="relative py-20 lg:py-28 overflow-hidden bg-[#02050c] scroll-mt-24"
    >
      {/* Background radial gradient */}
      <div
        className="pointer-events-none absolute bottom-0 left-1/3 h-[500px] w-[500px] rounded-full bg-cyan-600/10 blur-[130px]"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-left sm:text-center max-w-3xl mx-auto mb-16">
          <div className="inline-block mb-4">
            <span className="landing-pill-badge">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              HOW IT WORKS
            </span>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl leading-tight">
            Get Started in Just <span className="landing-gradient-text">3 Simple Steps</span>
          </h2>

          <p className="mt-4 text-base sm:text-lg text-slate-300">
            Start tracking your vehicle profit in minutes.
          </p>
        </div>

        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
          {/* Left Column: 3 Steps */}
          <div className="lg:col-span-5 space-y-8">
            {steps.map((item, index) => {
              const Icon = item.icon;
              const isLast = index === steps.length - 1;
              return (
                <div key={item.step} className="relative flex items-start gap-4">
                  {/* Step Number Badge & Icon */}
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-2">
                      <div
                        className={`grid h-10 w-10 place-items-center rounded-full text-sm font-extrabold ${item.badgeColor}`}
                      >
                        {item.step}
                      </div>
                      <div
                        className={`grid h-10 w-10 place-items-center rounded-2xl ${item.iconColor} border border-white/10`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                    {!isLast ? (
                      <div className="mt-3 h-14 w-0.5 bg-gradient-to-b from-cyan-500/40 to-transparent" />
                    ) : null}
                  </div>

                  {/* Step Info */}
                  <div className="pt-1">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <span>{item.title}</span>
                      {!isLast ? (
                        <ArrowRight className="h-4 w-4 text-cyan-400 hidden sm:inline" />
                      ) : null}
                    </h3>
                    <p className="mt-1 text-sm text-slate-300 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Device Mockups (Laptop + Smartphone) */}
          <div id="screenshots" className="lg:col-span-7 relative scroll-mt-24">
            <div className="relative mx-auto max-w-2xl rounded-3xl border border-cyan-500/20 bg-slate-900/40 p-4 sm:p-6 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              {/* Dual-device screenshot image extracted from user's reference */}
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#060c18]">
                <img
                  src="/assets/landing/devices-mockup.png"
                  alt="RideProfit Tracker Desktop Laptop and Mobile Phone App Mockup"
                  referrerPolicy="no-referrer"
                  className="w-full h-auto object-contain"
                />
              </div>

              {/* Live feature pill tags */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300 font-semibold px-2">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" /> Web & Mobile PWA
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" /> Offline Capable
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-purple-400" /> 1-Click PDF Reports
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
