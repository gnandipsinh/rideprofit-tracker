import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Fuel,
  IndianRupee,
  Layers,
  Receipt,
  RotateCcw,
  Share2,
  TrendingDown,
  TrendingUp,
  Truck,
  UserCheck,
  Wallet,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApp } from "@/lib/app-context";
import { useReport } from "@/lib/queries";
import { downloadReportPdf, shareReportPdf } from "@/lib/pdf";
import {
  formatDate,
  formatDateShort,
  formatIndianNumber,
  formatMoney,
  todayInput,
} from "@/lib/format";
import { REPORT_PRESETS, reportRange, type ReportPreset } from "@/lib/date-ranges";
import { ALL_VEHICLES, type OtherExpenseItem, type ReportRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reports")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reports — Vehicle Calculation System" },
      {
        name: "description",
        content:
          "Generate vehicle-wise profit and expense statements, itemized expense breakdowns and download selectable-text A4 PDF reports.",
      },
      { property: "og:title", content: "Reports — Vehicle Calculation System" },
      {
        property: "og:description",
        content:
          "Vehicle-wise profit and expense statements with itemized expense breakdown and PDF export.",
      },
    ],
  }),
  component: ReportsPage,
});

export function ReportsPage() {
  const {
    symbol,
    appName,
    settings,
    selectedVehicleId: contextVehicleId,
    activeVehicles,
    vehiclesLoading,
  } = useApp();

  // Filter state
  const [filterVehicleId, setFilterVehicleId] = useState<string>(contextVehicleId || ALL_VEHICLES);
  const [preset, setPreset] = useState<ReportPreset>("1m");
  const [customRange, setCustomRange] = useState({
    fromDate: todayInput(),
    toDate: todayInput(),
  });

  // Active query parameters (applied when user clicks "Apply Filter" or on initial load)
  const [activeParams, setActiveParams] = useState({
    vehicleId: contextVehicleId || ALL_VEHICLES,
    preset: "1m" as ReportPreset,
    customRange: { fromDate: todayInput(), toDate: todayInput() },
  });

  // PDF Preview Modal State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Compute date range based on active params
  const computedRange = useMemo(
    () => reportRange(activeParams.preset, activeParams.customRange),
    [activeParams.preset, activeParams.customRange],
  );

  // Report query with authenticated user isolation
  const reportQuery = useReport({
    vehicleId: activeParams.vehicleId,
    fromDate: computedRange.fromDate,
    toDate: computedRange.toDate,
  });

  const report = reportQuery.data;
  const money = (n: number) => formatMoney(n, symbol);
  const companyName =
    settings?.transportationName ||
    settings?.businessName ||
    appName ||
    "Vehicle Calculation System";

  const activeVehicleMap = useMemo(
    () => new Map(activeVehicles.map((v) => [v._id, v])),
    [activeVehicles],
  );

  // Filter active vehicles only
  const filteredReport = useMemo(() => {
    if (!report) return null;
    const isAll = !activeParams.vehicleId || activeParams.vehicleId === ALL_VEHICLES;

    const rows = report.rows.filter((r) => {
      if (!activeVehicleMap.has(r.vehicleId)) return false;
      if (!isAll && r.vehicleId !== activeParams.vehicleId) return false;
      return true;
    });

    const summary = rows.reduce(
      (acc, r) => ({
        trips: acc.trips + 1,
        income: acc.income + r.income,
        diesel: acc.diesel + r.diesel,
        driverPayment: acc.driverPayment + r.driverPayment,
        otherExpenses: acc.otherExpenses + r.otherExpenses,
        emiShare: acc.emiShare + r.emiShare,
        totalExpense: acc.totalExpense + r.totalExpense,
        profit: acc.profit + r.profit,
      }),
      {
        trips: 0,
        income: 0,
        diesel: 0,
        driverPayment: 0,
        otherExpenses: 0,
        emiShare: 0,
        totalExpense: 0,
        profit: 0,
      },
    );

    let vehicleLabel = "All Vehicles";
    if (!isAll) {
      const v = activeVehicleMap.get(activeParams.vehicleId);
      vehicleLabel = v
        ? [v.type || v.name, v.vehicleNumber].filter(Boolean).join(" · ")
        : report.vehicleLabel;
    }

    return {
      ...report,
      vehicleId: activeParams.vehicleId,
      vehicleLabel,
      rows,
      summary,
    };
  }, [report, activeParams.vehicleId, activeVehicleMap]);

  // Vehicle-wise breakdown when "All Vehicles" is selected
  const vehicleBreakdown = useMemo(() => {
    if (!filteredReport || activeParams.vehicleId !== ALL_VEHICLES) return [];

    const grouped = new Map<
      string,
      {
        vehicleId: string;
        name: string;
        vehicleNumber: string;
        trips: number;
        income: number;
        diesel: number;
        driverPayment: number;
        otherExpenses: number;
        emiShare: number;
        totalExpense: number;
        profit: number;
      }
    >();

    filteredReport.rows.forEach((r) => {
      const v = activeVehicleMap.get(r.vehicleId);
      const name = v?.type || v?.name || r.vehicleName || "Vehicle";
      const vehicleNumber = v?.vehicleNumber || "";

      const current = grouped.get(r.vehicleId) ?? {
        vehicleId: r.vehicleId,
        name,
        vehicleNumber,
        trips: 0,
        income: 0,
        diesel: 0,
        driverPayment: 0,
        otherExpenses: 0,
        emiShare: 0,
        totalExpense: 0,
        profit: 0,
      };

      current.trips += 1;
      current.income += r.income;
      current.diesel += r.diesel;
      current.driverPayment += r.driverPayment;
      current.otherExpenses += r.otherExpenses;
      current.emiShare += r.emiShare;
      current.totalExpense += r.totalExpense;
      current.profit += r.profit;

      grouped.set(r.vehicleId, current);
    });

    return Array.from(grouped.values()).sort((a, b) => b.profit - a.profit);
  }, [filteredReport, activeParams.vehicleId, activeVehicleMap]);

  // Aggregate itemized other expenses across all trips in period
  const itemizedOtherExpenses = useMemo(() => {
    if (!filteredReport) return [];
    const totals = new Map<string, number>();

    filteredReport.rows.forEach((r) => {
      if (Array.isArray(r.otherExpenseItems)) {
        r.otherExpenseItems.forEach((item) => {
          const key = (item.name || "General Other").trim();
          const amt = Number(item.amount) || 0;
          if (amt > 0) {
            totals.set(key, (totals.get(key) || 0) + amt);
          }
        });
      }
    });

    return Array.from(totals.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredReport]);

  const handleApplyFilter = () => {
    setActiveParams({
      vehicleId: filterVehicleId,
      preset,
      customRange,
    });
    toast.success("Filters applied");
  };

  const handleResetFilter = () => {
    const defaultCustom = { fromDate: todayInput(), toDate: todayInput() };
    setFilterVehicleId(ALL_VEHICLES);
    setPreset("1m");
    setCustomRange(defaultCustom);
    setActiveParams({
      vehicleId: ALL_VEHICLES,
      preset: "1m",
      customRange: defaultCustom,
    });
    toast.info("Filters reset to default");
  };

  const handleDownloadPdf = async () => {
    if (!filteredReport) return;
    setGeneratingPdf(true);
    try {
      downloadReportPdf(filteredReport, companyName, symbol);
      toast.success("PDF downloaded successfully");
      setPreviewOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF. Please try again.");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleSharePdf = async () => {
    if (!filteredReport) return;
    setGeneratingPdf(true);
    try {
      const shared = await shareReportPdf(filteredReport, companyName, symbol);
      if (shared) {
        toast.success("PDF shared successfully");
        setPreviewOpen(false);
      }
    } catch (e) {
      console.error(e);
      toast.error("Sharing failed. You can download the PDF instead.");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <AppShell showAddTrip={false}>
      <div className="page-stack pb-12">
        {/* ================================================== */}
        {/* HEADER                                             */}
        {/* ================================================== */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
              Reports
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              Analyze vehicle-wise income, expenses and profit
            </p>
          </div>
          {filteredReport && filteredReport.rows.length > 0 ? (
            <Button
              onClick={() => setPreviewOpen(true)}
              className="h-10 sm:h-11 rounded-xl px-3.5 sm:px-5 font-bold shadow-[var(--shadow-gold)] bg-primary text-primary-foreground hover:bg-primary/90 tap-scale shrink-0 text-xs sm:text-sm"
            >
              <FileSpreadsheet className="mr-1.5 h-4 w-4" />
              <span>Generate PDF</span>
            </Button>
          ) : null}
        </div>

        {/* ================================================== */}
        {/* FILTER SECTION                                     */}
        {/* ================================================== */}
        <div className="glass-card rounded-2xl p-3 sm:p-4 border border-border/80">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Report Filters
              </span>
            </div>
            <span className="text-[0.7rem] font-semibold text-primary/90 bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full">
              {formatDate(computedRange.fromDate)} – {formatDate(computedRange.toDate)}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
            {/* Vehicle Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/90">Vehicle</label>
              <Select value={filterVehicleId} onValueChange={setFilterVehicleId}>
                <SelectTrigger className="h-10 sm:h-11 rounded-xl border-input bg-secondary/60 text-xs sm:text-sm font-semibold">
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={ALL_VEHICLES}>All Vehicles</SelectItem>
                  {activeVehicles.map((v) => (
                    <SelectItem key={v._id} value={v._id}>
                      {v.type || v.name}
                      {v.vehicleNumber ? ` · ${v.vehicleNumber}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Report Period Selector */}
            <div className="space-y-1.5 sm:col-span-1 lg:col-span-1">
              <label className="text-xs font-semibold text-foreground/90">Period</label>
              <Select value={preset} onValueChange={(val) => setPreset(val as ReportPreset)}>
                <SelectTrigger className="h-10 sm:h-11 rounded-xl border-input bg-secondary/60 text-xs sm:text-sm font-semibold">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Predefined / Custom Date Range Display */}
            {preset === "custom" ? (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground/90">From Date</label>
                  <Input
                    type="date"
                    value={customRange.fromDate}
                    onChange={(e) => setCustomRange((c) => ({ ...c, fromDate: e.target.value }))}
                    className="h-10 sm:h-11 rounded-xl bg-secondary/60 text-xs sm:text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground/90">To Date</label>
                  <Input
                    type="date"
                    value={customRange.toDate}
                    onChange={(e) => setCustomRange((c) => ({ ...c, toDate: e.target.value }))}
                    className="h-10 sm:h-11 rounded-xl bg-secondary/60 text-xs sm:text-sm"
                  />
                </div>
              </>
            ) : (
              <div className="sm:col-span-2 lg:col-span-2 flex items-center justify-between p-2.5 rounded-xl border border-border/50 bg-secondary/30 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary/70 shrink-0" />
                  <span>
                    Auto Range:{" "}
                    <strong className="text-foreground">
                      {formatDateShort(computedRange.fromDate)}
                    </strong>{" "}
                    to{" "}
                    <strong className="text-foreground">
                      {formatDateShort(computedRange.toDate)}
                    </strong>
                  </span>
                </div>
                <span className="text-[0.7rem] uppercase font-semibold text-primary/80">
                  {REPORT_PRESETS.find((p) => p.value === preset)?.label}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-3.5 flex flex-wrap items-center justify-end gap-2 border-t border-border/50 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetFilter}
              className="h-9 sm:h-10 rounded-xl px-3.5 text-xs font-semibold border-border/80 text-muted-foreground hover:text-foreground hover:bg-secondary/60 tap-scale"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reset Filter
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApplyFilter}
              className="h-9 sm:h-10 rounded-xl px-4 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-gold)] tap-scale"
            >
              <Filter className="mr-1.5 h-3.5 w-3.5" />
              Apply Filter
            </Button>
          </div>
        </div>

        {/* ================================================== */}
        {/* LOADING, ERROR, EMPTY STATES                       */}
        {/* ================================================== */}
        {vehiclesLoading || reportQuery.isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-2xl bg-secondary/50" />
              ))}
            </div>
            <Skeleton className="h-64 rounded-2xl bg-secondary/50" />
          </div>
        ) : reportQuery.isError ? (
          <EmptyState
            icon={<FileText className="h-6 w-6 text-destructive" />}
            title="Unable to load report data"
            description="Could not retrieve trips from the database. Please check your connection and try again."
            action={
              <Button
                onClick={() => reportQuery.refetch()}
                className="h-10 rounded-xl px-5 font-semibold"
              >
                Retry
              </Button>
            }
          />
        ) : activeVehicles.length === 0 ? (
          <EmptyState
            icon={<Truck className="h-6 w-6 text-primary" />}
            title="No active vehicles registered"
            description="Add or activate a vehicle in the Vehicles section to start generating statements."
          />
        ) : !filteredReport || filteredReport.rows.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6 text-primary" />}
            title="No report data found"
            description="No trips are available for the selected vehicle and date range."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                <Button
                  variant="outline"
                  onClick={handleResetFilter}
                  className="h-10 rounded-xl px-4 text-xs font-semibold"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Reset Filters
                </Button>
              </div>
            }
          />
        ) : (
          <>
            {/* Active Statement Header Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl border border-border/80 bg-secondary/35">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {filteredReport.vehicleLabel}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(filteredReport.fromDate)} — {formatDate(filteredReport.toDate)} ·{" "}
                    <span className="font-semibold text-foreground/90">
                      {filteredReport.summary.trips} trip(s) recorded
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  className={cn(
                    "px-3 py-1 text-xs font-bold border",
                    filteredReport.summary.profit >= 0
                      ? "bg-success/15 text-success border-success/35"
                      : "bg-destructive/15 text-destructive border-destructive/35",
                  )}
                >
                  {filteredReport.summary.profit >= 0 ? "Net Profit" : "Net Loss"}:{" "}
                  {money(filteredReport.summary.profit)}
                </Badge>
              </div>
            </div>

            {/* ================================================== */}
            {/* 3. REPORT SUMMARY CARDS (8 Cards)                  */}
            {/* ================================================== */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              {/* TOTAL INCOME */}
              <div className="glass-card rounded-2xl p-3 sm:p-4 border border-border/70 flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[0.68rem] font-bold uppercase tracking-wider">
                    Total Income
                  </span>
                  <IndianRupee className="h-4 w-4 text-primary" />
                </div>
                <div className="mt-2">
                  <p className="text-base sm:text-xl font-extrabold text-primary tabular-nums">
                    {money(filteredReport.summary.income)}
                  </p>
                  <p className="text-[0.68rem] text-muted-foreground mt-0.5">Gross revenue</p>
                </div>
              </div>

              {/* TOTAL DIESEL */}
              <div className="glass-card rounded-2xl p-3 sm:p-4 border border-border/70 flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[0.68rem] font-bold uppercase tracking-wider">
                    Total Diesel
                  </span>
                  <Fuel className="h-4 w-4 text-warning" />
                </div>
                <div className="mt-2">
                  <p className="text-base sm:text-xl font-extrabold text-foreground tabular-nums">
                    {money(filteredReport.summary.diesel)}
                  </p>
                  <p className="text-[0.68rem] text-muted-foreground mt-0.5">Fuel expenses</p>
                </div>
              </div>

              {/* DRIVER PAYMENT */}
              <div className="glass-card rounded-2xl p-3 sm:p-4 border border-border/70 flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[0.68rem] font-bold uppercase tracking-wider">
                    Driver Payment
                  </span>
                  <UserCheck className="h-4 w-4 text-cyan-400" />
                </div>
                <div className="mt-2">
                  <p className="text-base sm:text-xl font-extrabold text-foreground tabular-nums">
                    {money(filteredReport.summary.driverPayment)}
                  </p>
                  <p className="text-[0.68rem] text-muted-foreground mt-0.5">Trip driver wages</p>
                </div>
              </div>

              {/* OTHER EXPENSES */}
              <div className="glass-card rounded-2xl p-3 sm:p-4 border border-border/70 flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[0.68rem] font-bold uppercase tracking-wider">
                    Other Expenses
                  </span>
                  <Receipt className="h-4 w-4 text-indigo-400" />
                </div>
                <div className="mt-2">
                  <p className="text-base sm:text-xl font-extrabold text-foreground tabular-nums">
                    {money(filteredReport.summary.otherExpenses)}
                  </p>
                  <p className="text-[0.68rem] text-muted-foreground mt-0.5">
                    {itemizedOtherExpenses.length} itemized type(s)
                  </p>
                </div>
              </div>

              {/* TOTAL EMI */}
              <div className="glass-card rounded-2xl p-3 sm:p-4 border border-border/70 flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[0.68rem] font-bold uppercase tracking-wider">
                    Total EMI
                  </span>
                  <Wallet className="h-4 w-4 text-amber-400" />
                </div>
                <div className="mt-2">
                  <p className="text-base sm:text-xl font-extrabold text-foreground tabular-nums">
                    {money(filteredReport.summary.emiShare)}
                  </p>
                  <p className="text-[0.68rem] text-muted-foreground mt-0.5">Vehicle EMI share</p>
                </div>
              </div>

              {/* TOTAL EXPENSE */}
              <div className="glass-card rounded-2xl p-3 sm:p-4 border border-border/70 flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[0.68rem] font-bold uppercase tracking-wider">
                    Total Expense
                  </span>
                  <TrendingDown className="h-4 w-4 text-destructive" />
                </div>
                <div className="mt-2">
                  <p className="text-base sm:text-xl font-extrabold text-destructive tabular-nums">
                    {money(filteredReport.summary.totalExpense)}
                  </p>
                  <p className="text-[0.68rem] text-muted-foreground mt-0.5">All costs combined</p>
                </div>
              </div>

              {/* NET PROFIT */}
              <div
                className={cn(
                  "glass-card rounded-2xl p-3 sm:p-4 border flex flex-col justify-between",
                  filteredReport.summary.profit >= 0
                    ? "border-success/35 bg-success/5"
                    : "border-destructive/35 bg-destructive/5",
                )}
              >
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[0.68rem] font-bold uppercase tracking-wider">
                    Net Profit
                  </span>
                  {filteredReport.summary.profit >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-success" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  )}
                </div>
                <div className="mt-2">
                  <p
                    className={cn(
                      "text-base sm:text-xl font-extrabold tabular-nums",
                      filteredReport.summary.profit >= 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {money(filteredReport.summary.profit)}
                  </p>
                  <p className="text-[0.68rem] font-semibold mt-0.5 text-muted-foreground">
                    {filteredReport.summary.income > 0
                      ? `${Math.round((filteredReport.summary.profit / filteredReport.summary.income) * 100)}% margin`
                      : "0% margin"}
                  </p>
                </div>
              </div>

              {/* TOTAL TRIPS */}
              <div className="glass-card rounded-2xl p-3 sm:p-4 border border-border/70 flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[0.68rem] font-bold uppercase tracking-wider">
                    Total Trips
                  </span>
                  <Layers className="h-4 w-4 text-primary" />
                </div>
                <div className="mt-2">
                  <p className="text-base sm:text-xl font-extrabold text-foreground tabular-nums">
                    {filteredReport.summary.trips}
                  </p>
                  <p className="text-[0.68rem] text-muted-foreground mt-0.5">Completed runs</p>
                </div>
              </div>
            </div>

            {/* ================================================== */}
            {/* 5. ITEMIZED OTHER EXPENSES (Breakdown Panel)       */}
            {/* ================================================== */}
            {itemizedOtherExpenses.length > 0 ? (
              <div className="fleet-panel rounded-2xl p-3.5 sm:p-4 border border-border/80">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-indigo-400" />
                    <h4 className="text-xs sm:text-sm font-bold text-foreground">
                      Itemized Other Expenses Breakdown
                    </h4>
                  </div>
                  <span className="text-xs font-bold text-foreground tabular-nums">
                    Total: {money(filteredReport.summary.otherExpenses)}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {itemizedOtherExpenses.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-border/55 bg-background/40"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-bold text-foreground/90 truncate">{item.name}</p>
                        <p className="text-[0.65rem] text-muted-foreground">
                          {filteredReport.summary.otherExpenses > 0
                            ? `${Math.round((item.amount / filteredReport.summary.otherExpenses) * 100)}% of other expenses`
                            : ""}
                        </p>
                      </div>
                      <span className="text-xs font-extrabold text-primary tabular-nums shrink-0">
                        {money(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* ================================================== */}
            {/* VEHICLE-WISE BREAKDOWN (When All Vehicles Selected)*/}
            {/* ================================================== */}
            {activeParams.vehicleId === ALL_VEHICLES && vehicleBreakdown.length > 1 ? (
              <div className="glass-card rounded-2xl p-3.5 sm:p-4 border border-border/80">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-primary" />
                    <h4 className="text-xs sm:text-sm font-bold text-foreground">
                      Vehicle-Wise Performance Breakdown
                    </h4>
                  </div>
                  <span className="text-[0.7rem] text-muted-foreground">
                    {vehicleBreakdown.length} active vehicle(s)
                  </span>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {vehicleBreakdown.map((vb) => {
                    const isProf = vb.profit >= 0;
                    return (
                      <div
                        key={vb.vehicleId}
                        className="rounded-2xl border border-border/60 bg-secondary/35 p-3 flex flex-col justify-between hover:border-primary/40 transition-colors"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-foreground truncate">
                                {vb.name}
                              </p>
                              {vb.vehicleNumber ? (
                                <p className="text-[0.68rem] text-primary/90 font-mono">
                                  {vb.vehicleNumber}
                                </p>
                              ) : null}
                            </div>
                            <Badge
                              className={cn(
                                "text-[0.65rem] font-bold border shrink-0",
                                isProf
                                  ? "bg-success/15 text-success border-success/30"
                                  : "bg-destructive/15 text-destructive border-destructive/30",
                              )}
                            >
                              {isProf ? "Profit" : "Loss"}
                            </Badge>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <p className="text-[0.65rem] text-muted-foreground uppercase">
                                Income
                              </p>
                              <p className="font-bold text-primary tabular-nums">
                                {money(vb.income)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[0.65rem] text-muted-foreground uppercase">
                                Expense
                              </p>
                              <p className="font-bold text-destructive tabular-nums">
                                {money(vb.totalExpense)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[0.65rem] text-muted-foreground uppercase">
                                Diesel
                              </p>
                              <p className="font-bold text-foreground tabular-nums">
                                {money(vb.diesel)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[0.65rem] text-muted-foreground uppercase">
                                Net Profit
                              </p>
                              <p
                                className={cn(
                                  "font-extrabold tabular-nums",
                                  isProf ? "text-success" : "text-destructive",
                                )}
                              >
                                {money(vb.profit)}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between text-xs">
                          <span className="text-[0.68rem] text-muted-foreground">
                            {vb.trips} trip(s)
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setFilterVehicleId(vb.vehicleId);
                              setActiveParams((prev) => ({ ...prev, vehicleId: vb.vehicleId }));
                            }}
                            className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                          >
                            Filter this vehicle <ChevronRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* ================================================== */}
            {/* 4. TRIP REPORT (Mobile Cards + Desktop Table)     */}
            {/* ================================================== */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-xs sm:text-sm font-bold text-foreground">
                  Trip Accounting Records ({filteredReport.rows.length})
                </h4>
                <span className="text-[0.68rem] text-muted-foreground">
                  Itemized expenses included
                </span>
              </div>

              {/* Mobile View (< 768px): Responsive Cards */}
              <div className="md:hidden space-y-2.5">
                {filteredReport.rows.map((row) => {
                  const isProf = row.profit >= 0;
                  const itemized = (row.otherExpenseItems ?? []).filter(
                    (i) => i.name || Number(i.amount) > 0,
                  );

                  return (
                    <div
                      key={row._id}
                      className="glass-card rounded-2xl p-3 border border-border/70 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-extrabold text-foreground">
                            {formatDate(row.date)}
                          </p>
                          <p className="text-[0.7rem] text-primary/90 font-semibold truncate mt-0.5">
                            {row.vehicleName}
                          </p>
                        </div>
                        <Badge
                          className={cn(
                            "text-xs font-bold border shrink-0",
                            isProf
                              ? "bg-success/15 text-success border-success/35"
                              : "bg-destructive/15 text-destructive border-destructive/35",
                          )}
                        >
                          {isProf ? "Profit" : "Loss"}: {money(row.profit)}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/50">
                        <div>
                          <span className="text-[0.65rem] text-muted-foreground uppercase">
                            Income
                          </span>
                          <p className="font-extrabold text-primary tabular-nums">
                            {money(row.income)}
                          </p>
                        </div>
                        <div>
                          <span className="text-[0.65rem] text-muted-foreground uppercase">
                            Total Expense
                          </span>
                          <p className="font-extrabold text-destructive tabular-nums">
                            {money(row.totalExpense)}
                          </p>
                        </div>
                        <div>
                          <span className="text-[0.65rem] text-muted-foreground uppercase">
                            Diesel
                          </span>
                          <p className="font-semibold text-foreground tabular-nums">
                            {money(row.diesel)}
                          </p>
                        </div>
                        <div>
                          <span className="text-[0.65rem] text-muted-foreground uppercase">
                            Driver
                          </span>
                          <p className="font-semibold text-foreground tabular-nums">
                            {money(row.driverPayment)}
                          </p>
                        </div>
                        <div>
                          <span className="text-[0.65rem] text-muted-foreground uppercase">
                            EMI Share
                          </span>
                          <p className="font-semibold text-foreground tabular-nums">
                            {money(row.emiShare)}
                          </p>
                        </div>
                        <div>
                          <span className="text-[0.65rem] text-muted-foreground uppercase">
                            Other Expenses
                          </span>
                          <p className="font-semibold text-foreground tabular-nums">
                            {money(row.otherExpenses)}
                          </p>
                        </div>
                      </div>

                      {/* Itemized Other Expenses for this trip */}
                      {itemized.length > 0 ? (
                        <div className="mt-2 rounded-xl bg-background/50 border border-border/55 p-2 text-[0.7rem]">
                          <p className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                            Other Expense Breakdown:
                          </p>
                          <ul className="space-y-0.5">
                            {itemized.map((it, idx) => (
                              <li
                                key={idx}
                                className="flex justify-between items-center text-foreground/90"
                              >
                                <span className="truncate pr-2">• {it.name || "Expense"}</span>
                                <span className="font-semibold tabular-nums shrink-0">
                                  {money(it.amount)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {/* Desktop / Tablet View (>= 768px): Professional Table */}
              <div className="hidden md:block overflow-hidden rounded-2xl border border-border/80 bg-card/75 shadow-[var(--shadow-card)]">
                <div className="max-h-[75vh] overflow-auto">
                  <table className="w-full border-collapse text-xs sm:text-sm">
                    <thead className="sticky top-0 z-10 bg-secondary/95 backdrop-blur border-b border-border/80">
                      <tr className="text-[0.68rem] uppercase tracking-wider text-muted-foreground font-bold">
                        <th className="px-3 py-3 text-left">Date</th>
                        <th className="px-3 py-3 text-left">Vehicle</th>
                        <th className="px-3 py-3 text-right">Income</th>
                        <th className="px-3 py-3 text-right">Diesel</th>
                        <th className="px-3 py-3 text-right">Driver</th>
                        <th className="px-3 py-3 text-left min-w-[13rem]">
                          Other Expenses (Itemized)
                        </th>
                        <th className="px-3 py-3 text-right">EMI</th>
                        <th className="px-3 py-3 text-right">Total Expense</th>
                        <th className="px-3 py-3 text-right">Net Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {filteredReport.rows.map((row) => {
                        const isProf = row.profit >= 0;
                        const itemized = (row.otherExpenseItems ?? []).filter(
                          (i) => i.name || Number(i.amount) > 0,
                        );

                        return (
                          <tr key={row._id} className="hover:bg-secondary/40 transition-colors">
                            <td className="whitespace-nowrap px-3 py-3 font-semibold text-foreground">
                              {formatDateShort(row.date)}
                            </td>
                            <td className="max-w-[11rem] truncate px-3 py-3 text-muted-foreground font-medium">
                              {row.vehicleName}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-right font-extrabold text-primary tabular-nums">
                              {money(row.income)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums">
                              {money(row.diesel)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums">
                              {money(row.driverPayment)}
                            </td>

                            {/* Itemized Other Expenses Cell */}
                            <td className="px-3 py-3 text-left">
                              {itemized.length > 0 ? (
                                <div className="space-y-0.5 text-[0.72rem]">
                                  {itemized.map((it, idx) => (
                                    <div
                                      key={idx}
                                      className="flex justify-between items-center text-muted-foreground"
                                    >
                                      <span className="truncate pr-1">• {it.name}:</span>
                                      <span className="font-semibold text-foreground/90 tabular-nums">
                                        {money(it.amount)}
                                      </span>
                                    </div>
                                  ))}
                                  <div className="pt-0.5 border-t border-border/40 font-bold text-foreground flex justify-between">
                                    <span>Total:</span>
                                    <span>{money(row.otherExpenses)}</span>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground tabular-nums">
                                  {money(row.otherExpenses)}
                                </span>
                              )}
                            </td>

                            <td className="whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums">
                              {money(row.emiShare)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-right font-extrabold text-destructive tabular-nums">
                              {money(row.totalExpense)}
                            </td>
                            <td
                              className={cn(
                                "whitespace-nowrap px-3 py-3 text-right font-extrabold tabular-nums",
                                isProf ? "text-success" : "text-destructive",
                              )}
                            >
                              {money(row.profit)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="sticky bottom-0 bg-background/98 backdrop-blur border-t-2 border-primary/40">
                      <tr className="font-extrabold text-xs">
                        <td className="px-3 py-3.5 uppercase tracking-wider text-primary">TOTAL</td>
                        <td className="px-3 py-3.5 text-muted-foreground">
                          {filteredReport.summary.trips} trips
                        </td>
                        <td className="whitespace-nowrap px-3 py-3.5 text-right text-primary tabular-nums">
                          {money(filteredReport.summary.income)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums">
                          {money(filteredReport.summary.diesel)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums">
                          {money(filteredReport.summary.driverPayment)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3.5 text-left text-primary tabular-nums">
                          Total Other: {money(filteredReport.summary.otherExpenses)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums">
                          {money(filteredReport.summary.emiShare)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3.5 text-right text-destructive tabular-nums">
                          {money(filteredReport.summary.totalExpense)}
                        </td>
                        <td
                          className={cn(
                            "whitespace-nowrap px-3 py-3.5 text-right tabular-nums text-sm",
                            filteredReport.summary.profit >= 0
                              ? "text-success"
                              : "text-destructive",
                          )}
                        >
                          {money(filteredReport.summary.profit)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ================================================== */}
        {/* 14. PDF PREVIEW DIALOG                             */}
        {/* ================================================== */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border-border/80 bg-background/95 backdrop-blur-2xl p-4 sm:p-6">
            <DialogHeader className="text-left border-b border-border/60 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-base sm:text-lg font-extrabold text-primary">
                    {companyName}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Vehicle Calculation Report · Selectable Text A4 PDF
                  </DialogDescription>
                </div>
                <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                  A4 Portrait
                </Badge>
              </div>

              {filteredReport ? (
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs rounded-xl bg-secondary/40 p-2.5 border border-border/50">
                  <div>
                    <span className="text-[0.65rem] text-muted-foreground uppercase font-bold">
                      Vehicle
                    </span>
                    <p className="font-semibold text-foreground truncate">
                      {filteredReport.vehicleLabel}
                    </p>
                  </div>
                  <div>
                    <span className="text-[0.65rem] text-muted-foreground uppercase font-bold">
                      Period
                    </span>
                    <p className="font-semibold text-foreground truncate">
                      {formatDateShort(filteredReport.fromDate)} —{" "}
                      {formatDateShort(filteredReport.toDate)}
                    </p>
                  </div>
                </div>
              ) : null}
            </DialogHeader>

            {filteredReport ? (
              <div className="space-y-4 my-2">
                {/* PDF Summary Preview */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Executive Summary
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 rounded-xl bg-secondary/40 border border-border/50">
                      <span className="text-[0.65rem] text-muted-foreground">Trips</span>
                      <p className="font-bold text-foreground">{filteredReport.summary.trips}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-secondary/40 border border-border/50">
                      <span className="text-[0.65rem] text-muted-foreground">Income</span>
                      <p className="font-bold text-primary">
                        {money(filteredReport.summary.income)}
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-secondary/40 border border-border/50">
                      <span className="text-[0.65rem] text-muted-foreground">Diesel</span>
                      <p className="font-bold text-foreground">
                        {money(filteredReport.summary.diesel)}
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-secondary/40 border border-border/50">
                      <span className="text-[0.65rem] text-muted-foreground">Driver</span>
                      <p className="font-bold text-foreground">
                        {money(filteredReport.summary.driverPayment)}
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-secondary/40 border border-border/50">
                      <span className="text-[0.65rem] text-muted-foreground">Other</span>
                      <p className="font-bold text-foreground">
                        {money(filteredReport.summary.otherExpenses)}
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-secondary/40 border border-border/50">
                      <span className="text-[0.65rem] text-muted-foreground">EMI</span>
                      <p className="font-bold text-foreground">
                        {money(filteredReport.summary.emiShare)}
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-secondary/40 border border-border/50">
                      <span className="text-[0.65rem] text-muted-foreground">Total Expense</span>
                      <p className="font-bold text-destructive">
                        {money(filteredReport.summary.totalExpense)}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "p-2 rounded-xl border",
                        filteredReport.summary.profit >= 0
                          ? "bg-success/15 border-success/35 text-success"
                          : "bg-destructive/15 border-destructive/35 text-destructive",
                      )}
                    >
                      <span className="text-[0.65rem] font-bold">Net Profit</span>
                      <p className="font-extrabold">{money(filteredReport.summary.profit)}</p>
                    </div>
                  </div>
                </div>

                {/* PDF Table Itemized Sample */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Records Included ({filteredReport.rows.length} trips)
                  </h4>
                  <div className="max-h-44 overflow-y-auto rounded-xl border border-border/60 bg-secondary/20 p-2 text-xs divide-y divide-border/40">
                    {filteredReport.rows.slice(0, 5).map((r) => (
                      <div key={r._id} className="py-1.5 flex justify-between items-center">
                        <div className="min-w-0 pr-2">
                          <p className="font-semibold text-foreground truncate">
                            {formatDateShort(r.date)} · {r.vehicleName}
                          </p>
                          <p className="text-[0.65rem] text-muted-foreground">
                            Income: {money(r.income)} | Exp: {money(r.totalExpense)}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "font-bold tabular-nums text-xs shrink-0",
                            r.profit >= 0 ? "text-success" : "text-destructive",
                          )}
                        >
                          {money(r.profit)}
                        </span>
                      </div>
                    ))}
                    {filteredReport.rows.length > 5 ? (
                      <p className="pt-2 text-center text-[0.68rem] text-muted-foreground">
                        + {filteredReport.rows.length - 5} more trips will be formatted across PDF
                        pages
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                  <p className="text-foreground font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    Multi-Page & Itemized Other Expenses Included
                  </p>
                  <p className="mt-1 text-[0.7rem]">
                    All {filteredReport.rows.length} trip rows, exact other expense descriptions,
                    page numbers and official header will be rendered in selectable vector format.
                  </p>
                </div>
              </div>
            ) : null}

            <DialogFooter className="flex-row sm:justify-end gap-2 border-t border-border/60 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewOpen(false)}
                className="rounded-xl h-10 px-4 text-xs font-semibold"
              >
                Close
              </Button>
              {canShare ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={generatingPdf}
                  onClick={handleSharePdf}
                  className="rounded-xl h-10 px-4 text-xs font-semibold border-primary/40 text-primary hover:bg-primary/10"
                >
                  <Share2 className="mr-1.5 h-3.5 w-3.5" />
                  Share
                </Button>
              ) : null}
              <Button
                size="sm"
                disabled={generatingPdf}
                onClick={handleDownloadPdf}
                className="rounded-xl h-10 px-5 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-gold)] tap-scale"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                {generatingPdf ? "Generating..." : "Download PDF"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
