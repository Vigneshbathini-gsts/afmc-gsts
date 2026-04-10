import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FaArrowLeft, FaSearch } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import OrderDetailsModal from "../OrderDetailsModal";

const toInputDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString();
  }

  const fallback = new Date(String(value).replace(" ", "T"));
  if (!Number.isNaN(fallback.getTime())) {
    return fallback.toLocaleDateString();
  }

  return String(value);
};

const getStatusClassName = (status) => {
  const normalizedStatus = String(status || "").toLowerCase();

  if (normalizedStatus === "cancelled") {
    return "text-red-600";
  }

  if (normalizedStatus === "completed") {
    return "text-green-600";
  }

  if (normalizedStatus === "received") {
    return "text-blue-600";
  }

  if (normalizedStatus === "preparing") {
    return "text-amber-500";
  }

  return "text-gray-500";
};

export default function ActiveOrdersView({
  title,
  backPath,
  fetchOrders,
  searchPlaceholder = "Search order number or name",
}) {
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState(toInputDate(new Date()));
  const [toDate, setToDate] = useState(toInputDate(new Date()));
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedOrderNumber, setSelectedOrderNumber] = useState(null);

  const params = useMemo(
    () => ({
      from: fromDate || undefined,
      to: toDate || undefined,
      search: activeSearch || undefined,
    }),
    [activeSearch, fromDate, toDate]
  );

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetchOrders(params);
      setOrders(response.data?.data || []);
    } catch (requestError) {
      console.error("Failed to load active orders:", requestError);
      setOrders([]);
      setError(
        requestError.response?.data?.message || "Unable to load active orders."
      );
    } finally {
      setLoading(false);
    }
  }, [fetchOrders, params]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleSearch = () => {
    setActiveSearch(searchInput.trim());
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-white relative overflow-hidden">
      <div className="absolute top-16 left-10 h-72 w-72 rounded-full bg-[#d70652]/10 blur-3xl"></div>
      <div className="absolute bottom-10 right-10 h-80 w-80 rounded-full bg-[#ff025e]/10 blur-3xl"></div>

      <div className="relative z-10 p-6 md:p-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">{title}</h1>
            <p className="mt-1 text-sm text-gray-500">
              View current order status and open any order to inspect item-level progress.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate(backPath)}
            className="flex items-center gap-2 rounded-full border border-white/60 bg-white px-5 py-2.5 text-gray-700 shadow hover:shadow-md"
          >
            <FaArrowLeft />
            Back
          </button>
        </div>

        <div className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-xl backdrop-blur-sm">
          <div className="mb-6 flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                From
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                To
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800"
              />
            </div>

            <button
              type="button"
              onClick={loadOrders}
              className="flex items-center gap-2 rounded-2xl bg-[#5b5b5b] px-6 py-3 font-semibold text-white shadow hover:shadow-md"
            >
              <FaSearch />
              Search
            </button>
          </div>

          <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 px-4 py-4">
              <div className="flex flex-1 items-center gap-3">
                <FaSearch className="text-gray-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleSearch();
                    }
                  }}
                  placeholder={searchPlaceholder}
                  className="w-full max-w-sm rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-700 outline-none"
                />
                <button
                  type="button"
                  onClick={handleSearch}
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-gray-700"
                >
                  Go
                </button>
              </div>
            </div>

            {error && (
              <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Order Number</th>
                    <th className="px-4 py-3 text-left font-medium">Order Date</th>
                    <th className="px-4 py-3 text-left font-medium">Name</th>
                    <th className="px-4 py-3 text-left font-medium">Phone</th>
                    <th className="px-4 py-3 text-left font-medium">Amount</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                        Loading active orders...
                      </td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                        No active orders found.
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <tr
                        key={order.order_num}
                        className="border-t border-gray-100 hover:bg-gray-50"
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setSelectedOrderNumber(order.order_num)}
                            className="font-semibold text-[#0077b6] hover:underline"
                          >
                            {order.order_num}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          {formatDisplayDate(order.creation_date || order.order_date)}
                        </td>
                        <td className="px-4 py-3">{order.first_name || "-"}</td>
                        <td className="px-4 py-3">{order.phone_number || "-"}</td>
                        <td className="px-4 py-3">
                          {Number(order.order_total || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`font-semibold ${getStatusClassName(order.status)}`}
                          >
                            {order.status}
                          </span>
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

      <OrderDetailsModal
        isOpen={Boolean(selectedOrderNumber)}
        onClose={() => setSelectedOrderNumber(null)}
        orderNumber={selectedOrderNumber}
      />
    </div>
  );
}
