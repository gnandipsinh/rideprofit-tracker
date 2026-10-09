import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDateShort, formatMoney } from "./format";
import { NOTO_SANS_BOLD_BASE64, NOTO_SANS_REGULAR_BASE64 } from "./report-font";
import { TRUCK_HEADER_IMAGE_BASE64 } from "./report-truck-image";
import type { ReportPayload } from "./types";

const FONT = "NotoSans";

/** A4 portrait, in points: 595.28 x 841.89 */
const MARGIN = 20;

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

/**
 * Draw crisp vector icons for the 8 Summary Cards.
 */
function drawCardIcon(
  doc: jsPDF,
  type: string,
  cx: number,
  cy: number,
  color: [number, number, number],
): void {
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setFillColor(color[0], color[1], color[2]);
  doc.setLineWidth(1.1);

  if (type === "trips") {
    // Dual map pin / route icon
    doc.circle(cx - 1.5, cy - 3, 3.2, "FD");
    doc.line(cx - 1.5, cy + 0.2, cx - 1.5, cy + 4);
    doc.circle(cx + 3.2, cy + 3.5, 1.3, "F");
  } else if (type === "income") {
    // Rupee pouch icon
    doc.circle(cx, cy - 0.5, 4.6, "S");
    doc.setFont(FONT, "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text("₹", cx, cy + 2, { align: "center" });
  } else if (type === "diesel") {
    // Fuel pump icon with hose
    doc.roundedRect(cx - 4.2, cy - 4.8, 6, 9.6, 1, 1, "S");
    doc.rect(cx - 3, cy - 3.6, 3.6, 3, "F");
    doc.line(cx + 1.8, cy - 1, cx + 4.8, cy - 1);
    doc.line(cx + 4.8, cy - 1, cx + 4.8, cy + 3.8);
    doc.circle(cx + 4.8, cy + 4, 0.8, "F");
  } else if (type === "driver") {
    // Driver bust icon
    doc.circle(cx, cy - 3, 3.2, "F");
    doc.roundedRect(cx - 5, cy + 1.5, 10, 4.8, 2, 2, "F");
  } else if (type === "other") {
    // Precision gear icon
    doc.circle(cx, cy, 3.6, "S");
    doc.circle(cx, cy, 1.8, "F");
    for (let a = 0; a < 6; a += 1) {
      const rad = (a * Math.PI) / 3;
      doc.line(
        cx + Math.cos(rad) * 3.2,
        cy + Math.sin(rad) * 3.2,
        cx + Math.cos(rad) * 5.4,
        cy + Math.sin(rad) * 5.4,
      );
    }
  } else if (type === "emi") {
    // Bank pediment & pillar facade
    doc.triangle(cx - 5.5, cy - 1.5, cx, cy - 5.5, cx + 5.5, cy - 1.5, "F");
    doc.rect(cx - 4.2, cy - 1.2, 1.8, 4.8, "F");
    doc.rect(cx - 0.9, cy - 1.2, 1.8, 4.8, "F");
    doc.rect(cx + 2.4, cy - 1.2, 1.8, 4.8, "F");
    doc.rect(cx - 5.5, cy + 3.8, 11, 1.5, "F");
  } else if (type === "expense") {
    // Calculator icon
    doc.roundedRect(cx - 4.2, cy - 5.2, 8.4, 10.4, 1.2, 1.2, "S");
    doc.rect(cx - 3, cy - 4, 6, 2.4, "F");
    doc.rect(cx - 2.6, cy - 0.2, 1.8, 1.4, "F");
    doc.rect(cx + 0.8, cy - 0.2, 1.8, 1.4, "F");
    doc.rect(cx - 2.6, cy + 2.2, 1.8, 1.4, "F");
    doc.rect(cx + 0.8, cy + 2.2, 1.8, 1.4, "F");
  } else if (type === "profit") {
    // Trending arrow icon
    doc.setLineWidth(1.4);
    doc.line(cx - 5.2, cy + 3.2, cx - 1.8, cy);
    doc.line(cx - 1.8, cy, cx + 1.2, cy + 1.4);
    doc.line(cx + 1.2, cy + 1.4, cx + 5.2, cy - 4);
    doc.triangle(cx + 5.2, cy - 4.6, cx + 1.8, cy - 3.2, cx + 4.2, cy - 0.8, "F");
  }
}

/**
 * Draw small vector glyphs for the Info Panel.
 */
function drawInfoGlyph(
  doc: jsPDF,
  type: string,
  x: number,
  y: number,
  color: [number, number, number],
): void {
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setFillColor(color[0], color[1], color[2]);
  doc.setLineWidth(0.9);

  if (type === "truck") {
    // Truck cabin + cargo box + wheels
    doc.rect(x, y - 5, 7, 5, "F"); // cargo box
    doc.rect(x + 7.5, y - 3.8, 3.8, 3.8, "F"); // cabin
    doc.circle(x + 2.2, y + 0.8, 1.1, "F"); // rear wheel
    doc.circle(x + 8.8, y + 0.8, 1.1, "F"); // front wheel
  } else if (type === "calendar") {
    // Calendar icon
    doc.rect(x, y - 5.5, 9, 7.5, "S");
    doc.rect(x, y - 5.5, 9, 2.5, "F"); // top bar
    doc.circle(x + 2.5, y - 6.2, 0.7, "F"); // ring 1
    doc.circle(x + 6.5, y - 6.2, 0.7, "F"); // ring 2
  } else if (type === "clock") {
    // Clock / date generated
    doc.circle(x + 4.5, y - 2, 4.2, "S");
    doc.line(x + 4.5, y - 4, x + 4.5, y - 2);
    doc.line(x + 4.5, y - 2, x + 6.5, y - 2);
  } else if (type === "trips") {
    // Route pin
    doc.circle(x + 4.5, y - 3.5, 2.8, "FD");
    doc.line(x + 4.5, y - 0.7, x + 4.5, y + 2.2);
  }
}

export function buildReportPdf(report: ReportPayload, companyName: string, symbol = "₹"): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  registerFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2; // 555.28 pt
  const money = (n: number) => formatMoney(n, symbol);
  const s = report.summary;

  /* ========================================================================== */
  /* 1. HEADER BANNER (Transport-themed with panoramic truck header)            */
  /* ========================================================================== */
  const headerY = 16;
  const headerH = 106;

  // Render High-Resolution Transport Truck Panoramic Header
  try {
    doc.addImage(
      TRUCK_HEADER_IMAGE_BASE64,
      "JPEG",
      MARGIN,
      headerY,
      contentWidth,
      headerH,
      undefined,
      "FAST",
    );
  } catch (e) {
    console.error("Failed to render truck header image into PDF:", e);
    // Deep transport navy fallback
    doc.setFillColor(11, 37, 69);
    doc.rect(MARGIN, headerY, contentWidth, headerH, "F");
  }

  // Cyan neon glow bar at the bottom of the header banner
  doc.setFillColor(56, 189, 248);
  doc.rect(MARGIN, headerY + headerH - 3, contentWidth, 3, "F");

  // Company Name (Prominent bold white text)
  const title = companyName || "Vehicle Calculation System";
  doc.setFont(FONT, "bold");
  const titleFontSize = title.length > 32 ? 16 : 19;
  doc.setFontSize(titleFontSize);
  doc.setTextColor(255, 255, 255);
  doc.text(title, MARGIN + 18, headerY + 46);

  // Subtitle
  doc.setFont(FONT, "bold");
  doc.setFontSize(11);
  doc.setTextColor(224, 242, 254); // Light sky blue (#e0f2fe)
  doc.text("Vehicle Calculation Report", MARGIN + 18, headerY + 70);

  /* ========================================================================== */
  /* 2. REPORT INFORMATION BAR (Exact reference layout with vector icons)       */
  /* ========================================================================== */
  const infoY = headerY + headerH + 10;
  const infoH = 48;

  doc.setFillColor(240, 247, 255); // Soft blue background (#f0f7ff)
  doc.setDrawColor(186, 215, 250); // Thin blue border (#bad7fa)
  doc.setLineWidth(0.8);
  doc.roundedRect(MARGIN, infoY, contentWidth, infoH, 4, 4, "FD");

  const leftColX = MARGIN + 16;
  const rightColX = MARGIN + contentWidth / 2 + 18;
  const iconBlue: [number, number, number] = [29, 78, 216]; // Royal Blue

  // Row 1: Vehicle & Generated Date
  drawInfoGlyph(doc, "truck", leftColX, infoY + 18, iconBlue);
  doc.setFont(FONT, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(29, 78, 216);
  doc.text("Vehicle:", leftColX + 16, infoY + 18);

  doc.setFont(FONT, "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42); // Bold navy/black value
  doc.text(report.vehicleLabel, leftColX + 56, infoY + 18);

  drawInfoGlyph(doc, "clock", rightColX, infoY + 18, iconBlue);
  doc.setFont(FONT, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(29, 78, 216);
  doc.text("Generated:", rightColX + 14, infoY + 18);

  doc.setFont(FONT, "normal");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(formatDateShort(new Date().toISOString()), rightColX + 64, infoY + 18);

  // Row 2: Period & Total Trips
  drawInfoGlyph(doc, "calendar", leftColX, infoY + 36, iconBlue);
  doc.setFont(FONT, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(29, 78, 216);
  doc.text("Period:", leftColX + 16, infoY + 36);

  doc.setFont(FONT, "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `${formatDateShort(report.fromDate)} — ${formatDateShort(report.toDate)}`,
    leftColX + 56,
    infoY + 36,
  );

  drawInfoGlyph(doc, "trips", rightColX, infoY + 36, iconBlue);
  doc.setFont(FONT, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(29, 78, 216);
  doc.text("Total Trips:", rightColX + 14, infoY + 36);

  doc.setFont(FONT, "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(String(s.trips), rightColX + 64, infoY + 36);

  /* ========================================================================== */
  /* 3. EIGHT SUMMARY CARDS (4 x 2 Grid Matching Reference Image)               */
  /* ========================================================================== */
  const cardsY = infoY + infoH + 10;
  const cardGap = 8;
  const cols = 4;
  const cardW = (contentWidth - cardGap * (cols - 1)) / cols; // ~132.8 pt each
  const cardH = 64; // Generous height for readability on phone and print

  interface CardConfig {
    type: string;
    label: string;
    value: string;
    bg: [number, number, number];
    border: [number, number, number];
    accent: [number, number, number];
    valColor: [number, number, number];
  }

  const isProfit = s.profit >= 0;

  const cardConfigs: CardConfig[] = [
    // Row 1
    {
      type: "trips",
      label: "TOTAL TRIPS",
      value: String(s.trips),
      bg: [240, 247, 255],
      border: [186, 215, 250],
      accent: [29, 78, 216],
      valColor: [15, 23, 42],
    },
    {
      type: "income",
      label: "TOTAL INCOME",
      value: money(s.income),
      bg: [240, 253, 244],
      border: [187, 247, 208],
      accent: [21, 128, 61],
      valColor: [21, 128, 61],
    },
    {
      type: "diesel",
      label: "TOTAL DIESEL",
      value: money(s.diesel),
      bg: [254, 242, 242],
      border: [254, 202, 202],
      accent: [185, 28, 28],
      valColor: [185, 28, 28],
    },
    {
      type: "driver",
      label: "DRIVER PAYMENT",
      value: money(s.driverPayment),
      bg: [245, 243, 255],
      border: [221, 214, 254],
      accent: [67, 56, 202],
      valColor: [55, 48, 163],
    },
    // Row 2
    {
      type: "other",
      label: "OTHER EXPENSES",
      value: money(s.otherExpenses),
      bg: [255, 251, 235],
      border: [253, 230, 138],
      accent: [180, 83, 9],
      valColor: [180, 83, 9],
    },
    {
      type: "emi",
      label: "TOTAL EMI",
      value: money(s.emiShare),
      bg: [239, 246, 255],
      border: [191, 219, 254],
      accent: [29, 78, 216],
      valColor: [30, 64, 175],
    },
    {
      type: "expense",
      label: "TOTAL EXPENSE",
      value: money(s.totalExpense),
      bg: [240, 253, 250],
      border: [153, 246, 228],
      accent: [15, 118, 110],
      valColor: [15, 23, 42],
    },
    {
      type: "profit",
      label: isProfit ? "NET PROFIT" : "NET LOSS",
      value: money(s.profit),
      bg: isProfit ? [240, 253, 244] : [254, 242, 242],
      border: isProfit ? [134, 239, 172] : [254, 202, 202],
      accent: isProfit ? [21, 128, 61] : [185, 28, 28],
      valColor: isProfit ? [22, 163, 74] : [220, 38, 38],
    },
  ];

  cardConfigs.forEach((c, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = MARGIN + col * (cardW + cardGap);
    const y = cardsY + row * (cardH + cardGap);

    // Card background & border
    doc.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
    doc.setDrawColor(c.border[0], c.border[1], c.border[2]);
    doc.setLineWidth(0.8);
    doc.roundedRect(x, y, cardW, cardH, 4, 4, "FD");

    // Icon (centered at top)
    const iconX = x + cardW / 2;
    const iconY = y + 14;
    drawCardIcon(doc, c.type, iconX, iconY, c.accent);

    // Label
    doc.setFont(FONT, "bold");
    doc.setFontSize(7.2);
    doc.setTextColor(c.accent[0], c.accent[1], c.accent[2]);
    doc.text(c.label, iconX, y + 33, { align: "center" });

    // Value (Prominent, bold, readable)
    doc.setFont(FONT, "bold");
    const valFontSize = c.value.length > 9 ? 12.5 : 14.5;
    doc.setFontSize(valFontSize);
    doc.setTextColor(c.valColor[0], c.valColor[1], c.valColor[2]);
    doc.text(c.value, iconX, y + 52, { align: "center" });
  });

  /* ========================================================================== */
  /* 4. PROFESSIONAL TRIP TABLE (Spans 100% of usable page width)               */
  /* ========================================================================== */
  const tableStartY = cardsY + cardH * 2 + cardGap + 12;

  // Proportional column widths summing exactly to contentWidth (555.28 pt)
  // Date: 58 | Vehicle: 72 | Income: 54 | Diesel: 50 | Driver: 48 | Other: 112 | EMI: 48 | Expense: 55 | Profit: 58.28
  const colWidths = {
    date: 58,
    vehicle: 72,
    income: 54,
    diesel: 50,
    driver: 48,
    other: 112,
    emi: 48,
    expense: 55,
    profit: contentWidth - (58 + 72 + 54 + 50 + 48 + 112 + 48 + 55), // 58.28 pt
  };

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: MARGIN, right: MARGIN, bottom: 44 },
    theme: "grid",
    tableWidth: contentWidth,
    showHead: "everyPage",
    showFoot: "lastPage",
    styles: {
      font: FONT,
      fontSize: 8,
      cellPadding: { top: 7, bottom: 7, left: 3.5, right: 3.5 },
      textColor: [15, 23, 42],
      lineColor: [220, 230, 242],
      lineWidth: 0.5,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      font: FONT,
      fontStyle: "bold",
      fillColor: [15, 56, 105], // Deep navy transport blue (#0f3869)
      textColor: [255, 255, 255], // Crisp white header text
      fontSize: 8,
      halign: "right",
      cellPadding: { top: 7, bottom: 7, left: 3.5, right: 3.5 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 253], // Light alternating rows
    },
    columnStyles: {
      0: { cellWidth: colWidths.date, halign: "center", fontStyle: "bold" },
      1: { cellWidth: colWidths.vehicle, halign: "left" },
      2: { cellWidth: colWidths.income, halign: "right" },
      3: { cellWidth: colWidths.diesel, halign: "right" },
      4: { cellWidth: colWidths.driver, halign: "right" },
      5: { cellWidth: colWidths.other, halign: "left" },
      6: { cellWidth: colWidths.emi, halign: "right" },
      7: { cellWidth: colWidths.expense, halign: "right" },
      8: { cellWidth: colWidths.profit, halign: "right", fontStyle: "bold" },
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
      // Itemized other expenses matching reference format: "Driver salary:\n₹1,000"
      const itemized = (r.otherExpenseItems ?? [])
        .filter((item) => item.name || Number(item.amount) > 0)
        .map((item) => `${item.name || "Expense"}:\n${money(item.amount)}`)
        .join("\n");

      const otherCell = itemized || (r.otherExpenses > 0 ? money(r.otherExpenses) : "₹0");

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
        money(s.otherExpenses),
        money(s.emiShare),
        money(s.totalExpense),
        money(s.profit),
      ],
    ],
    footStyles: {
      font: FONT,
      fontStyle: "bold",
      fillColor: [224, 242, 254], // Soft sky blue total row (#e0f2fe)
      textColor: [15, 56, 105], // Navy blue bold total text (#0f3869)
      fontSize: 8.5,
      halign: "right",
      cellPadding: { top: 7, bottom: 7, left: 3.5, right: 3.5 },
    },
    didParseCell: (data) => {
      // Header alignments
      if (data.section === "head") {
        if (data.column.index === 0) data.cell.styles.halign = "center";
        else if (data.column.index === 1 || data.column.index === 5)
          data.cell.styles.halign = "left";
        else data.cell.styles.halign = "right";
      }

      // Body styling
      if (data.section === "body") {
        // Profit color: Green for profit, Red for loss
        if (data.column.index === 8) {
          const rowObj = report.rows[data.row.index];
          if (rowObj) {
            data.cell.styles.textColor = rowObj.profit >= 0 ? [22, 163, 74] : [220, 38, 38];
          }
        }
      }

      // Footer styling
      if (data.section === "foot") {
        if (data.column.index === 0) data.cell.styles.halign = "center";
        else if (data.column.index === 1) data.cell.styles.halign = "center";
        else if (data.column.index === 5) data.cell.styles.halign = "center";
        else data.cell.styles.halign = "right";

        // Green net profit in total row
        if (data.column.index === 8) {
          data.cell.styles.textColor = s.profit >= 0 ? [22, 163, 74] : [220, 38, 38];
        }
      }
    },
  });

  /* ========================================================================== */
  /* 5. FOOTER & MULTI-PAGE NUMBERING                                           */
  /* ========================================================================== */
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i);

    // Thin navy rule
    doc.setDrawColor(200, 215, 235);
    doc.setLineWidth(0.7);
    doc.line(MARGIN, pageHeight - 34, pageWidth - MARGIN, pageHeight - 34);

    // Left footer: Company · Vehicle
    doc.setFont(FONT, "bold");
    doc.setFontSize(7.8);
    doc.setTextColor(30, 58, 138); // Deep royal blue
    doc.text(`${title} · ${report.vehicleLabel}`, MARGIN, pageHeight - 22);

    // Right footer: Page 1 of X
    doc.setFont(FONT, "normal");
    doc.setFontSize(7.8);
    doc.setTextColor(30, 58, 138);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - MARGIN, pageHeight - 22, {
      align: "right",
    });

    // Decorative bottom transport accent bar matching reference image
    const bottomY = pageHeight - 11;
    const bottomH = 6;
    // Left navy segment (68%)
    doc.setFillColor(15, 56, 105);
    doc.rect(MARGIN, bottomY, contentWidth * 0.68, bottomH, "F");

    // Right cyan transport accent segment (32%)
    doc.setFillColor(2, 132, 199);
    doc.rect(MARGIN + contentWidth * 0.68, bottomY, contentWidth * 0.32, bottomH, "F");
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
