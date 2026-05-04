import React, { useCallback, useEffect, useRef, useState } from "react";
import { FaBell, FaUtensils } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { barOrdersAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

export default function KitchenOrderBell({ kitchen = "Bar" }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const basePath =
    String(user?.outletType || "").toUpperCase() === "KITCHEN" ? "/kitchen" : "/bar";

  // ✅ Fetch Orders
  const fetchOrders = useCallback(async () => {
    try {
      const res = await barOrdersAPI.getActiveOrders(kitchen);

      const orders = res?.data?.data || [];

      setNotifications((prev) => {
        // prevent unnecessary re-renders
        if (JSON.stringify(prev) === JSON.stringify(orders)) return prev;
        return orders;
      });
    } catch (error) {
      console.error("Error fetching orders:", error);
    }
  }, [kitchen]);

  // ✅ Polling
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // ✅ Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () =>
      document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // ✅ Mark as read
  const handleMarkAsRead = async (notificationId) => {
    console.log("Marking notification as read:", notificationId);
    try {
      const resp = await barOrdersAPI.markNotificationAsRead({
        notification_id: notificationId,
      });
      console.log("Mark as read response:", resp);
      setNotifications((prev) =>
        prev.filter((n) => n.NOTIFICATION_ID !== notificationId)
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  // ✅ Handle click
  const handleOrderClick = async (order) => {
    const orderNumber = order?.ORDERNUMBER ?? order?.orderNumber;
    if (!orderNumber) return;

    try {
      await handleMarkAsRead(order.NOTIFICATION_ID);
    } finally {
      const params = new URLSearchParams();
      params.set("orderNumber", String(orderNumber));
      params.set("kitchenType", String(kitchen || "Bar"));

      navigate(`${basePath}/order-details?${params.toString()}`, {
        state: { ...order, ORDERNUMBER: orderNumber, kitchenType: kitchen },
      });
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 🔔 Bell Icon */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-3 rounded-xl bg-gray-100 hover:bg-afmc-maroon/10 transition"
      >
        <FaBell className="text-gray-700 text-lg" />
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 flex items-center justify-center text-[11px] font-bold bg-red-500 text-white rounded-full shadow">
            {notifications.length}
          </span>
        )}
      </button>

      {/* 🔽 Dropdown */}
      {open && (
        <div className="absolute top-12 right-0 w-[min(24rem,calc(100vw-1rem))] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-50">
          <div className="px-4 py-3 bg-gradient-to-r from-afmc-maroon to-afmc-maroon2 text-white">
            <h3 className="font-semibold text-sm">
              New Orders - {kitchen}
            </h3>
            <p className="text-xs text-white/80">
              {notifications.length} pending order(s)
            </p>
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map((order) => (
                <div
                  key={order.NOTIFICATION_ID}
                  className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition cursor-pointer"
                  onClick={() => handleOrderClick(order)}
                >
                  <div className="flex items-start gap-3">
                    <FaUtensils className="mt-1 text-afmc-maroon" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800">
                        Order #{order.ORDERNUMBER}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Customer: {order.FIRST_NAME || "Guest"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(
                          order.CREATION_DATE
                        ).toLocaleString()}
                      </p>
                    </div>
                    <div className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                      New
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-6 text-center text-sm text-gray-500">
                No pending orders
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
