import { toDateInput } from "./format";

export type DashboardPreset = "today" | "week" | "month" | "lastMonth" | "all" | "custom";
export type ReportPreset = "1m" | "3m" | "6m" | "12m" | "custom";

export interface DateRange {
  fromDate: string;
  toDate: string;
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = (copy.getDay() + 6) % 7; // Monday-first
  copy.setDate(copy.getDate() - day);
  return copy;
}

export function dashboardRange(preset: DashboardPreset, custom: DateRange): DateRange {
  const now = new Date();
  switch (preset) {
    case "today":
      return { fromDate: toDateInput(now), toDate: toDateInput(now) };
    case "week":
      return { fromDate: toDateInput(startOfWeek(now)), toDate: toDateInput(now) };
    case "month":
      return {
        fromDate: toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
        toDate: toDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      };
    case "lastMonth":
      return {
        fromDate: toDateInput(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        toDate: toDateInput(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    case "all":
      return { fromDate: "2000-01-01", toDate: toDateInput(new Date(now.getFullYear() + 5, 0, 1)) };
    case "custom":
    default:
      return custom;
  }
}

export function reportRange(preset: ReportPreset, custom: DateRange): DateRange {
  const now = new Date();
  if (preset === "custom") return custom;
  const months = preset === "1m" ? 1 : preset === "3m" ? 3 : preset === "6m" ? 6 : 12;
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  return { fromDate: toDateInput(from), toDate: toDateInput(to) };
}

export const DASHBOARD_PRESETS: { value: DashboardPreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "all", label: "All Time" },
  { value: "custom", label: "Custom" },
];

export const REPORT_PRESETS: { value: ReportPreset; label: string }[] = [
  { value: "1m", label: "1 Month" },
  { value: "3m", label: "3 Months" },
  { value: "6m", label: "6 Months" },
  { value: "12m", label: "12 Months" },
  { value: "custom", label: "Custom" },
];
