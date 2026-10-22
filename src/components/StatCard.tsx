import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  icon?: ReactNode;
  tone?: "default" | "gold" | "cyan" | "purple" | "success" | "danger";
  sub?: string;
}

const toneClass: Record<string, string> = {
  default: "text-white",
  gold: "text-cyan-400",
  cyan: "text-cyan-400",
  purple: "text-purple-400",
  success: "text-emerald-400",
  danger: "text-rose-400",
};

export function StatCard({ label, value, icon, tone = "default", sub }: StatCardProps) {
  return (
    <div className="glass-card tap-scale rounded-2xl p-4 sm:p-5 border border-cyan-500/15 hover:border-cyan-500/35 transition-all">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {label}
        </p>
        {icon ? (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.2)]">
            {icon}
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-2 truncate text-xl font-extrabold tabular-nums sm:text-2xl md:text-3xl",
          toneClass[tone],
        )}
      >
        {value}
      </p>
      {sub ? <p className="mt-1 truncate text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
