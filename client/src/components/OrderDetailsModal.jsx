import React, { useEffect, useState } from "react";
import { FaTimes, FaBoxOpen } from "react-icons/fa";
import { orderAPI } from "../services/api";

// Helper function to convert string to INITCAP (Title Case)
const toInitCap = (str) => {
  if (!str || str === "") return "-";
  if (typeof str !== "string") str = String(str);
  return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
};

const parseNumber = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const getStatusClassName = (status) => {
  const normalizedStatus = String(status || "").toLowerCase();

  if (normalizedStatus === "cancelled") return "text-red-600";
  if (normalizedStatus === "completed") return "text-green-600";
  if (normalizedStatus === "received") return "text-blue-600";
  if (normalizedStatus === "preparing") return "text-amber-500";
  if (normalizedStatus === "pending") return "text-amber-600";
  return "text-gray-500";
};

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function OrderDetailsModal({ isOpen, onClose, orderNumber, includeCancelled = false }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const grandTotal = items.reduce(
    (total, item) => total + parseNumber(item.subtotal || item.SUBTOTAL || item.total || 0),
    0
  );

  useEffect(() => {
    if (!isOpen || !orderNumber) return;

    const fetchOrderDetails = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await orderAPI.getOrderDetails(orderNumber, { includeCancelled });
        const responseData = response.data?.data;
        const fetchedItems = Array.isArray(responseData)
          ? responseData
          : Array.isArray(responseData?.items)
            ? responseData.items
            : [];
            // console.log("Fetched order details:", fetchedItems);
        setItems(fetchedItems);
      } catch (err) {
        console.error("Error fetching order details:", err);
        setError("Failed To Fetch Order Details");
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [includeCancelled, isOpen, orderNumber]);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-full sm:max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl p-4 sm:p-6 relative animate-fadeIn">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-red-500 text-xl"
        >
          <FaTimes />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-gradient-to-br from-afmc-maroon to-afmc-maroon2 p-3 rounded-xl text-white">
            <FaBoxOpen />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              Ordered Item Status
            </h2>
            <p className="text-sm text-gray-500">
              Order Number: <span className="font-semibold">{orderNumber}</span>
            </p>
          </div>
        </div>
        {/* Content */}
        {loading ? (
          <div className="text-center py-10 text-gray-500">Loading...</div>
        ) : error ? (
          <div className="text-center py-10 text-red-500">{error}</div>
        ) : items.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            No Order Details Found
          </div>
        ) : (
          <div>
            {/* Desktop/table layout (visible on sm+ screens) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full overflow-hidden rounded-xl border border-gray-200">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left">Item Name</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Quantity</th>
                    <th className="px-4 py-3 text-left">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const priceValue = parseNumber(item.price || item.PRICE);
                    const subtotalValue = parseNumber(item.subtotal || item.SUBTOTAL || item.total);
                    const statusValue =
                      item.status || item.STATUS || item.order_status || item.ORDER_STATUS || "";
                    const normalizedStatus = String(statusValue).trim().toUpperCase();
                    const isCancelled = normalizedStatus === "CANCELLED";
                    const isFreeItem = !isCancelled && priceValue === 0 && subtotalValue === 0;
                    const typeValue =
                      item.type || item.TYPE || item.ac_unit || item.acUnit || (isFreeItem ? "Free Item" : "NA");

                    const displayType =
                      typeValue === "NA" ? "NA" : toInitCap(typeValue);

                    return (
                      <tr key={index} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span>{toInitCap(item.item_name || item.ITEM_NAME)}</span>
                            {isFreeItem && (
                              <span className="text-xs font-semibold text-amber-600">Free item</span>
                            )}
                            {item.free_item_code && item.free_item_quantity && !isFreeItem && (
                              <span className="text-xs text-gray-500">
                                Offer linked: free item code {item.free_item_code}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold ${getStatusClassName(item.status)}`}>
                            {toInitCap(item.status && item.status !== 'Pending' ? item.status : "Received")}
                          </span>
                        </td>
                        <td className="px-4 py-3">{item.quantity || item.QUANTITY || 0}</td>
                        <td className="px-4 py-3">{displayType}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile/card layout (visible on xs screens) */}
            <div className="sm:hidden flex flex-col gap-3">
              {items.map((item, index) => {
                const priceValue = parseNumber(item.price || item.PRICE);
                const subtotalValue = parseNumber(item.subtotal || item.SUBTOTAL || item.total);
                const statusValue =
                  item.status || item.STATUS || item.order_status || item.ORDER_STATUS || "";
                const normalizedStatus = String(statusValue).trim().toUpperCase();
                const isCancelled = normalizedStatus === "CANCELLED";
                const isFreeItem = !isCancelled && priceValue === 0 && subtotalValue === 0;
                const typeValue =
                  item.type || item.TYPE || item.ac_unit || item.acUnit || (isFreeItem ? "Free Item" : "NA");

                const displayType =
                  typeValue === "NA" ? "NA" : toInitCap(typeValue);

                return (
                  <div key={index} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-800">{toInitCap(item.item_name || item.ITEM_NAME)}</div>
                        {isFreeItem && (
                          <div className="text-xs font-semibold text-amber-600">Free item</div>
                        )}
                        {item.free_item_code && item.free_item_quantity && !isFreeItem && (
                          <div className="text-xs text-gray-500">Offer linked: free item code {item.free_item_code}</div>
                        )}
                      </div>
                      <div className="text-sm text-right">
                        <div className={`font-semibold ${getStatusClassName(item.status)}`}>
                          {toInitCap(item.status && item.status !== 'Pending' ? item.status : "Received")}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-gray-600 flex gap-4">
                      <div>Qty: <span className="font-medium text-gray-800">{item.quantity || item.QUANTITY || 0}</span></div>
                      <div>Type: <span className="font-medium text-gray-800">{displayType}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
