import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const exportTableToPdf = ({
  title,
  fileName,
  headers,
  rows,
  subtitle,
}) => {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
  });

  doc.setFontSize(16);
  doc.text(title, 40, 40);

  let startY = 60;

  if (subtitle) {
    doc.setFontSize(10);
    doc.text(subtitle, 40, startY);
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
      fillColor: [107, 95, 95],
      textColor: 255,
    },
    margin: { left: 40, right: 40 },
  });

  doc.save(fileName);
};
