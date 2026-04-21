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
}) => {
  const exportDoc = async () => {
    const doc = new jsPDF({
      orientation,
      unit: "pt",
      format,
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const leftMargin = 40;
    const rightMargin = pageWidth - 40;
    const centerX = pageWidth / 2;
    let currentY = 40;

    // Logo at top left (optional)
    if (showLogo) {
      const logoBox = { w: 38, h: 38 };
      try {
        const logo = await loadImage(afmcLogo);
        const naturalW = Number(logo.naturalWidth || logo.width || 1);
        const naturalH = Number(logo.naturalHeight || logo.height || 1);
        const scale = Math.min(logoBox.w / naturalW, logoBox.h / naturalH);
        const drawW = Math.max(1, naturalW * scale);
        const drawH = Math.max(1, naturalH * scale);
        const drawX = leftMargin;
        const drawY = 18;
        doc.addImage(logo, "PNG", drawX, drawY, drawW, drawH);
      } catch (_error) {
        // If logo fails to load, continue without it.
      }
    }

    // Main Header (Centered)
    doc.setTextColor(107, 26, 79);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(mainHeader, centerX, currentY, { align: "center" });

    // Title/Subheader (Centered)
    if (title) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(80, 80, 80);
      doc.text(title, centerX, currentY + 24, { align: "center" });
      currentY += 48;
    } else {
      currentY += 24;
    }

    // Date Range Subtitle (Centered)
    if (subtitle) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(subtitle, centerX, currentY, { align: "center" });
      currentY += 20;
    }

    // Report generation info (left aligned)
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    const generatedDate = `Generated on: ${new Date().toLocaleString()}`;
    doc.text(generatedDate, leftMargin, currentY);
    currentY += 12;

    // Summary - Total records count (left aligned)
    const totalRecords = rows.length;
    doc.setFontSize(10);
    doc.setTextColor(107, 26, 79);
    doc.setFont("helvetica", "bold");
    doc.text(`Total Records: ${totalRecords}`, leftMargin, currentY);
    currentY += 10;

    // Reset font for table
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);

    // Main Table
    autoTable(doc, {
      startY: currentY,
      head: [headers],
      body: rows,
      styles: {
        fontSize: 9,
        cellPadding: 6,
        overflow: "linebreak",
        valign: "middle",
        textColor: [40, 40, 40],
        lineColor: [200, 200, 200],
        lineWidth: 0.5,
      },
      headStyles: {
        fillColor: [107, 26, 79], // AFMC Maroon
        textColor: 255,
        fontStyle: "bold",
        fontSize: 10,
        halign: "center",
      },
      alternateRowStyles: {
        fillColor: [248, 248, 248],
      },
      margin: { left: leftMargin, right: 40 },
      tableWidth: "auto",
    });

    // Get final Y position after table
    const finalY = doc.lastAutoTable.finalY || currentY + 100;

    // Footer line
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.5);
    doc.line(leftMargin, finalY + 15, rightMargin, finalY + 15);

    // Footer text (centered)
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.setFont("helvetica", "italic");
    doc.text(footerText, centerX, finalY + 28, { align: "center" });

    // Page number
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth - 40,
        doc.internal.pageSize.getHeight() - 20,
        { align: "right" }
      );
    }

    doc.save(fileName);
  };

  // Fire and forget: callers don't need to `await` this.
  void exportDoc();
};