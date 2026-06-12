import React, { useCallback, useEffect, useRef, useState } from "react";
import { FaBell, FaClosedCaptioning, FaTimesCircle, FaUtensils } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { barOrdersAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

export default function KitchenOrderBell({ kitchen = "Bar" }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const basePath =
    String(user?.outletType || "").toUpperCase() === "KITCHEN" ? "/kitchen" : "/bar";

  //   Fetch Orders
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

  //   Polling
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  //   Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
        setShowClearConfirm(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () =>
      document.removeEventListener("mousedown", handleOutsideClick);
  }, []);


  const handleCloseModel = () => {
    setOpen(false);
    setShowClearConfirm(false);
  };

  // Close dropdown when route changes (ensures it doesn't remain open after navigation)
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // compute mobile dropdown position to sit below header

  //   Mark as read
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

  const handleClearAll = () => {
    if (notifications.length === 0 || clearingAll) return;
    setShowClearConfirm(true);
  };

  const handleConfirmClearAll = async () => {
    setShowClearConfirm(false);
    try {
      setClearingAll(true);
      await barOrdersAPI.markAllNotificationsAsRead({ kitchen });
      setNotifications([]);
    } catch (error) {
      console.error("Error clearing notifications:", error);
      alert("Failed to clear notifications. Please try again.");
    } finally {
      setClearingAll(false);
    }
  };

  const handleCancelClearAll = () => {
    setShowClearConfirm(false);
  };

  //   Handle click
  const handleOrderClick = async (order) => {
    const orderNumber = order?.ORDERNUMBER ?? order?.orderNumber;
    if (!orderNumber) return;

    // Close the dropdown immediately to remove any overlay/backdrop
    // before navigating/opening the order details (prevents UI conflicts)
    setOpen(false);

    try {
      await handleMarkAsRead(order.NOTIFICATION_ID);
    } finally {
      const params = new URLSearchParams();
      params.set("orderNumber", String(orderNumber));
      params.set("kitchenType", String(kitchen || "Bar"));

      navigate(`${basePath}/order-details?${params.toString()}`, {
        state: { ...order, ORDERNUMBER: orderNumber, kitchenType: kitchen },
      });
    }
  };

  return (
    <div className="relative inline-flex" ref={dropdownRef}>
      {/*   Bell Icon */}
      <button
        onClick={() => setOpen(!open)}
        className="relative inline-flex items-center justify-center p-3 rounded-xl bg-gray-100 hover:bg-afmc-maroon/10 transition"
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
      <>
  <div
    className="fixed inset-0 bg-black/20 z-40 sm:hidden"
    onClick={() => setOpen(false)}
  />
  <div
    className="fixed inset-x-4 top-20 bottom-4 overflow-hidden bg-white rounded-3xl shadow-2xl border border-gray-200 z-50 sm:absolute sm:inset-auto sm:top-full sm:mt-2 sm:right-0 sm:w-[min(24rem,calc(100vw-1rem))] sm:max-w-[24rem]"
  >
    <div className="flex flex-col gap-2 px-4 py-3 bg-gradient-to-r from-afmc-maroon to-afmc-maroon2 text-white sm:flex-row sm:items-center sm:justify-between">
      <div className="w-full flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">
            New Orders - {kitchen}
          </h3>
          <p className="text-xs text-white/80">
            {notifications.length} pending order(s)
          </p>
        </div>

        <FaTimesCircle
          className="cursor-pointer text-white/80 hover:text-white transition-colors text-xl"
          onClick={handleCloseModel}
        />
      </div>

      {notifications.length > 0 && (
        <button
          type="button"
          onClick={handleClearAll}
          disabled={clearingAll}
          className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/30 transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {clearingAll ? "Clearing..." : "Clear all"}
        </button>
      )}
    </div>

    <div className="max-h-[70vh] overflow-y-auto">
      {notifications.length > 0 ? (
        notifications.map((order) => (
          <div
            key={order.NOTIFICATION_ID}
            className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition cursor-pointer"
            onClick={() => handleOrderClick(order)}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <FaUtensils className="text-afmc-maroon flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">
                  Order {order.ORDERNUMBER}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Customer: {order.FIRST_NAME || "Guest"}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(order.CREATION_DATE).toLocaleString()}
                </p>
              </div>
              <div className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full self-start">
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
</>
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-gray-200">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Confirm clear all
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Clear all {notifications.length} pending notification(s)?
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleCancelClearAll}
                  className="w-full rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClearAll}
                  disabled={clearingAll}
                  className="w-full rounded-full bg-afmc-maroon px-4 py-2 text-sm font-medium text-white hover:bg-afmc-maroon2 transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {clearingAll ? "Clearing..." : "Yes, clear all"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
