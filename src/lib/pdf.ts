import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDateShort, formatMoney } from "./format";
import { NOTO_SANS_BOLD_BASE64, NOTO_SANS_REGULAR_BASE64 } from "./report-font";
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
  const title = companyName || "Express Logistics Fleet";

  /* ========================================================================== */
  /* 1. EXECUTIVE VECTOR HEADER BANNER (Sharp, modern, no photo distortion)     */
  /* ========================================================================== */
  const headerY = 16;
  const headerH = 88;

  // Primary rich corporate navy background
  doc.setFillColor(12, 28, 56);
  doc.roundedRect(MARGIN, headerY, contentWidth, headerH, 6, 6, "F");

  // Modern stylized diagonal accent overlay on right side
  doc.setFillColor(24, 52, 98);
  doc.triangle(
    MARGIN + contentWidth - 190,
    headerY,
    MARGIN + contentWidth,
    headerY,
    MARGIN + contentWidth,
    headerY + headerH,
    "F",
  );
  doc.triangle(
    MARGIN + contentWidth - 190,
    headerY,
    MARGIN + contentWidth,
    headerY + headerH,
    MARGIN + contentWidth - 130,
    headerY + headerH,
    "F",
  );

  // Bottom neon cyan accent line
  doc.setFillColor(6, 182, 212);
  doc.rect(MARGIN, headerY + headerH - 3, contentWidth, 3, "F");

  // Top luxury badge: OFFICIAL FLEET STATEMENT
  doc.setFillColor(28, 62, 116);
  doc.roundedRect(MARGIN + 16, headerY + 12, 168, 15, 3, 3, "F");
  doc.setFont(FONT, "bold");
  doc.setFontSize(7);
  doc.setTextColor(56, 189, 248); // Cyan text
  doc.text("★ OFFICIAL FLEET ACCOUNTING STATEMENT", MARGIN + 22, headerY + 22.5);

  // Company Name (Prominent bold white text)
  doc.setFont(FONT, "bold");
  const titleFontSize = title.length > 28 ? 15 : 18;
  doc.setFontSize(titleFontSize);
  doc.setTextColor(255, 255, 255);
  doc.text(title, MARGIN + 16, headerY + 47);

  // Subtitle
  doc.setFont(FONT, "normal");
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225); // Slate 300
  doc.text("Vehicle Profit, Expense & Operating Performance Ledger", MARGIN + 16, headerY + 65);

  // Right-hand side Document Control Box
  const refBoxW = 120;
  const refBoxX = MARGIN + contentWidth - refBoxW - 14;
  const refBoxY = headerY + 12;

  doc.setFillColor(15, 36, 70);
  doc.setDrawColor(45, 85, 145);
  doc.setLineWidth(0.8);
  doc.roundedRect(refBoxX, refBoxY, refBoxW, 64, 4, 4, "FD");

  doc.setFont(FONT, "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text("STATEMENT REF", refBoxX + 8, refBoxY + 12);
  doc.setFont(FONT, "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  const refId = `#RP-${report.fromDate.replace(/-/g, "").slice(2)}-${String(s.trips).padStart(3, "0")}`;
  doc.text(refId, refBoxX + 8, refBoxY + 23);

  doc.setFont(FONT, "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(148, 163, 184);
  doc.text("DATE GENERATED", refBoxX + 8, refBoxY + 36);
  doc.setFont(FONT, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(226, 232, 240);
  doc.text(formatDateShort(new Date().toISOString()), refBoxX + 8, refBoxY + 46);

  // Status Indicator
  doc.setFillColor(34, 197, 94); // Green dot
  doc.circle(refBoxX + 11, refBoxY + 56, 2.5, "F");
  doc.setFont(FONT, "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(34, 197, 94);
  doc.text("RECONCILED & AUDITED", refBoxX + 18, refBoxY + 58.5);

  /* ========================================================================== */
  /* 2. REPORT INFORMATION BAR                                                  */
  /* ========================================================================== */
  const infoY = headerY + headerH + 8;
  const infoH = 38;

  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setLineWidth(0.8);
  doc.roundedRect(MARGIN, infoY, contentWidth, infoH, 5, 5, "FD");

  const quarterW = contentWidth / 4;
  const iconBlue: [number, number, number] = [29, 78, 216];

  // Tile 1: Vehicle
  drawInfoGlyph(doc, "truck", MARGIN + 12, infoY + 20, iconBlue);
  doc.setFont(FONT, "bold");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("VEHICLE / FLEET", MARGIN + 26, infoY + 15);
  doc.setFont(FONT, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  const vLabel =
    report.vehicleLabel.length > 24 ? report.vehicleLabel.slice(0, 22) + "…" : report.vehicleLabel;
  doc.text(vLabel, MARGIN + 26, infoY + 28);

  // Separator 1
  doc.setDrawColor(226, 232, 240);
  doc.line(MARGIN + quarterW, infoY + 6, MARGIN + quarterW, infoY + infoH - 6);

  // Tile 2: Period
  drawInfoGlyph(doc, "calendar", MARGIN + quarterW + 12, infoY + 20, iconBlue);
  doc.setFont(FONT, "bold");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("STATEMENT PERIOD", MARGIN + quarterW + 26, infoY + 15);
  doc.setFont(FONT, "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `${formatDateShort(report.fromDate)} — ${formatDateShort(report.toDate)}`,
    MARGIN + quarterW + 26,
    infoY + 28,
  );

  // Separator 2
  doc.line(MARGIN + quarterW * 2, infoY + 6, MARGIN + quarterW * 2, infoY + infoH - 6);

  // Tile 3: Total Runs
  drawInfoGlyph(doc, "trips", MARGIN + quarterW * 2 + 12, infoY + 20, iconBlue);
  doc.setFont(FONT, "bold");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("TOTAL RUNS", MARGIN + quarterW * 2 + 26, infoY + 15);
  doc.setFont(FONT, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${s.trips} Completed Trip(s)`, MARGIN + quarterW * 2 + 26, infoY + 28);

  // Separator 3
  doc.line(MARGIN + quarterW * 3, infoY + 6, MARGIN + quarterW * 3, infoY + infoH - 6);

  // Tile 4: Ledger Status
  drawInfoGlyph(doc, "clock", MARGIN + quarterW * 3 + 12, infoY + 20, iconBlue);
  doc.setFont(FONT, "bold");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("LEDGER STATUS", MARGIN + quarterW * 3 + 26, infoY + 15);
  doc.setFont(FONT, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(22, 163, 74);
  doc.text("Balanced & Reconciled", MARGIN + quarterW * 3 + 26, infoY + 28);

  /* ========================================================================== */
  /* 3. EIGHT KEY PERFORMANCE METRIC CARDS (4 x 2 Grid)                         */
  /* ========================================================================== */
  const cardsY = infoY + infoH + 8;
  const cardGap = 6;
  const cols = 4;
  const cardW = (contentWidth - cardGap * (cols - 1)) / cols; // ~134.3 pt
  const cardH = 50; // Sleek and compact

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
      bg: [236, 253, 245],
      border: [167, 243, 208],
      accent: [5, 150, 105],
      valColor: [5, 150, 105],
    },
    {
      type: "diesel",
      label: "TOTAL DIESEL",
      value: money(s.diesel),
      bg: [255, 247, 237],
      border: [254, 215, 170],
      accent: [217, 119, 6],
      valColor: [194, 65, 12],
    },
    {
      type: "driver",
      label: "DRIVER PAYMENT",
      value: money(s.driverPayment),
      bg: [238, 242, 255],
      border: [199, 210, 254],
      accent: [79, 70, 229],
      valColor: [67, 56, 202],
    },
    // Row 2
    {
      type: "other",
      label: "OTHER EXPENSES",
      value: money(s.otherExpenses),
      bg: [248, 250, 252],
      border: [226, 232, 240],
      accent: [71, 85, 105],
      valColor: [51, 65, 85],
    },
    {
      type: "emi",
      label: "TOTAL EMI",
      value: money(s.emiShare),
      bg: [239, 246, 255],
      border: [191, 219, 254],
      accent: [37, 99, 235],
      valColor: [30, 64, 175],
    },
    {
      type: "expense",
      label: "TOTAL EXPENSE",
      value: money(s.totalExpense),
      bg: [255, 241, 242],
      border: [254, 205, 211],
      accent: [225, 29, 72],
      valColor: [225, 29, 72],
    },
    {
      type: "profit",
      label: isProfit ? "NET PROFIT" : "NET LOSS",
      value: money(s.profit),
      bg: isProfit ? [240, 253, 244] : [254, 242, 242],
      border: isProfit ? [134, 239, 172] : [254, 202, 202],
      accent: isProfit ? [22, 163, 74] : [220, 38, 38],
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
    doc.setLineWidth(0.75);
    doc.roundedRect(x, y, cardW, cardH, 4, 4, "FD");

    // Icon (centered at top)
    const iconX = x + cardW / 2;
    const iconY = y + 12;
    drawCardIcon(doc, c.type, iconX, iconY, c.accent);

    // Label
    doc.setFont(FONT, "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(c.accent[0], c.accent[1], c.accent[2]);
    doc.text(c.label, iconX, y + 27, { align: "center" });

    // Value
    doc.setFont(FONT, "bold");
    const valFontSize = c.value.length > 9 ? 11 : 12.5;
    doc.setFontSize(valFontSize);
    doc.setTextColor(c.valColor[0], c.valColor[1], c.valColor[2]);
    doc.text(c.value, iconX, y + 42, { align: "center" });
  });

  /* ========================================================================== */
  /* 4. PROFESSIONAL TRIP ACCOUNTING TABLE                                      */
  /* ========================================================================== */
  const tableStartY = cardsY + cardH * 2 + cardGap + 10;

  // Proportional column widths summing exactly to contentWidth (555.28 pt)
  // Date: 56 | Vehicle: 80 | Income: 54 | Diesel: 50 | Driver: 48 | Other: 106 | EMI: 44 | Expense: 55 | Profit: 62.28
  const colWidths = {
    date: 56,
    vehicle: 80,
    income: 54,
    diesel: 50,
    driver: 48,
    other: 106,
    emi: 44,
    expense: 55,
    profit: contentWidth - (56 + 80 + 54 + 50 + 48 + 106 + 44 + 55), // 62.28 pt
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
      cellPadding: { top: 6, bottom: 6, left: 3.5, right: 3.5 },
      textColor: [15, 23, 42],
      lineColor: [220, 230, 242],
      lineWidth: 0.5,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      font: FONT,
      fontStyle: "bold",
      fillColor: [15, 38, 75], // Deep navy transport blue
      textColor: [255, 255, 255],
      fontSize: 8,
      halign: "right",
      cellPadding: { top: 6, bottom: 6, left: 3.5, right: 3.5 },
    },
    alternateRowStyles: {
      fillColor: [249, 250, 253],
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
      // Single clean line per other expense item (e.g. "Toll Tax: ₹500")
      const itemized = (r.otherExpenseItems ?? [])
        .filter((item) => item.name || Number(item.amount) > 0)
        .map((item) => `${item.name || "Expense"}: ${money(item.amount)}`)
        .join("\n");

      const otherCell = itemized || (r.otherExpenses > 0 ? money(r.otherExpenses) : "₹0");

      const vehicleLines = [r.vehicleName];
      if (r.route) vehicleLines.push(`Route: ${r.route}`);
      if (r.driverName) vehicleLines.push(`Driver: ${r.driverName}`);
      if (r.totalKm && r.dieselLiters && r.dieselLiters > 0) {
        vehicleLines.push(`${(r.totalKm / r.dieselLiters).toFixed(1)} km/L (${r.totalKm} km)`);
      }
      const vehicleCell = vehicleLines.join("\n");

      return [
        formatDateShort(r.date),
        vehicleCell,
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
      fillColor: [224, 242, 254], // Soft sky blue total row
      textColor: [15, 56, 105], // Navy blue bold total text
      fontSize: 8.5,
      halign: "right",
      cellPadding: { top: 6, bottom: 6, left: 3.5, right: 3.5 },
    },
    didParseCell: (data) => {
      if (data.section === "head") {
        if (data.column.index === 0) data.cell.styles.halign = "center";
        else if (data.column.index === 1 || data.column.index === 5)
          data.cell.styles.halign = "left";
        else data.cell.styles.halign = "right";
      }

      if (data.section === "body") {
        if (data.column.index === 8) {
          const rowObj = report.rows[data.row.index];
          if (rowObj) {
            data.cell.styles.textColor = rowObj.profit >= 0 ? [22, 163, 74] : [220, 38, 38];
          }
        }
      }

      if (data.section === "foot") {
        if (data.column.index === 0) data.cell.styles.halign = "center";
        else if (data.column.index === 1) data.cell.styles.halign = "center";
        else if (data.column.index === 5) data.cell.styles.halign = "center";
        else data.cell.styles.halign = "right";

        if (data.column.index === 8) {
          data.cell.styles.textColor = s.profit >= 0 ? [22, 163, 74] : [220, 38, 38];
        }
      }
    },
  });

  /* ========================================================================== */
  /* 5. CLOSING FINANCIAL RATIOS, AUDIT DECLARATION & SIGNATURES                */
  /* ========================================================================== */
  const lastTableY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
    tableStartY + 120;

  const closingBlockHeight = 156;
  let closingY = lastTableY + 12;

  // If table leaves insufficient room before footer margin, push to a clean page
  if (pageHeight - lastTableY < closingBlockHeight + 44) {
    doc.addPage();
    closingY = MARGIN + 16;
  }

  // 5A. Three Financial Breakdown Ratio Cards across contentWidth
  const ratioCols = 3;
  const ratioGap = 8;
  const ratioW = (contentWidth - ratioGap * (ratioCols - 1)) / ratioCols; // ~179.7 pt
  const ratioH = 46;

  const profitMargin = s.income > 0 ? ((s.profit / s.income) * 100).toFixed(1) : "0.0";
  const fuelRatio = s.income > 0 ? ((s.diesel / s.income) * 100).toFixed(1) : "0.0";
  const avgProfitPerTrip = s.trips > 0 ? Math.round(s.profit / s.trips) : 0;

  // Card 1: Operating Profit Margin
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.setLineWidth(0.8);
  doc.roundedRect(MARGIN, closingY, ratioW, ratioH, 4, 4, "FD");

  doc.setFont(FONT, "bold");
  doc.setFontSize(7);
  doc.setTextColor(21, 128, 61);
  doc.text("NET PROFIT MARGIN", MARGIN + 10, closingY + 14);

  doc.setFont(FONT, "bold");
  doc.setFontSize(12);
  doc.setTextColor(22, 163, 74);
  doc.text(`${profitMargin}% Margin`, MARGIN + 10, closingY + 29);

  doc.setFont(FONT, "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Total Profit: ${money(s.profit)}`, MARGIN + 10, closingY + 39);

  // Card 2: Fuel Expense Ratio
  const c2X = MARGIN + ratioW + ratioGap;
  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(253, 230, 138);
  doc.roundedRect(c2X, closingY, ratioW, ratioH, 4, 4, "FD");

  doc.setFont(FONT, "bold");
  doc.setFontSize(7);
  doc.setTextColor(180, 83, 9);
  doc.text("FUEL CONSUMPTION RATIO", c2X + 10, closingY + 14);

  doc.setFont(FONT, "bold");
  doc.setFontSize(12);
  doc.setTextColor(180, 83, 9);
  doc.text(`${fuelRatio}% of Revenue`, c2X + 10, closingY + 29);

  doc.setFont(FONT, "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Total Fuel: ${money(s.diesel)}`, c2X + 10, closingY + 39);

  // Card 3: Avg Profit Per Run
  const c3X = MARGIN + (ratioW + ratioGap) * 2;
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(c3X, closingY, ratioW, ratioH, 4, 4, "FD");

  doc.setFont(FONT, "bold");
  doc.setFontSize(7);
  doc.setTextColor(30, 64, 175);
  doc.text("AVG PROFIT PER TRIP", c3X + 10, closingY + 14);

  doc.setFont(FONT, "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 64, 175);
  doc.text(money(avgProfitPerTrip), c3X + 10, closingY + 29);

  doc.setFont(FONT, "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Average across ${s.trips} completed run(s)`, c3X + 10, closingY + 39);

  // 5B. Audit & Accounting Declaration Banner
  const declY = closingY + ratioH + 8;
  const declH = 26;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.75);
  doc.roundedRect(MARGIN, declY, contentWidth, declH, 4, 4, "FD");

  doc.setFont(FONT, "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(71, 85, 105);
  doc.text("AUDIT & SETTLEMENT DECLARATION:", MARGIN + 10, declY + 11);

  doc.setFont(FONT, "normal");
  doc.setFontSize(6.6);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `This computer-generated accounting statement certifies all trip revenues, fuel vouchers, driver payments, toll/other expenses, and EMI shares for ${report.vehicleLabel}. All ledger entries have been audited and reconciled for official records.`,
    MARGIN + 10,
    declY + 20,
    { maxWidth: contentWidth - 20 },
  );

  // 5C. Corporate Signatures & Authorization Block
  const sigY = declY + declH + 12;
  const sigColW = (contentWidth - 24) / 3;

  // Signatory 1: Prepared By
  const s1X = MARGIN;
  doc.setFont(FONT, "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("Prepared By:", s1X, sigY + 10);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.8);
  doc.line(s1X, sigY + 36, s1X + sigColW - 10, sigY + 36);
  doc.setFont(FONT, "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text("Accounts Executive / Operator", s1X, sigY + 46);

  // Signatory 2: Verified By
  const s2X = MARGIN + sigColW + 12;
  doc.setFont(FONT, "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("Verified By:", s2X, sigY + 10);
  doc.line(s2X, sigY + 36, s2X + sigColW - 10, sigY + 36);
  doc.setFont(FONT, "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text("Fleet Operations Manager", s2X, sigY + 46);

  // Signatory 3: Authorized Signatory & Seal
  const s3X = MARGIN + (sigColW + 12) * 2;
  doc.setFont(FONT, "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("Authorized Signatory:", s3X, sigY + 10);
  doc.line(s3X, sigY + 36, s3X + sigColW, sigY + 36);
  doc.setFont(FONT, "bold");
  doc.setFontSize(7);
  doc.setTextColor(30, 58, 138);
  const sealTitle = title.length > 26 ? title.slice(0, 24) + "…" : title;
  doc.text(`For ${sealTitle} [Seal]`, s3X, sigY + 46);

  /* ========================================================================== */
  /* 6. FOOTER & MULTI-PAGE NUMBERING                                           */
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

    // Decorative bottom transport accent bar
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
