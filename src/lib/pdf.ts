import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDateShort, formatIndianNumber } from "./format";
import type { ReportPayload } from "./types";

/**
 * Professional multi-page PDF for the exact rows shown in the report table.
 * jsPDF core fonts have no ₹ glyph, so amounts are prefixed with "Rs." in the
 * document while the on-screen table keeps the ₹ symbol.
 */
export function downloadReportPdf(report: ReportPayload, appName: string): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const money = (n: number) => `Rs. ${formatIndianNumber(n)}`;

  doc.setFillColor(24, 24, 27);
  doc.rect(0, 0, pageWidth, 78, "F");
  doc.setTextColor(212, 175, 80);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(appName, 40, 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(230, 230, 235);
  doc.text(
    `Vehicle: ${report.vehicleLabel}    |    Period: ${formatDateShort(report.fromDate)} to ${formatDateShort(report.toDate)}`,
    40,
    56,
  );
  doc.text(`Generated: ${formatDateShort(new Date().toISOString())}`, pageWidth - 40, 56, { align: "right" });

  const s = report.summary;
  autoTable(doc, {
    startY: 96,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 5, textColor: [35, 35, 40] },
    headStyles: { fillColor: [42, 42, 48], textColor: [235, 205, 130], fontStyle: "bold" },
    head: [["Total Trips", "Income", "Diesel", "Driver", "Other Expense", "EMI", "Total Expense", "Net Profit"]],
    body: [
      [
        String(s.trips),
        money(s.income),
        money(s.diesel),
        money(s.driverPayment),
        money(s.otherExpenses),
        money(s.emiShare),
        money(s.totalExpense),
        money(s.profit),
      ],
    ],
  });

  const afterSummary = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22;

  autoTable(doc, {
    startY: afterSummary,
    theme: "striped",
    showHead: "everyPage",
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 4.5, textColor: [35, 35, 40] },
    headStyles: { fillColor: [42, 42, 48], textColor: [235, 205, 130], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [246, 246, 248] },
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
    },
    head: [
      ["Date", "Vehicle", "Income", "Diesel", "Driver", "Other Expense", "EMI", "Total Expense", "Profit"],
    ],
    body: report.rows.map((r) => [
      formatDateShort(r.date),
      r.vehicleName,
      money(r.income),
      money(r.diesel),
      money(r.driverPayment),
      money(r.otherExpenses),
      money(r.emiShare),
      money(r.totalExpense),
      money(r.profit),
    ]),
    foot: [
      [
        "TOTAL",
        `${s.trips} trip(s)`,
        money(s.income),
        money(s.diesel),
        money(s.driverPayment),
        money(s.otherExpenses),
        money(s.emiShare),
        money(s.totalExpense),
        money(s.profit),
      ],
    ],
    footStyles: { fillColor: [24, 24, 27], textColor: [235, 205, 130], fontStyle: "bold", halign: "right" },
  });

  // Other expense breakdown per trip, when items exist
  const withItems = report.rows.filter((r) => (r.otherExpenseItems ?? []).length > 0);
  if (withItems.length > 0) {
    const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;
    autoTable(doc, {
      startY: y,
      theme: "grid",
      showHead: "everyPage",
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 4.5 },
      headStyles: { fillColor: [42, 42, 48], textColor: [235, 205, 130], fontStyle: "bold" },
      columnStyles: { 3: { halign: "right" }, 4: { halign: "right" } },
      head: [["Date", "Vehicle", "Expense Item", "Amount", "Trip Other Total"]],
      body: withItems.flatMap((r) =>
        (r.otherExpenseItems ?? []).map((item, index) => [
          index === 0 ? formatDateShort(r.date) : "",
          index === 0 ? r.vehicleName : "",
          item.name,
          money(item.amount),
          index === 0 ? money(r.otherExpenses) : "",
        ]),
      ),
    });
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 128);
    doc.text(`${appName} · ${report.vehicleLabel}`, 40, doc.internal.pageSize.getHeight() - 18);
    doc.text(`Page ${i} of ${pages}`, pageWidth - 40, doc.internal.pageSize.getHeight() - 18, {
      align: "right",
    });
  }

  const safe = report.vehicleLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`report-${safe}-${report.fromDate}-to-${report.toDate}.pdf`);
}
