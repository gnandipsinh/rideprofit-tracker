import { Truck, Route as RouteIcon, Wallet, BarChart3, FileSpreadsheet } from "lucide-react";

export function FeaturesSection() {
  const features = [
    {
      title: "Vehicle Management",
      description: "Add and manage unlimited vehicles with all important details in one place.",
      icon: Truck,
      color: "from-blue-600 to-cyan-500",
      borderColor: "border-blue-500/30",
      glowColor: "rgba(37,99,235,0.3)",
      iconBg: "bg-blue-500/15 text-blue-400",
    },
    {
      title: "Trip Management",
      description: "Record trips, track routes, load details and calculate trip-wise profit.",
      icon: RouteIcon,
      color: "from-purple-600 to-indigo-500",
      borderColor: "border-purple-500/30",
      glowColor: "rgba(168,85,247,0.3)",
      iconBg: "bg-purple-500/15 text-purple-400",
    },
    {
      title: "Income & Expense Tracking",
      description: "Track diesel, toll, maintenance and all other expenses easily.",
      icon: Wallet,
      color: "from-emerald-600 to-teal-500",
      borderColor: "border-emerald-500/30",
      glowColor: "rgba(16,185,129,0.3)",
      iconBg: "bg-emerald-500/15 text-emerald-400",
    },
    {
      title: "Real Profit Calculation",
      description: "Get accurate net profit with detailed income and expense analysis.",
      icon: BarChart3,
      color: "from-fuchsia-600 to-purple-500",
      borderColor: "border-fuchsia-500/30",
      glowColor: "rgba(217,70,239,0.3)",
      iconBg: "bg-fuchsia-500/15 text-fuchsia-400",
    },
    {
      title: "Reports & Analytics",
      description: "View detailed reports, charts and insights to grow your business.",
      icon: FileSpreadsheet,
      color: "from-blue-600 to-indigo-500",
      borderColor: "border-blue-500/30",
      glowColor: "rgba(37,99,235,0.3)",
      iconBg: "bg-blue-500/15 text-blue-400",
    },
  ];

  return (
    <section id="features" className="relative py-20 lg:py-28 overflow-hidden scroll-mt-24">
      {/* Background ambient lighting */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[900px] rounded-full bg-cyan-900/10 blur-[150px]"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="relative text-left sm:text-center max-w-3xl mx-auto mb-16">
          <div className="inline-block mb-4">
            <span className="landing-pill-badge">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              FEATURES
            </span>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl leading-tight">
            Everything You Need to Manage{" "}
            <span className="block sm:inline landing-gradient-text">Your Transport Business</span>
          </h2>

          <p className="mt-4 text-base sm:text-lg text-slate-300">
            Powerful features to help you track, manage and grow your vehicle business.
          </p>

          {/* Hand-drawn stylish callout annotation */}
          <div className="hidden lg:flex items-center gap-2 absolute -right-24 top-6 text-cyan-300 font-serif italic text-sm tracking-wide">
            <span className="text-slate-400">Simple · Powerful · Profitable</span>
            <svg
              className="w-8 h-8 text-cyan-400 -rotate-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              />
            </svg>
          </div>
        </div>

        {/* 5 Feature Cards Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="landing-glass-card group relative flex flex-col justify-between rounded-2xl p-6 border border-slate-800/80 hover:border-cyan-500/40"
              >
                <div>
                  {/* Glowing Icon Square */}
                  <div
                    className={`grid h-13 w-13 place-items-center rounded-2xl ${feature.iconBg} ring-1 ring-white/10 mb-5 transition-transform duration-300 group-hover:scale-110`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                    {feature.title}
                  </h3>

                  {/* Description */}
                  <p className="mt-2.5 text-xs sm:text-sm text-slate-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>

                {/* Subtle bottom highlight line */}
                <div className="mt-6 h-0.5 w-full bg-slate-800 group-hover:bg-gradient-to-r group-hover:from-cyan-400 group-hover:to-blue-500 transition-all rounded-full" />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
