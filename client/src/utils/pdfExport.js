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
  title,
  fileName,
  headers,
  rows,
  subtitle,
  orientation = "landscape",
  format = "a4",
}) => {
  const exportDoc = async () => {
  const doc = new jsPDF({
    orientation,
    unit: "pt",
    format,
  });

  const leftMargin = 40;
  const topMargin = 34;
  const logoBox = { w: 34, h: 34 };
  const logoGap = 10;
  const titleX = leftMargin + logoBox.w + logoGap;

  try {
    const logo = await loadImage(afmcLogo);
    const naturalW = Number(logo.naturalWidth || logo.width || 1);
    const naturalH = Number(logo.naturalHeight || logo.height || 1);
    const scale = Math.min(logoBox.w / naturalW, logoBox.h / naturalH);
    const drawW = Math.max(1, naturalW * scale);
    const drawH = Math.max(1, naturalH * scale);
    const drawX = leftMargin + (logoBox.w - drawW) / 2;
    const drawY = 18 + (logoBox.h - drawH) / 2;
    doc.addImage(logo, "PNG", drawX, drawY, drawW, drawH);
  } catch (_error) {
    // If logo fails to load, continue without it.
  }

  doc.setTextColor(107, 26, 79);
  doc.setFontSize(16);
  doc.text(title, titleX, topMargin);

  doc.setDrawColor(255, 211, 99);
  doc.setLineWidth(2);
  doc.line(leftMargin, 58, doc.internal.pageSize.getWidth() - leftMargin, 58);

  let startY = 76;

  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(subtitle, titleX, startY);
    startY += 14;
  }

  autoTable(doc, {
    startY,
    head: [headers],
    body: rows,
    styles: {
      fontSize: 9,
      cellPadding: 5,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [107, 26, 79],
      textColor: 255,
    },
    margin: { left: 40, right: 40 },
  });

  doc.save(fileName);
  };

  // Fire and forget: callers don't need to `await` this.
  void exportDoc();
};
