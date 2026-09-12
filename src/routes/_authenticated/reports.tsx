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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Vehicle Profit & Expense Report" },
      {
        name: "description",
        content:
          "Generate vehicle-wise profit and expense reports for any date range and download a professional PDF.",
      },
      { property: "og:title", content: "Reports — Vehicle Profit & Expense Report" },
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
  const { symbol, appName, settings, selectedVehicleId, vehicles, vehiclesLoading } = useApp();
  const [preset, setPreset] = useState<ReportPreset>("1m");
  const [custom, setCustom] = useState({ fromDate: todayInput(), toDate: todayInput() });

  const range = useMemo(() => reportRange(preset, custom), [preset, custom]);
  const reportQuery = useReport(
    { vehicleId: selectedVehicleId, fromDate: range.fromDate, toDate: range.toDate },
    Boolean(selectedVehicleId),
  );

  const report = reportQuery.data;
  const money = (n: number) => formatMoney(n, symbol);

  return (
    <AppShell showAddTrip={false}>
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold">Reports</h2>
          <p className="text-xs text-muted-foreground">
            Vehicle-wise profit statement for any period
          </p>
        </div>

        <VehicleSelector />

        <div className="flex flex-wrap gap-2">
          {REPORT_PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPreset(p.value)}
              className={cn(
                "tap-scale rounded-full border border-border/70 px-3.5 py-2 text-xs font-semibold",
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
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={custom.fromDate}
              onChange={(e) => setCustom((c) => ({ ...c, fromDate: e.target.value }))}
              className="h-11 rounded-xl"
            />
            <Input
              type="date"
              value={custom.toDate}
              onChange={(e) => setCustom((c) => ({ ...c, toDate: e.target.value }))}
              className="h-11 rounded-xl"
            />
          </div>
        ) : null}

        {vehiclesLoading || reportQuery.isLoading ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : vehicles.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="No vehicles yet"
            description="Add a vehicle and record trips to generate reports."
          />
        ) : !report || report.rows.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="No trips in this period"
            description="Change the date range or add trips to see a report."
          />
        ) : (
          <>
            <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{report.vehicleLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateShort(report.fromDate)} – {formatDateShort(report.toDate)} ·{" "}
                    {report.summary.trips} trip(s)
                  </p>
                </div>
                <Button
                  onClick={() =>
                    downloadReportPdf(
                      report,
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

              <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Income", value: report.summary.income },
                  { label: "Total Expense", value: report.summary.totalExpense },
                  { label: "EMI Share", value: report.summary.emiShare },
                  { label: "Net Profit", value: report.summary.profit },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-secondary/50 p-3">
                    <dt className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                      {item.label}
                    </dt>
                    <dd
                      className={cn(
                        "mt-1 text-sm font-bold",
                        item.label === "Net Profit" &&
                          (item.value >= 0 ? "text-primary" : "text-destructive"),
                      )}
                    >
                      {money(item.value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/70">
              <div className="max-h-[70vh] overflow-auto">
                <table className="w-full min-w-[820px] border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-secondary/90 backdrop-blur">
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
                    {report.rows.map((row) => (
                      <tr key={row._id} className="border-t border-border/60">
                        <td className="whitespace-nowrap px-3 py-3">{formatDateShort(row.date)}</td>
                        <td className="max-w-[10rem] truncate px-3 py-3 text-muted-foreground">
                          {row.vehicleName}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right">
                          {money(row.income)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right">
                          {money(row.diesel)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right">
                          {money(row.driverPayment)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right">
                          {money(row.otherExpenses)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right">
                          {money(row.emiShare)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right">
                          {money(row.totalExpense)}
                        </td>
                        <td
                          className={cn(
                            "whitespace-nowrap px-3 py-3 text-right font-semibold",
                            row.profit >= 0 ? "text-primary" : "text-destructive",
                          )}
                        >
                          {money(row.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0 bg-secondary/90 backdrop-blur">
                    <tr className="border-t border-primary/30 font-bold">
                      <td className="px-3 py-3" colSpan={2}>
                        Total
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">
                        {money(report.summary.income)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">
                        {money(report.summary.diesel)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">
                        {money(report.summary.driverPayment)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">
                        {money(report.summary.otherExpenses)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">
                        {money(report.summary.emiShare)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">
                        {money(report.summary.totalExpense)}
                      </td>
                      <td
                        className={cn(
                          "whitespace-nowrap px-3 py-3 text-right",
                          report.summary.profit >= 0 ? "text-primary" : "text-destructive",
                        )}
                      >
                        {money(report.summary.profit)}
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
