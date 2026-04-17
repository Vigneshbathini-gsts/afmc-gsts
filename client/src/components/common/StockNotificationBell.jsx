import React, { useEffect, useRef, useState } from "react";
import { FaBell, FaExclamationTriangle } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { notificationAPI } from "../../services/api";

export default function StockNotificationBell() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      const res = await notificationAPI.getStockOutNotifications();
      setNotifications(res.data.data || []);
    } catch (error) {
      console.error("Error fetching stock notifications:", error);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const handleMarkAsRead = async (itemCode) => {
    try {
      await notificationAPI.markStockOutRead(itemCode);

      // Remove immediately from UI
      setNotifications((prev) =>
        prev.filter((item) => item.item_code !== itemCode)
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
      alert("Failed to mark notification as read");
    }
  };

  const handleNotificationClick = async (note) => {
    try {
      await notificationAPI.markStockOutRead(note.item_code);

      setNotifications((prev) =>
        prev.filter((item) => item.item_code !== note.item_code)
      );
      setOpen(false);

      navigate(
        `/admin/stock-reports/barstock?itemCode=${encodeURIComponent(
          note.item_code
        )}&itemName=${encodeURIComponent(note.item_name || "")}`
      );
    } catch (error) {
      console.error("Error opening stock notification:", error);
      alert("Failed to open stock notification");
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
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

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-12 w-[min(20rem,calc(100vw-1rem))] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-afmc-maroon to-afmc-maroon2 text-white">
            <h3 className="font-semibold text-sm">Stock Out Notifications</h3>
            <p className="text-xs text-white/80">
              {notifications.length} unread item
              {notifications.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Body */}
          <div className="max-h-[70vh] overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map((note, index) => (
                <div
                  key={index}
                  className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition cursor-pointer"
                  onClick={() => handleNotificationClick(note)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1 text-red-500">
                      <FaExclamationTriangle size={14} />
                    </div>

                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800">
                        {note.note_text}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {note.note_header}
                      </p>

                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleMarkAsRead(note.item_code);
                        }}
                        className="mt-2 text-xs font-medium text-afmc-maroon hover:text-afmc-maroon2 transition"
                      >
                        Mark as Read
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-6 text-center text-sm text-gray-500">
                No unread stock notifications
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
