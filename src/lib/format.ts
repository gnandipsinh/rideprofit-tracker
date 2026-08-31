const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** 125000 -> "1,25,000" (Indian grouping, no symbol) */
export function formatIndianNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const negative = value < 0;
  const formatted = inr.format(Math.abs(Math.round(value)));
  return negative ? `-${formatted}` : formatted;
}

/** 14500 -> "₹14,500" */
export function formatMoney(value: number, symbol = "₹"): string {
  const negative = value < 0;
  return `${negative ? "-" : ""}${symbol}${formatIndianNumber(Math.abs(value))}`;
}

export function currencySymbol(currency: string): string {
  switch (currency?.toUpperCase()) {
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "AED":
      return "AED ";
    default:
      return "₹";
  }
}

/** Digits only, used for money inputs. */
export function digitsOnly(raw: string): string {
  return raw.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
}

/** "2026-08-31" -> "31 Aug 2026" (timezone safe) */
export function formatDate(value: string | Date): string {
  const iso = typeof value === "string" ? value : value.toISOString();
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return String(value);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(d).padStart(2, "0")} ${months[m - 1]} ${y}`;
}

/** "2026-08-31" -> "31/08/2026" (compact tables & PDF) */
export function formatDateShort(value: string | Date): string {
  const iso = typeof value === "string" ? value : value.toISOString();
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return String(value);
  return `${d}/${m}/${y}`;
}

/** Date -> "YYYY-MM-DD" using UTC parts so the day never shifts. */
export function toDateInput(date: Date): string {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).toISOString().slice(0, 10);
}

export function todayInput(): string {
  return toDateInput(new Date());
}

export function isoDayOnly(value: string | Date): string {
  const iso = typeof value === "string" ? value : value.toISOString();
  return iso.slice(0, 10);
}
