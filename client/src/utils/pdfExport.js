import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import afmcLogo from "../assets/AFMC_Logo.png";

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";

    image.onload = () => resolve(image);
    image.onerror = (error) => reject(error);

    image.src = src;
  });

export const exportTableToPdf = ({
  mainHeader = "ARMED FORCES MEDICAL COLLEGE",
  title,
  fileName,
  headers,
  rows,
  subtitle,
  footerText = "Armed Forces Medical College",
  showLogo = true,
  orientation = "landscape",
  format = "a4",
  bodyStyles = {},
  columnStyles = {},
}) => {
  const exportDoc = async () => {
    const doc = new jsPDF({
      orientation,
      unit: "pt",
      format,
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const leftMargin = 40;
    const rightMargin = pageWidth - 40;
    const centerX = pageWidth / 2;

    let currentY = 40;

    // ============================================================
    // LOGO
    // ============================================================

    if (showLogo) {
      const logoBox = {
        w: 38,
        h: 38,
      };

      try {
        const logo = await loadImage(afmcLogo);

        const naturalW = Number(
          logo.naturalWidth || logo.width || 1
        );

        const naturalH = Number(
          logo.naturalHeight || logo.height || 1
        );

        const scale = Math.min(
          logoBox.w / naturalW,
          logoBox.h / naturalH
        );

        const drawW = Math.max(1, naturalW * scale);
        const drawH = Math.max(1, naturalH * scale);

        const drawX = leftMargin;
        const drawY = 18;

        doc.addImage(
          logo,
          "PNG",
          drawX,
          drawY,
          drawW,
          drawH
        );
      } catch (_error) {
        // Continue without logo if image loading fails.
      }
    }

    // ============================================================
    // MAIN HEADER
    // ============================================================

    doc.setTextColor(107, 26, 79);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");

    doc.text(
      mainHeader,
      centerX,
      currentY,
      {
        align: "center",
      }
    );

    // ============================================================
    // TITLE
    // ============================================================

    if (title) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(80, 80, 80);

      doc.text(
        title,
        centerX,
        currentY + 24,
        {
          align: "center",
        }
      );

      currentY += 48;
    } else {
      currentY += 24;
    }

    // ============================================================
    // SUBTITLE / FILTER INFORMATION
    //
    // IMPORTANT:
    // Long item lists are automatically wrapped here.
    //
    // Example:
    //
    // From: 2026-09-08 | To: 2026-09-08 | Items: Virgin Mary,
    // Sprite 250 ml, Smoke Classic, Rampur, Cheese Pizza Finger,
    // The Chartreuse Swizzle, Grey Goose Vodka, Sula Red Small
    //
    // ============================================================

    if (subtitle) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);

      // Available width for subtitle
      const subtitleWidth = pageWidth - leftMargin - 40;

      // Automatically wrap long subtitle
      const subtitleLines = doc.splitTextToSize(
        subtitle,
        subtitleWidth
      );

      const subtitleLineHeight = 15;

      doc.text(
        subtitleLines,
        centerX,
        currentY,
        {
          align: "center",
          lineHeightFactor: 1.15,
        }
      );

      // Move currentY based on number of lines
      currentY +=
        subtitleLines.length * subtitleLineHeight + 8;
    }

    // ============================================================
    // GENERATED DATE
    // ============================================================

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);

    const generatedDate = `Generated on: ${new Date().toLocaleString()}`;

    doc.text(
      generatedDate,
      leftMargin,
      currentY
    );

    currentY += 14;

    // ============================================================
    // TOTAL RECORDS
    // ============================================================

    const totalRecords = rows.length;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(107, 26, 79);

    doc.text(
      `Total Records: ${totalRecords}`,
      leftMargin,
      currentY
    );

    currentY += 12;

    // ============================================================
    // RESET FONT
    // ============================================================

    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);

    // ============================================================
    // MAIN TABLE
    // ============================================================

    autoTable(doc, {
      startY: currentY,

      head: [headers],

      body: rows,

      styles: {
        fontSize: 9,
        cellPadding: 6,

        // Allows table cell text to wrap
        overflow: "linebreak",

        valign: "middle",
        halign: "center",

        textColor: [40, 40, 40],

        lineColor: [200, 200, 200],
        lineWidth: 0.5,
      },

      headStyles: {
        fillColor: [107, 26, 79],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 10,
        halign: "center",
      },

      bodyStyles,

      columnStyles,

      alternateRowStyles: {
        fillColor: [248, 248, 248],
      },

      margin: {
        left: leftMargin,
        right: 40,
      },

      tableWidth: "auto",
    });

    // ============================================================
    // FINAL TABLE POSITION
    // ============================================================

    const finalY =
      doc.lastAutoTable?.finalY ||
      currentY + 100;

    // ============================================================
    // FOOTER LINE
    // ============================================================

    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.5);

    doc.line(
      leftMargin,
      finalY + 15,
      rightMargin,
      finalY + 15
    );

    // ============================================================
    // FOOTER TEXT
    // ============================================================

    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.setFont("helvetica", "italic");

    doc.text(
      footerText,
      centerX,
      finalY + 28,
      {
        align: "center",
      }
    );

    // ============================================================
    // PAGE NUMBERS
    // ============================================================

    const pageCount =
      doc.internal.getNumberOfPages();

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);

      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.setFont("helvetica", "normal");

      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth - 40,
        pageHeight - 20,
        {
          align: "right",
        }
      );
    }

    // ============================================================
    // SAVE PDF
    // ============================================================

    doc.save(fileName);
  };

  // Fire and forget
  void exportDoc();
};