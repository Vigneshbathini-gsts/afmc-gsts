import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FaSearch, FaArrowLeft, FaDownload } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { inventoryAPI } from "../../services/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const toInputDate = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
};

const formatDisplayDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
};

const formatReportDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
};

export default function StockReports() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("in");
  const [fromDate, setFromDate] = useState(toInputDate(new Date()));
  const [toDate, setToDate] = useState(toInputDate(new Date()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stockInRows, setStockInRows] = useState([]);
  const [stockOutRows, setStockOutRows] = useState([]);

  const params = useMemo(() => {
    return {
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    };
  }, [fromDate, toDate]);

  const fetchStockIn = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await inventoryAPI.getStockInReport(params);
      setStockInRows(response.data.data || []);
    } catch (err) {
      console.error("Failed to load stock-in report:", err);
      setError("Failed to load stock-in report.");
    } finally {
      setLoading(false);
    }
  }, [params]);

  const fetchStockOut = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await inventoryAPI.getStockOutReport(params);
      setStockOutRows(response.data.data || []);
    } catch (err) {
      console.error("Failed to load stock-out report:", err);
      setError("Failed to load stock-out report.");
    } finally {
      setLoading(false);
    }
  }, [params]);

  const handleSearch = useCallback(async () => {
    if (activeTab === "in") {
      await fetchStockIn();
    } else {
      await fetchStockOut();
    }
  }, [activeTab, fetchStockIn, fetchStockOut]);

  useEffect(() => {
    handleSearch();
  }, [handleSearch]);

  const rows = activeTab === "in" ? stockInRows : stockOutRows;

  const downloadPdf = () => {
    if (!rows || rows.length === 0) return;

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 40;
    let cursorY = 40;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("ARMED FORCES  MEDICAL  COLLEGE", pageWidth / 2, cursorY, {
      align: "center",
    });
    cursorY += 18;

    doc.setFontSize(12);
    doc.text(
      activeTab === "in" ? "Stock In Report" : "Stock Out Report",
      pageWidth / 2,
      cursorY,
      { align: "center" }
    );
    cursorY += 18;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(
      `From: ${formatReportDate(fromDate)}    To: ${formatReportDate(toDate)}`,
      marginX,
      cursorY
    );
    cursorY += 10;

    const isStockIn = activeTab === "in";
    const tableRows = rows.map((row) =>
      isStockIn
        ? [
            row.item_code,
            row.item_name,
            row.batch_id || "-",
            formatReportDate(row.creation_date),
            row.ac_unit || "Nos",
            row.stock,
            row.total_price ?? row.totalprice ?? 0,
          ]
        : [
            row.item_code,
            row.item_name,
            formatReportDate(row.creation_date),
            row.ac_unit || "Nos",
            row.stock,
            row.total_price ?? row.totalprice ?? 0,
          ]
    );

    autoTable(doc, {
      startY: cursorY + 10,
      head: isStockIn
        ? [[
            "Item Code",
            "Item Name",
            "Batch ID",
            "Transaction Date",
            "A/c Unit",
            "Stock",
            "Total Price",
          ]]
        : [[
            "Item Code",
            "Item Name",
            "Transaction Date",
            "A/c Unit",
            "Stock",
            "Total Price",
          ]],
      body: tableRows,
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 4,
      },
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: [60, 60, 60],
      },
      columnStyles: {
        ...(isStockIn
          ? {
              0: { cellWidth: 55 },
              1: { cellWidth: 110 },
              2: { cellWidth: 70 },
              3: { cellWidth: 85 },
              4: { cellWidth: 55 },
              5: { cellWidth: 45 },
              6: { cellWidth: 65 },
            }
          : {
              0: { cellWidth: 60 },
              1: { cellWidth: 150 },
              2: { cellWidth: 90 },
              3: { cellWidth: 60 },
              4: { cellWidth: 50 },
              5: { cellWidth: 70 },
            }),
      },
      margin: { left: marginX, right: marginX },
    });

    doc.save(activeTab === "in" ? "stock-in-report.pdf" : "stock-out-report.pdf");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-white relative">
      <div className="absolute top-16 left-12 w-72 h-72 bg-[#d70652]/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-[#ff025e]/10 rounded-full blur-3xl"></div>

      <div className="p-8 relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <h1 className="text-2xl font-semibold text-gray-800">
            Stock In/Out Report
          </h1>
          <button
            type="button"
            onClick={() => navigate("/admin/dashboard")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white shadow hover:shadow-md border border-white/60 text-gray-700"
          >
            <FaArrowLeft />
            Go To Dashboard
          </button>
        </div>

        <div className="bg-white/80 border border-white/60 rounded-3xl shadow-xl backdrop-blur-sm p-6">
          <div className="flex flex-wrap items-end gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                From
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800 focus:border-[#ff025e] focus:ring-2 focus:ring-[#ff025e]/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                To
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800 focus:border-[#ff025e] focus:ring-2 focus:ring-[#ff025e]/20"
              />
            </div>

            <button
              type="button"
              onClick={handleSearch}
              className="px-6 py-3 rounded-2xl bg-[#5b5b5b] text-white font-semibold flex items-center gap-2 shadow hover:shadow-md"
            >
              <FaSearch />
              Search
            </button>

            <button
              type="button"
              onClick={downloadPdf}
              className="ml-auto px-6 py-3 rounded-2xl bg-[#d70652] text-white font-semibold flex items-center gap-2 shadow hover:shadow-md"
            >
              <FaDownload />
              Download PDF
            </button>
          </div>

          <div className="flex rounded-2xl overflow-hidden border border-gray-200 bg-white mb-6">
            <button
              type="button"
              onClick={() => setActiveTab("in")}
              className={`flex-1 py-3 text-sm font-semibold ${
                activeTab === "in"
                  ? "bg-[#d70652]/10 text-[#d70652] border-b-2 border-[#d70652]"
                  : "text-gray-600"
              }`}
            >
              Stock In Report
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("out")}
              className={`flex-1 py-3 text-sm font-semibold ${
                activeTab === "out"
                  ? "bg-[#d70652]/10 text-[#d70652] border-b-2 border-[#d70652]"
                  : "text-gray-600"
              }`}
            >
              Stock Out Report
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Item Code</th>
                  <th className="px-4 py-3 text-left font-medium">Item Name</th>
                  {activeTab === "in" && (
                    <th className="px-4 py-3 text-left font-medium">Batch ID</th>
                  )}
                  <th className="px-4 py-3 text-left font-medium">
                    Transaction Date
                  </th>
                  <th className="px-4 py-3 text-left font-medium">A/c Unit</th>
                  <th className="px-4 py-3 text-left font-medium">Stock</th>
                  <th className="px-4 py-3 text-left font-medium">Total Price</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={activeTab === "in" ? 7 : 6} className="px-4 py-6 text-center text-gray-500">
                      Loading report...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={activeTab === "in" ? 7 : 6} className="px-4 py-6 text-center text-gray-500">
                      No records found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, idx) => (
                    <tr key={`${row.item_code}-${idx}`} className="border-t border-gray-100">
                      <td className="px-4 py-3">{row.item_code}</td>
                      <td className="px-4 py-3">{row.item_name}</td>
                      {activeTab === "in" && (
                        <td className="px-4 py-3">{row.batch_id || "-"}</td>
                      )}
                      <td className="px-4 py-3">
                        {formatDisplayDate(row.creation_date)}
                      </td>
                      <td className="px-4 py-3">{row.ac_unit || "Nos"}</td>
                      <td className="px-4 py-3">{row.stock}</td>
                      <td className="px-4 py-3">
                        {row.total_price ?? row.totalprice ?? 0}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
