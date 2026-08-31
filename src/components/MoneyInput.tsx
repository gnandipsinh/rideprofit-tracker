import { useId } from "react";
import { digitsOnly, formatIndianNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

interface MoneyInputProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  symbol?: string;
  placeholder?: string;
  className?: string;
  id?: string;
  hint?: string;
}

/**
 * Android-safe money field: the ₹ sign is a separate flex cell (never an
 * absolute overlay), so digits can never hide behind it or get clipped.
 * Value stays numeric internally; only the display string is grouped.
 */
export function MoneyInput({
  label,
  value,
  onChange,
  symbol = "₹",
  placeholder = "0",
  className,
  id,
  hint,
}: MoneyInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const display = value > 0 ? formatIndianNumber(value) : "";

  return (
    <div className={cn("w-full min-w-0", className)}>
      {label ? (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
        >
          {label}
        </label>
      ) : null}
      <div className="flex h-12 w-full min-w-0 items-stretch overflow-hidden rounded-xl border border-input bg-secondary/60 transition-colors focus-within:border-primary/70 focus-within:ring-2 focus-within:ring-ring/25">
        <span className="grid w-10 shrink-0 place-items-center border-r border-border/70 bg-muted/50 text-sm font-semibold text-primary">
          {symbol}
        </span>
        <input
          id={inputId}
          inputMode="numeric"
          autoComplete="off"
          value={display}
          placeholder={placeholder}
          onChange={(e) => {
            const digits = digitsOnly(e.target.value);
            onChange(digits ? Number(digits) : 0);
          }}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 bg-transparent px-3 text-right text-base font-semibold tabular-nums text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground"
        />
      </div>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
