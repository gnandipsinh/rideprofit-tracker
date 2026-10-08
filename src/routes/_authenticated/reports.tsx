import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, FileText } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { VehicleSelector } from "@/components/VehicleSelector";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useApp } from "@/lib/app-context";
import { useReport } from "@/lib/queries";
import { downloadReportPdf } from "@/lib/pdf";
import { formatDateShort, formatMoney, todayInput } from "@/lib/format";
import { REPORT_PRESETS, reportRange, type ReportPreset } from "@/lib/date-ranges";
import { ALL_VEHICLES } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/reports")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reports — Jay Mataji Transport" },
      {
        name: "description",
        content:
          "Generate vehicle-wise profit and expense reports for any date range and download a professional PDF.",
      },
      { property: "og:title", content: "Reports — Jay Mataji Transport" },
      {
        property: "og:description",
        content:
          "Date-range trip reports with income, expenses, EMI share, net profit and PDF export.",
      },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { symbol, appName, settings, selectedVehicleId, activeVehicles, vehiclesLoading } =
    useApp();
  const [preset, setPreset] = useState<ReportPreset>("1m");
  const [custom, setCustom] = useState({ fromDate: todayInput(), toDate: todayInput() });

  const range = useMemo(() => reportRange(preset, custom), [preset, custom]);
  const reportQuery = useReport(
    { vehicleId: selectedVehicleId, fromDate: range.fromDate, toDate: range.toDate },
    Boolean(selectedVehicleId),
  );

  const report = reportQuery.data;
  const money = (n: number) => formatMoney(n, symbol);
  const activeVehicleIds = useMemo(
    () => new Set(activeVehicles.map((v) => v._id)),
    [activeVehicles],
  );
  const filteredReport = useMemo(() => {
    if (!report) return report;
    if (selectedVehicleId !== ALL_VEHICLES && selectedVehicleId !== "") {
      return activeVehicleIds.has(selectedVehicleId) ? report : null;
    }
    const rows = report.rows.filter((r) => activeVehicleIds.has(r.vehicleId));
    if (rows.length === report.rows.length) return report;
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
    return { ...report, rows, summary };
  }, [report, selectedVehicleId, activeVehicleIds]);

  return (
    <AppShell showAddTrip={false}>
      <div className="page-stack">
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold sm:text-2xl">Reports</h2>
          <p className="text-xs text-muted-foreground">Vehicle-wise profit statement</p>
        </div>

        <VehicleSelector />

        <div className="glass-card flex gap-2 overflow-x-auto rounded-2xl p-2 no-scrollbar sm:flex-wrap sm:overflow-visible">
          {REPORT_PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPreset(p.value)}
              className={cn(
                "tap-scale min-h-[40px] shrink-0 rounded-xl border border-border/70 px-4 py-2 text-xs font-semibold",
                preset === p.value
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "bg-secondary/50 text-muted-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === "custom" ? (
          <div className="fleet-panel grid grid-cols-2 gap-3 rounded-2xl p-3 sm:max-w-xl">
            <label className="min-w-0 text-xs font-semibold text-muted-foreground">
              Start date
              <Input
                type="date"
                value={custom.fromDate}
                onChange={(e) => setCustom((c) => ({ ...c, fromDate: e.target.value }))}
                className="mt-1.5 h-11 min-w-0 rounded-xl bg-secondary/60"
              />
            </label>
            <label className="min-w-0 text-xs font-semibold text-muted-foreground">
              End date
              <Input
                type="date"
                value={custom.toDate}
                onChange={(e) => setCustom((c) => ({ ...c, toDate: e.target.value }))}
                className="mt-1.5 h-11 min-w-0 rounded-xl bg-secondary/60"
              />
            </label>
          </div>
        ) : null}

        {vehiclesLoading || reportQuery.isLoading ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : activeVehicles.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="No active vehicles"
            description="Activate a vehicle or add a new one to generate reports."
          />
        ) : !filteredReport || filteredReport.rows.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="No trips in this period"
            description="Change the date range or add trips to see a report."
          />
        ) : (
          <>
            <div className="fleet-panel rounded-2xl p-4 sm:p-5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{filteredReport.vehicleLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateShort(filteredReport.fromDate)} –{" "}
                    {formatDateShort(filteredReport.toDate)} · {filteredReport.summary.trips}{" "}
                    trip(s)
                  </p>
                </div>
                <Button
                  onClick={() =>
                    downloadReportPdf(
                      filteredReport,
                      settings?.transportationName || settings?.businessName || appName,
                      symbol,
                    )
                  }
                  className="h-11 shrink-0 rounded-xl px-4 font-semibold"
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  <span className="hidden sm:inline">Download Report</span>
                  <span className="sm:hidden">PDF</span>
                </Button>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-2xl border border-border/55 bg-background/30 p-3">
                  <dt className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    Income
                  </dt>
                  <dd className="mt-1 text-sm font-bold text-primary">
                    {money(filteredReport.summary.income)}
                  </dd>
                </div>
                <div className="rounded-2xl border border-border/55 bg-background/30 p-3">
                  <dt className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    Total Expense
                  </dt>
                  <dd className="mt-1 text-sm font-bold text-destructive">
                    {money(filteredReport.summary.totalExpense)}
                  </dd>
                </div>
                <div className="rounded-2xl border border-border/55 bg-background/30 p-3">
                  <dt className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    EMI Share
                  </dt>
                  <dd className="mt-1 text-sm font-bold">
                    {money(filteredReport.summary.emiShare)}
                  </dd>
                </div>
                <div className="rounded-2xl border border-border/55 bg-background/30 p-3">
                  <dt className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    Net Profit
                  </dt>
                  <dd
                    className={cn(
                      "mt-1 text-sm font-bold",
                      filteredReport.summary.profit >= 0 ? "text-primary" : "text-destructive",
                    )}
                  >
                    {money(filteredReport.summary.profit)}
                  </dd>
                </div>
              </dl>

              <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border/55 pt-3 sm:grid-cols-3 lg:hidden">
                <div className="rounded-2xl border border-border/55 bg-background/30 p-3">
                  <dt className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    Diesel
                  </dt>
                  <dd className="mt-1 text-sm font-bold">{money(filteredReport.summary.diesel)}</dd>
                </div>
                <div className="rounded-2xl border border-border/55 bg-background/30 p-3">
                  <dt className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    Driver
                  </dt>
                  <dd className="mt-1 text-sm font-bold">
                    {money(filteredReport.summary.driverPayment)}
                  </dd>
                </div>
                <div className="rounded-2xl border border-border/55 bg-background/30 p-3 sm:col-span-3 lg:col-span-1">
                  <dt className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    Other
                  </dt>
                  <dd className="mt-1 text-sm font-bold">
                    {money(filteredReport.summary.otherExpenses)}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/70 shadow-[var(--shadow-card)]">
              <div className="max-h-[70vh] overflow-auto">
                <table className="report-table w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-secondary/95 backdrop-blur">
                    <tr className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-3 text-left font-semibold">Date</th>
                      <th className="px-3 py-3 text-left font-semibold">Vehicle</th>
                      <th className="px-3 py-3 text-right font-semibold">Income</th>
                      <th className="px-3 py-3 text-right font-semibold">Diesel</th>
                      <th className="px-3 py-3 text-right font-semibold">Driver</th>
                      <th className="px-3 py-3 text-right font-semibold">Other</th>
                      <th className="px-3 py-3 text-right font-semibold">EMI</th>
                      <th className="px-3 py-3 text-right font-semibold">Expense</th>
                      <th className="px-3 py-3 text-right font-semibold">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReport.rows.map((row) => (
                      <tr key={row._id} className="border-t border-border/60">
                        <td className="whitespace-nowrap px-3 py-3" data-label="Date">
                          {formatDateShort(row.date)}
                        </td>
                        <td
                          className="max-w-[10rem] truncate px-3 py-3 text-muted-foreground"
                          data-label="Vehicle"
                        >
                          {row.vehicleName}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right" data-label="Income">
                          {money(row.income)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right" data-label="Diesel">
                          {money(row.diesel)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right" data-label="Driver">
                          {money(row.driverPayment)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right" data-label="Other">
                          {money(row.otherExpenses)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right" data-label="EMI">
                          {money(row.emiShare)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right" data-label="Expense">
                          {money(row.totalExpense)}
                        </td>
                        <td
                          className={cn(
                            "whitespace-nowrap px-3 py-3 text-right font-semibold",
                            row.profit >= 0 ? "text-primary" : "text-destructive",
                          )}
                          data-label="Profit"
                        >
                          {money(row.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0 bg-secondary/95 backdrop-blur">
                    <tr className="border-t border-primary/30 font-bold">
                      <td className="px-3 py-3" colSpan={2} data-label="Total">
                        Total
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right" data-label="Income">
                        {money(filteredReport.summary.income)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right" data-label="Diesel">
                        {money(filteredReport.summary.diesel)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right" data-label="Driver">
                        {money(filteredReport.summary.driverPayment)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right" data-label="Other">
                        {money(filteredReport.summary.otherExpenses)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right" data-label="EMI">
                        {money(filteredReport.summary.emiShare)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right" data-label="Expense">
                        {money(filteredReport.summary.totalExpense)}
                      </td>
                      <td
                        className={cn(
                          "whitespace-nowrap px-3 py-3 text-right",
                          filteredReport.summary.profit >= 0 ? "text-primary" : "text-destructive",
                        )}
                        data-label="Profit"
                      >
                        {money(filteredReport.summary.profit)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
