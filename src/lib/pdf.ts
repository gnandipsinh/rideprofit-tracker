import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate, formatDateShort, formatMoney } from "./format";
import { NOTO_SANS_BOLD_BASE64, NOTO_SANS_REGULAR_BASE64 } from "./report-font";
import type { ReportPayload } from "./types";

const FONT = "NotoSans";

/** A4 portrait, in points: 595.28 x 841.89 */
const MARGIN = 30;

function registerFont(doc: jsPDF): void {
  doc.addFileToVFS("NotoSans-Regular.ttf", NOTO_SANS_REGULAR_BASE64);
  doc.addFont("NotoSans-Regular.ttf", FONT, "normal");
  doc.addFileToVFS("NotoSans-Bold.ttf", NOTO_SANS_BOLD_BASE64);
  doc.addFont("NotoSans-Bold.ttf", FONT, "bold");
  doc.setFont(FONT, "normal");
}

function sanitizeSlug(value: string): string {
  return (
    value
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "report"
  );
}

export function buildReportPdf(report: ReportPayload, companyName: string, symbol = "₹"): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  registerFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  const money = (n: number) => formatMoney(n, symbol);
  const s = report.summary;

  /* ---------- Header ---------- */
  doc.setFillColor(11, 24, 34); // Premium dark navy
  doc.rect(0, 0, pageWidth, 92, "F");

  // Subtle cyan accent line
  doc.setFillColor(57, 201, 255);
  doc.rect(0, 90, pageWidth, 2, "F");

  // Company Name
  doc.setFont(FONT, "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 198, 74); // Gold
  const title = companyName || "Vehicle Calculation System";
  doc.text(title, pageWidth / 2, 28, { align: "center" });

  // Subtitle
  doc.setFont(FONT, "normal");
  doc.setFontSize(9);
  doc.setTextColor(180, 205, 225);
  doc.text("Vehicle Calculation Report", pageWidth / 2, 42, { align: "center" });

  // Meta row
  doc.setFontSize(8);
  doc.setTextColor(230, 240, 250);
  doc.text(`Vehicle: ${report.vehicleLabel}`, MARGIN, 64);
  doc.text(`Period: ${formatDate(report.fromDate)} — ${formatDate(report.toDate)}`, MARGIN, 78);

  doc.setTextColor(160, 185, 205);
  doc.text(`Generated: ${formatDate(new Date().toISOString())}`, pageWidth - MARGIN, 64, {
    align: "right",
  });
  doc.text(`Total Trips: ${s.trips}`, pageWidth - MARGIN, 78, { align: "right" });

  /* ---------- Summary 8-Card Grid (4 cols x 2 rows) ---------- */
  const summaryY = 104;
  const cardGap = 6;
  const cols = 4;
  const cardW = (contentWidth - cardGap * (cols - 1)) / cols;
  const cardH = 34;

  interface SummaryItem {
    label: string;
    value: string;
    bg: [number, number, number];
    textCol: [number, number, number];
    valCol: [number, number, number];
  }

  const isProfit = s.profit >= 0;
  const items: SummaryItem[] = [
    {
      label: "TOTAL TRIPS",
      value: String(s.trips),
      bg: [16, 35, 50],
      textCol: [142, 160, 173],
      valCol: [246, 251, 255],
    },
    {
      label: "TOTAL INCOME",
      value: money(s.income),
      bg: [16, 35, 50],
      textCol: [142, 160, 173],
      valCol: [255, 198, 74],
    },
    {
      label: "TOTAL DIESEL",
      value: money(s.diesel),
      bg: [16, 35, 50],
      textCol: [142, 160, 173],
      valCol: [246, 251, 255],
    },
    {
      label: "DRIVER PAYMENT",
      value: money(s.driverPayment),
      bg: [16, 35, 50],
      textCol: [142, 160, 173],
      valCol: [246, 251, 255],
    },
    {
      label: "OTHER EXPENSES",
      value: money(s.otherExpenses),
      bg: [16, 35, 50],
      textCol: [142, 160, 173],
      valCol: [246, 251, 255],
    },
    {
      label: "TOTAL EMI",
      value: money(s.emiShare),
      bg: [16, 35, 50],
      textCol: [142, 160, 173],
      valCol: [246, 251, 255],
    },
    {
      label: "TOTAL EXPENSE",
      value: money(s.totalExpense),
      bg: [16, 35, 50],
      textCol: [142, 160, 173],
      valCol: [244, 63, 94], // Red
    },
    {
      label: isProfit ? "NET PROFIT" : "NET LOSS",
      value: money(s.profit),
      bg: isProfit ? [7, 45, 25] : [55, 15, 20],
      textCol: isProfit ? [57, 229, 140] : [244, 63, 94],
      valCol: isProfit ? [57, 229, 140] : [244, 63, 94],
    },
  ];

  items.forEach((item, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = MARGIN + col * (cardW + cardGap);
    const y = summaryY + row * (cardH + cardGap);

    doc.setFillColor(item.bg[0], item.bg[1], item.bg[2]);
    doc.roundedRect(x, y, cardW, cardH, 4, 4, "F");

    doc.setFont(FONT, "normal");
    doc.setFontSize(6.2);
    doc.setTextColor(item.textCol[0], item.textCol[1], item.textCol[2]);
    doc.text(item.label, x + 6, y + 12);

    doc.setFont(FONT, "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(item.valCol[0], item.valCol[1], item.valCol[2]);
    doc.text(item.value, x + 6, y + 26);
  });

  /* ---------- Trip Table ---------- */
  const tableStart = summaryY + cardH * 2 + cardGap + 14;

  autoTable(doc, {
    startY: tableStart,
    margin: { left: MARGIN, right: MARGIN, bottom: 42 },
    theme: "grid",
    tableWidth: contentWidth,
    showHead: "everyPage",
    styles: {
      font: FONT,
      fontSize: 7.2,
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
      textColor: [30, 35, 45],
      lineColor: [210, 220, 230],
      lineWidth: 0.35,
      overflow: "linebreak",
      valign: "top",
    },
    headStyles: {
      font: FONT,
      fontStyle: "bold",
      fillColor: [11, 24, 34],
      textColor: [255, 198, 74],
      fontSize: 7,
      halign: "right",
    },
    alternateRowStyles: { fillColor: [248, 251, 254] },
    columnStyles: {
      0: { cellWidth: 46, halign: "center" }, // Date
      1: { cellWidth: 62, halign: "left" }, // Vehicle
      2: { cellWidth: 46, halign: "right" }, // Income
      3: { cellWidth: 44, halign: "right" }, // Diesel
      4: { cellWidth: 44, halign: "right" }, // Driver
      5: { cellWidth: 104, halign: "left" }, // Other Expenses (Itemized!)
      6: { cellWidth: 42, halign: "right" }, // EMI
      7: { cellWidth: 50, halign: "right" }, // Total Expense
      8: { cellWidth: 50, halign: "right", fontStyle: "bold" }, // Profit
    },
    head: [
      [
        "Date",
        "Vehicle",
        "Income",
        "Diesel",
        "Driver",
        "Other Expenses",
        "EMI",
        "Expense",
        "Profit",
      ],
    ],
    body: report.rows.map((r) => {
      // Build itemized other expenses breakdown
      const itemized = (r.otherExpenseItems ?? [])
        .filter((item) => item.name || Number(item.amount) > 0)
        .map((item) => `${item.name || "Other"}: ${money(item.amount)}`)
        .join("\n");

      const otherCell = itemized
        ? `${itemized}\nTotal: ${money(r.otherExpenses)}`
        : money(r.otherExpenses);

      return [
        formatDateShort(r.date),
        r.vehicleName,
        money(r.income),
        money(r.diesel),
        money(r.driverPayment),
        otherCell,
        money(r.emiShare),
        money(r.totalExpense),
        money(r.profit),
      ];
    }),
    foot: [
      [
        "TOTAL",
        `${s.trips} trips`,
        money(s.income),
        money(s.diesel),
        money(s.driverPayment),
        `Total: ${money(s.otherExpenses)}`,
        money(s.emiShare),
        money(s.totalExpense),
        money(s.profit),
      ],
    ],
    footStyles: {
      font: FONT,
      fontStyle: "bold",
      fillColor: [11, 24, 34],
      textColor: [255, 198, 74],
      fontSize: 7.2,
      halign: "right",
    },
    didParseCell: (data) => {
      // Keep headers properly aligned
      if (data.section === "head") {
        if (data.column.index === 0) data.cell.styles.halign = "center";
        else if (data.column.index === 1 || data.column.index === 5)
          data.cell.styles.halign = "left";
        else data.cell.styles.halign = "right";
      }
      if (data.section === "foot") {
        if (data.column.index === 0) data.cell.styles.halign = "center";
        else if (data.column.index === 1 || data.column.index === 5)
          data.cell.styles.halign = "left";
        else data.cell.styles.halign = "right";
      }
    },
  });

  /* ---------- Footer with Page Numbers ---------- */
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i);
    doc.setFont(FONT, "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(120, 140, 160);

    // Left footer
    doc.text(
      `${companyName || "Vehicle Calculation System"} · ${report.vehicleLabel}`,
      MARGIN,
      pageHeight - 16,
    );

    // Right footer (Page 1 of X)
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - MARGIN, pageHeight - 16, {
      align: "right",
    });
  }

  return doc;
}

