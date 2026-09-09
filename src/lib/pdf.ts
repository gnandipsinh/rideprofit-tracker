import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate, formatDateShort, formatMoney } from "./format";
import { NOTO_SANS_BOLD_BASE64, NOTO_SANS_REGULAR_BASE64 } from "./report-font";
import type { ReportPayload } from "./types";

const FONT = "NotoSans";

/** A4 portrait, in points: 595.28 x 841.89 */
const MARGIN = 34;

function registerFont(doc: jsPDF): void {
  doc.addFileToVFS("NotoSans-Regular.ttf", NOTO_SANS_REGULAR_BASE64);
  doc.addFont("NotoSans-Regular.ttf", FONT, "normal");
  doc.addFileToVFS("NotoSans-Bold.ttf", NOTO_SANS_BOLD_BASE64);
  doc.addFont("NotoSans-Bold.ttf", FONT, "bold");
  doc.setFont(FONT, "normal");
}

function slug(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "vehicle";
}

/**
 * Real, selectable-text A4 portrait PDF of exactly the filtered rows shown on
 * the Reports screen. No calculations happen here — values come from the report
 * payload as-is.
 */
export function downloadReportPdf(report: ReportPayload, appName: string, symbol = "₹"): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  registerFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  const money = (n: number) => formatMoney(n, symbol);
  const s = report.summary;

  /* ---------- header ---------- */
  doc.setFillColor(24, 24, 27);
  doc.rect(0, 0, pageWidth, 84, "F");
  doc.setFont(FONT, "bold");
  doc.setFontSize(16);
  doc.setTextColor(212, 175, 80);
  doc.text(appName, MARGIN, 32);

  doc.setFont(FONT, "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(232, 232, 238);
  doc.text(`Vehicle: ${report.vehicleLabel}`, MARGIN, 52);
  doc.text(`Period: ${formatDate(report.fromDate)} to ${formatDate(report.toDate)}`, MARGIN, 68);

  doc.setFontSize(8.5);
  doc.setTextColor(190, 190, 200);
  doc.text(`Generated: ${formatDate(new Date().toISOString())}`, pageWidth - MARGIN, 52, { align: "right" });
  doc.text(`${s.trips} trip(s)`, pageWidth - MARGIN, 68, { align: "right" });

  /* ---------- summary cards ---------- */
  const cards: Array<[string, string, [number, number, number]]> = [
    ["TOTAL INCOME", money(s.income), [30, 30, 34]],
    ["TOTAL EXPENSE", money(s.totalExpense), [30, 30, 34]],
    ["NET PROFIT", money(s.profit), s.profit >= 0 ? [22, 84, 56] : [124, 34, 34]],
  ];
  const gap = 12;
  const cardW = (contentWidth - gap * 2) / 3;
  const cardY = 104;
  const cardH = 52;
  cards.forEach(([label, value, fill], i) => {
    const x = MARGIN + i * (cardW + gap);
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.roundedRect(x, cardY, cardW, cardH, 6, 6, "F");
    doc.setFont(FONT, "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(198, 198, 206);
    doc.text(label, x + 10, cardY + 19);
    doc.setFont(FONT, "bold");
    doc.setFontSize(13);
    doc.setTextColor(235, 205, 130);
    doc.text(value, x + 10, cardY + 39);
  });

  /* ---------- trip table ---------- */
  const tableStart = cardY + cardH + 22;
  const centered = { halign: "center" as const };

  autoTable(doc, {
    startY: tableStart,
    margin: { left: MARGIN, right: MARGIN, bottom: 46 },
    theme: "grid",
    tableWidth: contentWidth,
    showHead: "everyPage",
    styles: {
      font: FONT,
      fontSize: 7.6,
      cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
      textColor: [38, 38, 44],
      lineColor: [216, 216, 222],
      lineWidth: 0.4,
      overflow: "linebreak",
    },
    headStyles: {
      font: FONT,
      fontStyle: "bold",
      fillColor: [34, 34, 39],
      textColor: [235, 205, 130],
      fontSize: 7.4,
      halign: "right",
    },
    alternateRowStyles: { fillColor: [247, 247, 249] },
    columnStyles: {
      0: { cellWidth: 56, ...centered },
      1: { ...centered },
      2: { ...centered },
      3: { ...centered },
      4: { ...centered },
      5: { ...centered },
      6: { ...centered },
      7: { ...centered, fontStyle: "bold" },
    },
    head: [["Date", "Income", "Diesel", "Driver", "Other", "EMI", "Expense", "Profit"]],
    body: report.rows.map((r) => [
      formatDateShort(r.date),
      money(r.income),
      money(r.diesel),
      money(r.driverPayment),
      (r.otherExpenseItems ?? [])
        .map((item) => `${item.name} - ${money(item.amount)}`)
        .join("\n") || money(r.otherExpenses),
      money(r.emiShare),
      money(r.totalExpense),
      money(r.profit),
    ]),
    foot: [
      [
        "TOTAL",
        money(s.income),
        money(s.diesel),
        money(s.driverPayment),
        money(s.otherExpenses),
        money(s.emiShare),
        money(s.totalExpense),
        money(s.profit),
      ],
    ],
    footStyles: {
      font: FONT,
      fontStyle: "bold",
      fillColor: [24, 24, 27],
      textColor: [235, 205, 130],
      halign: "center",
      fontSize: 7.6,
    },
    didParseCell: (data) => {
      data.cell.styles.halign = "center";
    },
  });

  /* ---------- footer + page numbers ---------- */
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFont(FONT, "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(125, 125, 133);
    doc.text(`${appName} · ${report.vehicleLabel}`, MARGIN, pageHeight - 20);
    if (pages > 1) {
      doc.text(`Page ${i} of ${pages}`, pageWidth - MARGIN, pageHeight - 20, { align: "right" });
    }
  }

  doc.save(`vehicle-report-${slug(report.vehicleLabel)}-${report.fromDate}-to-${report.toDate}.pdf`);
}
