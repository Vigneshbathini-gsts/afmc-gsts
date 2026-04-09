import React, { useEffect, useState } from "react";
import { FaTimes, FaBoxOpen } from "react-icons/fa";
import { orderAPI } from "../services/api";

export default function OrderDetailsModal({ isOpen, onClose, orderNumber }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !orderNumber) return;

    const fetchOrderDetails = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await orderAPI.getOrderDetails(orderNumber);
        // console.log("Order Details Response:", response.data);
        setItems(response.data?.data || []);
      } catch (err) {
        console.error("Error fetching order details:", err);
        setError("Failed to fetch order details");
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [isOpen, orderNumber]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl p-6 relative animate-fadeIn">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-red-500 text-xl"
        >
          <FaTimes />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-[#d70652] p-3 rounded-xl text-white">
            <FaBoxOpen />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              Order Details
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
            No order details found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border border-gray-200 rounded-xl overflow-hidden">
              <thead className="bg-[#d70652] text-white">
                <tr>
                  <th className="px-4 py-3 text-left">Item Name</th>
                  <th className="px-4 py-3 text-left">Quantity</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">{item.item_name}</td>
                    <td className="px-4 py-3">{item.quantity}</td>
                    <td className="px-4 py-3">{item.type}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-semibold ${
                          item.status?.toLowerCase() === "cancelled"
                            ? "text-red-600"
                            : item.status?.toLowerCase() === "completed"
                            ? "text-green-600"
                            : "text-yellow-600"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}