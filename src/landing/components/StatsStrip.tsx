import { Users, Truck, Route as RouteIcon, TrendingUp } from "lucide-react";

export function StatsStrip() {
  const stats = [
    {
      value: "500+",
      label: "Happy Users",
      icon: Users,
      color: "text-purple-400 bg-purple-500/15 border-purple-500/25",
    },
    {
      value: "1,200+",
      label: "Vehicles Managed",
      icon: Truck,
      color: "text-blue-400 bg-blue-500/15 border-blue-500/25",
    },
    {
      value: "25,000+",
      label: "Trips Recorded",
      icon: RouteIcon,
      color: "text-cyan-400 bg-cyan-500/15 border-cyan-500/25",
    },
    {
      value: "99%",
      label: "User Satisfaction",
      icon: TrendingUp,
      color: "text-indigo-400 bg-indigo-500/15 border-indigo-500/25",
    },
  ];

  return (
    <section className="relative py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="landing-glass rounded-3xl p-6 sm:p-8 border border-cyan-500/20 shadow-[0_10px_35px_rgba(0,0,0,0.4)]">
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4 lg:gap-8">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="flex items-center gap-4">
                  <div
                    className={`grid h-12 w-12 sm:h-14 sm:w-14 shrink-0 place-items-center rounded-2xl border ${s.color} shadow-inner`}
                  >
                    <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white tabular-nums">
                      {s.value}
                    </p>
                    <p className="truncate text-xs sm:text-sm font-medium text-slate-400">
                      {s.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
