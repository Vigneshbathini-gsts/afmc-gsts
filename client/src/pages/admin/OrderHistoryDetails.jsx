import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import { orderAPI } from "../../services/api";
import { exportTableToPdf } from "../../utils/pdfExport";
import { toInitCap } from "../../utils/textFormat";

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return amount.toFixed(2);
};

const formatDateForDisplay = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN");
};

const isTotalRow = (row) => row?.status === "Total";

const isFreeItemRow = (row) => {
  if (isTotalRow(row)) return false;
  const status = String(row?.status || "").trim().toUpperCase();
  if (status === "CANCELLED") return false;
  const priceValue = Number(row?.price || 0);
  const subtotalValue = Number(row?.subtotal || 0);
  return priceValue === 0 && subtotalValue === 0;
};

const TABS = [
  { key: "order-wise", label: "Order-wise Report" },
  { key: "item-wise", label: "Item-wise Report" },
];

export default function OrderHistoryDetails() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const orderDate = searchParams.get("date") || "";
  const username = searchParams.get("username") || "";
  const paymentStatus = searchParams.get("paymentStatus") || "";

  const [activeTab, setActiveTab] = useState("order-wise");
  const [orderWiseRows, setOrderWiseRows] = useState([]);
  const [itemWiseRows, setItemWiseRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadReports = useCallback(async () => {
    if (!orderDate) {
      setError("No order date was provided.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const params = {
        orderDate,
        username: username || null,
        paymentStatus: paymentStatus || null,
      };

      const [orderWiseRes, itemWiseRes] = await Promise.all([
        orderAPI.getOrderWiseReport(params),
        orderAPI.getItemWiseReport(params),
      ]);

      setOrderWiseRows(orderWiseRes.data?.data || []);
      setItemWiseRows(itemWiseRes.data?.data || []);
    } catch (fetchError) {
      console.error("Failed to fetch order history detail report:", fetchError);
      setOrderWiseRows([]);
      setItemWiseRows([]);
      setError(
        fetchError.response?.data?.message || "Unable to load the detail report."
      );
    } finally {
      setLoading(false);
    }
  }, [orderDate, username, paymentStatus]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const rows = activeTab === "order-wise" ? orderWiseRows : itemWiseRows;

  const grandTotal = useMemo(() => {
    const totalRow = rows.find((row) => isTotalRow(row));
    if (totalRow) return Number(totalRow.subtotal || 0);
    return rows.reduce((sum, row) => sum + Number(row?.subtotal || 0), 0);
  }, [rows]);

  const totalPrepCharges = useMemo(() => {
    const totalRow = rows.find((row) => isTotalRow(row));
    if (totalRow) return Number(totalRow.prep_charges || 0);
    return rows.reduce((sum, row) => sum + Number(row?.prep_charges || 0), 0);
  }, [rows]);

  const totalProfit = useMemo(() => {
    const totalRow = rows.find((row) => isTotalRow(row));
    if (totalRow) return Number(totalRow.profit || 0);
    return rows.reduce((sum, row) => sum + Number(row?.profit || 0), 0);
  }, [rows]);

  const handleDownload = () => {
    if (!rows.length) return;

    const isOrderWise = activeTab === "order-wise";
    const headers = isOrderWise
      ? ["Order #", "Item Name", "Type", "Quantity", "Price", "Prep Charges", "Profit", "Status", "Subtotal"]
      : ["Item Name", "Type", "Quantity", "Avg. Price", "Prep Charges", "Profit", "Status", "Subtotal"];

    exportTableToPdf({
      title: isOrderWise ? "Order-wise Report" : "Item-wise Report",
      fileName: `admin-order-history-${activeTab}-${orderDate}.pdf`,
      subtitle: `Date: ${formatDateForDisplay(orderDate)}   User: ${username || "All"}   Payment: ${paymentStatus || "All"}`,
      headers,
      rows: rows.map((row) => {
        const freeItem = isFreeItemRow(row);
        const itemNameLabel = isTotalRow(row)
          ? "Total"
          : `${toInitCap(row?.item_name) ?? ""}${freeItem ? " (Free item)" : ""}`;

        return isOrderWise
          ? [
              isTotalRow(row) ? "" : row?.order_num ?? "",
              itemNameLabel,
              isTotalRow(row) ? "" : row?.type ?? "",
              isTotalRow(row) ? "" : row?.quantity ?? "",
              isTotalRow(row) ? "" : formatCurrency(row?.price),
              formatCurrency(row?.prep_charges),
              formatCurrency(row?.profit),
              isTotalRow(row) ? "" : row?.status ?? "",
              formatCurrency(row?.subtotal),
            ]
          : [
              itemNameLabel,
              isTotalRow(row) ? "" : row?.type ?? "",
              isTotalRow(row) ? "" : row?.quantity ?? "",
              isTotalRow(row) ? "" : formatCurrency(row?.price),
              formatCurrency(row?.prep_charges),
              formatCurrency(row?.profit),
              isTotalRow(row) ? "" : row?.status ?? "",
              formatCurrency(row?.subtotal),
            ];
      }),
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 relative">
      <div className="absolute top-16 left-12 h-72 w-72 rounded-full bg-afmc-maroon/10 blur-3xl" />
      <div className="absolute bottom-20 right-20 h-80 w-80 rounded-full bg-afmc-maroon2/10 blur-3xl" />

      <div className="relative z-10 px-0 py-4 md:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Order History Details</h1>
            <p className="mt-1 text-sm text-gray-600">
              {formatDateForDisplay(orderDate)}
              {username ? ` - ${toInitCap(username)}` : ""}
              {paymentStatus ? ` - ${paymentStatus}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/admin/order-history")}
            className="inline-flex items-center gap-2 rounded-full border border-afmc-gold/30 bg-white px-4 py-2 text-gray-700 shadow transition hover:bg-afmc-maroon/5 hover:text-afmc-maroon hover:shadow-md"
          >
            <ArrowLeft size={16} />
            Back to Order History
          </button>
        </div>

        <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur-sm">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex rounded-2xl border border-gray-200 bg-gray-50 p-1">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                    activeTab === tab.key
                      ? "bg-white text-afmc-maroon shadow"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-2xl bg-afmc-maroon px-5 py-3 font-semibold text-white shadow transition hover:bg-afmc-maroon2 hover:shadow-md"
            >
              <Download size={16} />
              Download PDF
            </button>
          </div>

          {error ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              {activeTab === "order-wise" ? (
                <table className="w-full min-w-[1100px] text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Order #</th>
                      <th className="px-4 py-3 text-left font-medium">Item Name</th>
                      <th className="px-4 py-3 text-left font-medium">Type</th>
                      <th className="px-4 py-3 text-left font-medium">Quantity</th>
                      <th className="px-4 py-3 text-left font-medium">Price</th>
                      <th className="px-4 py-3 text-left font-medium">Prep Charges</th>
                      <th className="px-4 py-3 text-left font-medium">Profit</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-gray-500" colSpan="9">
                          Loading report...
                        </td>
                      </tr>
                    ) : orderWiseRows.length ? (
                      orderWiseRows.map((row, index) => {
                        const totalRow = isTotalRow(row);
                        const freeItem = isFreeItemRow(row);
                        return (
                          <tr
                            key={`${row?.order_line_id ?? "total"}-${index}`}
                            className={`border-t border-gray-100 ${
                              totalRow
                                ? "bg-afmc-maroon/5 font-semibold text-gray-800"
                                : "text-gray-700"
                            }`}
                          >
                            <td className="px-4 py-3">{totalRow ? "" : row?.order_num ?? ""}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                <span>{totalRow ? "Total" : toInitCap(row?.item_name) || "NA"}</span>
                                {freeItem && (
                                  <span className="text-xs font-semibold text-amber-600">Free item</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">{totalRow ? "" : row?.type || "NA"}</td>
                            <td className="px-4 py-3">{totalRow ? "" : row?.quantity ?? ""}</td>
                            <td className="px-4 py-3">{totalRow ? "" : formatCurrency(row?.price)}</td>
                            <td className="px-4 py-3 font-medium">
                              {formatCurrency(row?.prep_charges)}
                            </td>
                            <td className="px-4 py-3 font-medium text-green-600">
                              {formatCurrency(row?.profit)}
                            </td>
                            <td className="px-4 py-3">{totalRow ? "" : row?.status || ""}</td>
                            <td className="px-4 py-3 font-semibold">
                              {formatCurrency(row?.subtotal)}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td className="px-4 py-8 text-center text-gray-500" colSpan="9">
                          No orders found for this selection.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full min-w-[1020px] text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Item Name</th>
                      <th className="px-4 py-3 text-left font-medium">Type</th>
                      <th className="px-4 py-3 text-left font-medium">Quantity</th>
                      <th className="px-4 py-3 text-left font-medium">Avg. Price</th>
                      <th className="px-4 py-3 text-left font-medium">Prep Charges</th>
                      <th className="px-4 py-3 text-left font-medium">Profit</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-gray-500" colSpan="8">
                          Loading report...
                        </td>
                      </tr>
                    ) : itemWiseRows.length ? (
                      itemWiseRows.map((row, index) => {
                        const totalRow = isTotalRow(row);
                        const freeItem = isFreeItemRow(row);
                        return (
                          <tr
                            key={`${row?.item_id ?? "total"}-${index}`}
                            className={`border-t border-gray-100 ${
                              totalRow
                                ? "bg-afmc-maroon/5 font-semibold text-gray-800"
                                : "text-gray-700"
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                <span>{totalRow ? "Total" : toInitCap(row?.item_name) || "NA"}</span>
                                {freeItem && (
                                  <span className="text-xs font-semibold text-amber-600">Free item</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">{totalRow ? "" : row?.type || "NA"}</td>
                            <td className="px-4 py-3">{totalRow ? "" : row?.quantity ?? ""}</td>
                            <td className="px-4 py-3">{totalRow ? "" : formatCurrency(row?.price)}</td>
                            <td className="px-4 py-3 font-medium">
                              {formatCurrency(row?.prep_charges)}
                            </td>
                            <td className="px-4 py-3 font-medium text-green-600">
                              {formatCurrency(row?.profit)}
                            </td>
                            <td className="px-4 py-3">{totalRow ? "" : row?.status || ""}</td>
                            <td className="px-4 py-3 font-semibold">
                              {formatCurrency(row?.subtotal)}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td className="px-4 py-8 text-center text-gray-500" colSpan="8">
                          No items found for this selection.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Summary Footer */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
              <span className="text-gray-600">Total Prep Charges:</span>
              <span className="ml-2 font-semibold text-afmc-maroon">
                Rs. {formatCurrency(totalPrepCharges)}
              </span>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
              <span className="text-gray-600">Total Profit:</span>
              <span className="ml-2 font-semibold text-green-600">
                Rs. {formatCurrency(totalProfit)}
              </span>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
              <span className="text-gray-600">Grand Total:</span>
              <span className="ml-2 font-semibold text-afmc-maroon">
                Rs. {formatCurrency(grandTotal)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}