import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  icon?: ReactNode;
  tone?: "default" | "gold" | "success" | "danger";
  sub?: string;
}

const toneClass: Record<string, string> = {
  default: "text-foreground",
  gold: "text-primary",
  success: "text-success",
  danger: "text-destructive",
};

export function StatCard({ label, value, icon, tone = "default", sub }: StatCardProps) {
  return (
    <div className="glass-card tap-scale rounded-2xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        {icon ? (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/25">
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
