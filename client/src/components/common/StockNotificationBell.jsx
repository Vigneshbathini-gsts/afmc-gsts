import React, { useEffect, useRef, useState } from "react";
import { FaBell, FaExclamationTriangle } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { notificationAPI } from "../../services/api";

export default function StockNotificationBell() {
  const navigate = useNavigate();
  const location = useLocation();
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

  // Close dropdown when route changes
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);


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
    // Close dropdown immediately to remove any overlay/backdrop
    // before navigating (prevents UI/modal conflicts)
    setOpen(false);

    try {
      await notificationAPI.markStockOutRead(note.item_code);

      setNotifications((prev) =>
        prev.filter((item) => item.item_code !== note.item_code)
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
      // proceed to navigate even if marking as read failed
    }

    navigate(
      `/admin/stock-reports/barstock?itemCode=${encodeURIComponent(
        note.item_code
      )}&itemName=${encodeURIComponent(note.item_name || "")}`
    );
  };

  return (
    <div className="relative inline-flex" ref={dropdownRef}>
      {/* Bell Button */}
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

      {/* Dropdown */}
      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40 sm:hidden"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed inset-x-4 top-20 bottom-4 overflow-hidden bg-white rounded-3xl shadow-2xl border border-gray-200 z-50 sm:absolute sm:inset-auto sm:top-full sm:mt-2 sm:right-0 sm:w-[min(20rem,calc(100vw-1rem))] sm:max-w-[20rem]"
          >
          {/* Header */}
          <div className="flex flex-col gap-2 px-4 py-3 bg-gradient-to-r from-afmc-maroon to-afmc-maroon2 text-white sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-sm">Stock Out Notifications</h3>
              <p className="text-xs text-white/80">
                {notifications.length} unread item
                {notifications.length !== 1 ? "s" : ""}
              </p>
            </div>
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
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="mt-0 text-red-500 sm:mt-1">
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
      </>
      )}
    </div>
  );
}
