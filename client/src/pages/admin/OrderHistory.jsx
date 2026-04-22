import React, { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  Search,
  CalendarDays,
  Download,
  ArrowLeft,
  X,
} from "lucide-react";
import { barOrdersAPI, orderAPI } from "../../services/api";
import { exportTableToPdf } from "../../utils/pdfExport";

const toInputDate = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
};

const formatDateForDisplay = (value) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN");
};

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return amount.toFixed(2);
};

const getStatusClassName = (status) => {
  switch (String(status || "").toUpperCase()) {
    case "COMPLETED":
      return "font-semibold text-[#0d9807]";
    case "CANCELLED":
      return "font-semibold text-red-600";
    case "RECEIVED":
      return "font-semibold text-blue-600";
    default:
      return "font-semibold text-amber-600";
  }
};

const getInitialFilters = () => {
  return {
    from: toInputDate(new Date()),
    to: toInputDate(new Date()),
    username: "",
  };
};

export default function OrderHistory() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(getInitialFilters);
  const [searchValue, setSearchValue] = useState("");
  const [quickSearch, setQuickSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailsByOrder, setDetailsByOrder] = useState({});
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");

  const appUser = useMemo(() => {
    try {
      const storedUser = localStorage.getItem("authUser");
      const parsed = storedUser ? JSON.parse(storedUser) : null;
      return parsed?.username || "";
    } catch (parseError) {
      return "";
    }
  }, []);

  const loadOrders = useCallback(
    async (activeFilters) => {
      try {
        setLoading(true);
        setError("");

        const response = await orderAPI.getOrderHistory({
          from: activeFilters.from || null,
          to: activeFilters.to || null,
          username: activeFilters.username.trim() || null,
          app_user: appUser || null,
        });

        setRows(response.data?.data || []);
      } catch (fetchError) {
        console.error("Failed to fetch order history:", fetchError);
        setRows([]);
        setError(
          fetchError.response?.data?.message || "Unable to load order history."
        );
      } finally {
        setLoading(false);
      }
    },
    [appUser]
  );

  const visibleRows = useMemo(() => {
    const term = quickSearch.trim().toLowerCase();
    const filteredRows = !term
      ? rows
      : rows.filter((row) => {
      if (row?.payment_status1 === "Total") {
        return true;
      }

      return [
        row?.order_num,
        row?.order_date,
        row?.first_name,
        row?.status,
        row?.payment_method,
        row?.payment_status1,
        row?.subtotal,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });

    return [...filteredRows].sort((left, right) => {
      const leftIsTotal = left?.payment_status1 === "Total";
      const rightIsTotal = right?.payment_status1 === "Total";

      if (leftIsTotal === rightIsTotal) {
        return 0;
      }

      return leftIsTotal ? 1 : -1;
    });
  }, [quickSearch, rows]);

  const userOptions = useMemo(() => {
    const names = rows
      .map((row) => row?.first_name)
      .filter((name) => name && name.trim() && name !== "Total");

    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setError("");
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSearch = () => {
    if (!filters.from || !filters.to) {
      setError("Please select both From and To dates before searching.");
      setRows([]);
      setHasSearched(false);
      return;
    }

    if (filters.from > filters.to) {
      setError("From date cannot be later than To date.");
      setRows([]);
      setHasSearched(false);
      return;
    }

    const nextFilters = {
      ...filters,
      username: searchValue,
    };

    setFilters(nextFilters);
    setHasSearched(true);
    loadOrders(nextFilters);
  };

  const handleDownload = () => {
    if (!visibleRows.length) {
      return;
    }

    exportTableToPdf({
      title: "Admin Order History",
      fileName: "admin-order-history.pdf",
      subtitle: `From: ${formatDateForDisplay(filters.from)}   To: ${formatDateForDisplay(
        filters.to
      )}   User Name: ${filters.username || "All"}`,
      headers: [
        "Order Number",
        "Order Date",
        "Name",
        "Order Status",
        "Payment Method",
        "Payment Status",
        "Amount",
      ],
      rows: visibleRows.map((row) => [
        row?.order_num ?? "",
        row?.order_date ?? "",
        row?.first_name ?? "",
        row?.status ?? "",
        row?.payment_method ?? "",
        row?.payment_status1 ?? "",
        formatCurrency(row?.subtotal),
      ]),
    });
  };

  const closeOrderModal = () => {
    setSelectedOrder(null);
    setDetailsError("");
  };

  const handleOrderClick = useCallback(async (orderNumber) => {
    if (!orderNumber) return;

    setSelectedOrder(orderNumber);
    setDetailsError("");

    if (detailsByOrder[orderNumber]) {
      return;
    }

    try {
      setDetailsLoading(true);
      const response = await barOrdersAPI.getOrderHistoryItemDetails(orderNumber);
      const payload = response.data?.data || {};

      setDetailsByOrder((prev) => ({
        ...prev,
        [orderNumber]: {
          items: payload.items || [],
          summary: payload.summary || null,
        },
      }));
    } catch (fetchError) {
      console.error("Failed to fetch order history item details:", fetchError);
      setDetailsError(
        fetchError.response?.data?.message || "Unable to load order details."
      );
    } finally {
      setDetailsLoading(false);
    }
  }, [detailsByOrder]);

  const selectedOrderDetails = selectedOrder ? detailsByOrder[selectedOrder] : null;
  const selectedOrderItems = selectedOrderDetails?.items || [];
  const selectedOrderTotal =
    Number(selectedOrderDetails?.summary?.totalAmount) ||
    selectedOrderItems.reduce((sum, item) => sum + Number(item?.subtotal || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 relative">
      <div className="absolute top-16 left-12 h-72 w-72 rounded-full bg-afmc-maroon/10 blur-3xl" />
      <div className="absolute bottom-20 right-20 h-80 w-80 rounded-full bg-afmc-maroon2/10 blur-3xl" />

      <div className="relative z-10 p-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-gray-800">Order History</h1>
          <button
            type="button"
            onClick={() => navigate("/admin/dashboard")}
            className="flex items-center gap-2 rounded-full border border-white/60 bg-white px-5 py-2.5 text-gray-700 shadow hover:shadow-md"
          >
            <ArrowLeft size={16} />
            Go To Dashboard
          </button>
        </div>

        <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur-sm">
          <div className="mb-6 flex flex-wrap items-end gap-4">
            <label>
              <span className="mb-2 block text-sm font-medium text-gray-700">From</span>
              <div className="flex items-center rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <input
                  type="date"
                  name="from"
                  value={filters.from}
                  onChange={handleFilterChange}
                  className="w-full bg-transparent text-gray-800 outline-none [color-scheme:light]"
                />
                <CalendarDays size={16} className="ml-3 text-gray-500" />
              </div>
            </label>

            <label>
              <span className="mb-2 block text-sm font-medium text-gray-700">To</span>
              <div className="flex items-center rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <input
                  type="date"
                  name="to"
                  value={filters.to}
                  onChange={handleFilterChange}
                  className="w-full bg-transparent text-gray-800 outline-none [color-scheme:light]"
                />
                <CalendarDays size={16} className="ml-3 text-gray-500" />
              </div>
            </label>

            <label className="min-w-[220px] flex-1">
              <span className="mb-2 block text-sm font-medium text-gray-700">User Name</span>
              <div className="flex items-center rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <input
                  type="text"
                  list="admin-order-usernames"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Search user"
                  className="w-full bg-transparent text-gray-800 outline-none placeholder:text-gray-400"
                />
                <datalist id="admin-order-usernames">
                  {userOptions.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
                <ChevronDown size={16} className="ml-3 text-gray-500" />
              </div>
            </label>

            <button
              type="button"
              onClick={handleSearch}
              className="flex items-center gap-2 rounded-2xl bg-[#5b5b5b] px-6 py-3 font-semibold text-white shadow hover:shadow-md"
            >
              <Search size={16} />
              Search
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="ml-auto flex items-center gap-2 rounded-2xl bg-afmc-maroon px-6 py-3 font-semibold text-white shadow transition hover:bg-afmc-maroon2 hover:shadow-md"
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

          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3">
            <Search size={16} className="text-gray-400" />
            <input
              type="text"
              value={quickSearch}
              onChange={(event) => setQuickSearch(event.target.value)}
              placeholder="Quick search in results"
              className="w-full bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400"
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">
                    Order Number
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    Order Date
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    Order Status
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    Payment Method
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    Payment Status
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-gray-500" colSpan="7">
                      Loading order history...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-red-600" colSpan="7">
                      {error}
                    </td>
                  </tr>
                ) : !hasSearched ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-gray-500" colSpan="7">
                      Select From and To dates, then click Search to view order history.
                    </td>
                  </tr>
                ) : visibleRows.length ? (
                  visibleRows.map((row, index) => {
                    const isTotalRow = row?.payment_status1 === "Total";

                    return (
                      <tr
                        key={`${row?.order_num ?? "total"}-${index}`}
                        className={`border-t border-gray-100 ${
                          isTotalRow
                            ? "bg-afmc-maroon/5 font-semibold text-gray-800"
                            : "text-gray-700 transition hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-4 py-3 text-afmc-maroon">
                          {isTotalRow ? (
                            row?.order_num || ""
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOrderClick(row?.order_num)}
                              className="font-medium text-afmc-maroon transition hover:underline"
                            >
                              {row?.order_num || ""}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {row?.order_date || ""}
                        </td>
                        <td className="px-4 py-3">
                          {isTotalRow ? "" : row?.first_name || "-"}
                        </td>
                        <td
                          className={`px-4 py-3 ${
                            row?.status === "Completed"
                              ? "font-semibold text-[#0d9807]"
                              : ""
                          }`}
                        >
                          {row?.status || ""}
                        </td>
                        <td className="px-4 py-3">
                          {row?.payment_method || ""}
                        </td>
                        <td className="px-4 py-3">
                          {row?.payment_status1 || ""}
                        </td>
                        <td className="px-4 py-3">
                          {formatCurrency(row?.subtotal)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-4 py-8 text-center text-gray-500" colSpan="7">
                      No orders found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {selectedOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="relative w-full max-w-6xl rounded-[28px] border border-white/70 bg-white/95 shadow-2xl backdrop-blur">
            <button
              type="button"
              onClick={closeOrderModal}
              className="absolute right-5 top-5 rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close order details"
            >
              <X size={20} />
            </button>

            <div className="border-b border-gray-200 px-6 py-5">
              <h2 className="text-3xl font-semibold text-gray-800">Order History</h2>
            </div>

            <div className="bg-[radial-gradient(circle_at_center,_rgba(128,0,0,0.08),_transparent_55%)] px-6 py-5">
              <p className="text-xl text-gray-800">
                <span className="font-semibold">Order Number :</span>{" "}
                <span className="text-sky-800">{selectedOrder}</span>
              </p>

              <div className="mt-5 overflow-hidden rounded-2xl border border-gray-200 bg-white/90 shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] text-sm">
                    <thead className="bg-gray-50 text-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Item Name</th>
                        <th className="px-4 py-3 text-left font-medium">Quantity</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                        <th className="px-4 py-3 text-left font-medium">Type</th>
                        <th className="px-4 py-3 text-left font-medium">Price</th>
                        <th className="px-4 py-3 text-left font-medium">Preparation Charges</th>
                        <th className="px-4 py-3 text-left font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailsLoading ? (
                        <tr>
                          <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                            Loading order details...
                          </td>
                        </tr>
                      ) : detailsError ? (
                        <tr>
                          <td colSpan="7" className="px-4 py-8 text-center text-red-600">
                            {detailsError}
                          </td>
                        </tr>
                      ) : selectedOrderItems.length ? (
                        <>
                          {selectedOrderItems.map((item, index) => (
                            <tr key={`${item?.order_line_id || index}-${index}`} className="border-t border-gray-100 text-gray-700">
                              <td className="px-4 py-3">{item?.item_name || "-"}</td>
                              <td className="px-4 py-3">{item?.quantity ?? "-"}</td>
                              <td className={`px-4 py-3 ${getStatusClassName(item?.status)}`}>
                                {item?.status || "Pending"}
                              </td>
                              <td className="px-4 py-3">{item?.type || "NA"}</td>
                              <td className="px-4 py-3">{formatCurrency(item?.price)}</td>
                              <td className="px-4 py-3">{formatCurrency(item?.pr_charges)}</td>
                              <td className="px-4 py-3">{formatCurrency(item?.subtotal)}</td>
                            </tr>
                          ))}
                          <tr className="border-t border-gray-200 bg-gray-50/80 text-red-600">
                            <td colSpan="5" className="px-4 py-4" />
                            <td className="px-4 py-4 text-left text-xl font-medium">Total</td>
                            <td className="px-4 py-4 text-left text-xl font-medium">
                              {formatCurrency(selectedOrderTotal)}
                            </td>
                          </tr>
                        </>
                      ) : (
                        <tr>
                          <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                            No items found for this order.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