export function getReportPdfFilename(report: ReportPayload): string {
  const vehiclePart = sanitizeSlug(report.vehicleLabel);
  return `vehicle-report-${vehiclePart}-${report.fromDate}-to-${report.toDate}.pdf`;
}

export function downloadReportPdf(report: ReportPayload, companyName: string, symbol = "₹"): void {
  const doc = buildReportPdf(report, companyName, symbol);
  const filename = getReportPdfFilename(report);
  doc.save(filename);
}

export async function shareReportPdf(
  report: ReportPayload,
  companyName: string,
  symbol = "₹",
): Promise<boolean> {
  const doc = buildReportPdf(report, companyName, symbol);
  const filename = getReportPdfFilename(report);
  const blob = doc.output("blob");

  if (typeof navigator !== "undefined" && navigator.share && typeof File !== "undefined") {
    const file = new File([blob], filename, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: `${companyName || "Vehicle Calculation"} Report`,
          text: `Trip & profit report for ${report.vehicleLabel} (${report.fromDate} to ${report.toDate})`,
          files: [file],
        });
        return true;
      } catch (e: unknown) {
        if ((e as Error)?.name === "AbortError") {
          return true; // User cancelled share sheet
        }
      }
    }
  }

  // Fallback to direct download
  doc.save(filename);
  return false;
}
