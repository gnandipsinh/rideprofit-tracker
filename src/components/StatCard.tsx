import type { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: string;
  icon?: ReactNode;
  tone?: "default" | "cyan" | "purple" | "success" | "danger" | "gold";
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  sub?: string;
  className?: string;
}

type Tone = NonNullable<StatCardProps["tone"]>;

const defaultIconStyle = {
  bg: "bg-slate-800/80",
  text: "text-slate-300",
  ring: "ring-slate-700/60",
};

const toneIconStyles: Record<Tone, { bg: string; text: string; ring: string }> = {
  default: defaultIconStyle,
  cyan: {
    bg: "bg-cyan-500/15",
    text: "text-cyan-400",
    ring: "ring-cyan-500/30",
  },
  gold: {
    bg: "bg-cyan-500/15",
    text: "text-cyan-400",
    ring: "ring-cyan-500/30",
  },
  purple: {
    bg: "bg-purple-500/15",
    text: "text-purple-400",
    ring: "ring-purple-500/30",
  },
  success: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    ring: "ring-emerald-500/30",
  },
  danger: {
    bg: "bg-rose-500/15",
    text: "text-rose-400",
    ring: "ring-rose-500/30",
  },
};

export function StatCard({
  label,
  value,
  icon,
  tone = "default",
  trend,
  sub,
  className,
}: StatCardProps) {
  const iconStyle = toneIconStyles[tone] ?? defaultIconStyle;

  return (
    <div
      className={cn(
        "rounded-2xl border border-[#1C2B44] bg-[#10192A] p-4 sm:p-5 transition-all duration-200 hover:border-cyan-500/30",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {icon ? (
          <div
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1",
              iconStyle.bg,
              iconStyle.text,
              iconStyle.ring,
            )}
          >
            {icon}
          </div>
        ) : null}
        <p className="min-w-0 text-xs font-semibold text-slate-400 truncate">{label}</p>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <p className="truncate text-xl sm:text-2xl font-black tabular-nums tracking-tight text-white">
          {value}
        </p>
      </div>

      {trend ? (
        <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold">
          {trend.isPositive ? (
            <span className="inline-flex items-center gap-0.5 text-emerald-400">
              <TrendingUp className="h-3 w-3" />
              {trend.value}
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-rose-400">
              <TrendingDown className="h-3 w-3" />
              {trend.value}
            </span>
          )}
          {sub ? <span className="text-slate-400 font-normal">vs last month</span> : null}
        </div>
      ) : sub ? (
        <p className="mt-2 truncate text-xs text-slate-400">{sub}</p>
      ) : null}
    </div>
  );
}
