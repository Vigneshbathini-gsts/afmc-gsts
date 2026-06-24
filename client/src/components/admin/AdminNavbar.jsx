import React from "react";
import { FaBars } from "react-icons/fa";
import { useLocation } from "react-router-dom";
import UserMenuDropdown from "../common/UserMenuDropdown";
import StockNotificationBell from "../common/StockNotificationBell";
import logo from "../../assets/AFMC_Logo.png";

const afmclogo = logo;

export default function AdminNavbar({ onMenuClick }) {
  const location = useLocation();

  // Show bell only on admin dashboard page
  const showNotificationBell = location.pathname === "/admin/dashboard";

  return (
    <header className="bg-white shadow-md sticky top-0 z-30 border-b border-afmc-maroon/10">
      <div className="flex items-center justify-between px-3 md:px-6 py-4 gap-2">
        {/* Left Section */}
        <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
          <button
            onClick={onMenuClick}
            className="text-2xl text-gray-700 hover:text-afmc-maroon transition p-2 rounded-lg flex-shrink-0"
          >
            <FaBars />
          </button>

          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            <img
              src={afmclogo}
              alt="AFMC Logo"
              className="w-7 h-9 flex-shrink-0"
            />

            <div className="min-w-0">
              <h1 className="text-sm sm:text-base md:text-xl font-bold text-gray-800 whitespace-nowrap">
                AFMC MESS
              </h1>

              <p className="hidden sm:block text-xs sm:text-sm text-gray-500">
                Admin Dashboard
              </p>
            </div>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex flex-col items-end sm:flex-row sm:items-center sm:gap-4 flex-shrink-0">
          {showNotificationBell && <StockNotificationBell />}

          <div className="mt-1 sm:mt-0">
            <UserMenuDropdown />
          </div>
        </div>
      </div>
    </header>
  );
}