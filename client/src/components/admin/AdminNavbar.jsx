import React from "react";
import { FaBars, FaUtensils } from "react-icons/fa";
import UserMenuDropdown from "../common/UserMenuDropdown";
import StockNotificationBell from "../common/StockNotificationBell";

export default function AdminNavbar({ onMenuClick }) {
  return (
    <header className="bg-white shadow-md sticky top-0 z-30">
      <div className="flex items-center justify-between px-4 md:px-6 py-4">
        {/* Left */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="text-2xl text-gray-700 hover:text-[#d70652] transition"
          >
            <FaBars />
          </button>

          <div className="flex items-center gap-3">
            <div className="bg-[#d70652] p-3 rounded-xl text-white shadow">
              <FaUtensils />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-gray-800">
                AFMC MESS
              </h1>
              <p className="text-sm text-gray-500">Admin Dashboard</p>
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-4">
          <StockNotificationBell />
          <UserMenuDropdown />
        </div>
      </div>
    </header>
  );
}