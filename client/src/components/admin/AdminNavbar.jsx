import React from "react";
import { FaBars } from "react-icons/fa";
import { useLocation } from "react-router-dom";
import UserMenuDropdown from "../common/UserMenuDropdown";
import StockNotificationBell from "../common/StockNotificationBell";
import logo from "../../assets/AFMC_Logo.png";

const afmclogo = logo;

export default function AdminNavbar({ onMenuClick }) {
  const location = useLocation();

  const isDashboard = location.pathname === "/admin/dashboard";

  return (
    <header className="bg-white shadow-md sticky top-0 z-30 border-b border-afmc-maroon/10">
      <div className="px-3 md:px-6 py-3 relative">
        {/* Mobile Layout */}
        <div className="flex justify-between items-start sm:hidden">
          {/* Left */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={onMenuClick}
              className="text-2xl text-gray-700 hover:text-afmc-maroon transition p-2 rounded-lg flex-shrink-0"
            >
              <FaBars />
            </button>

            <img
              src={afmclogo}
              alt="AFMC Logo"
              className="w-8 h-10 flex-shrink-0"
            />

            <div className="min-w-0">
              <h1 className="text-sm font-bold text-gray-800 whitespace-nowrap">
                AFMC MESS
              </h1>

              <p className="text-xs text-gray-500 whitespace-nowrap">
                Admin Dashboard
              </p>
            </div>
          </div>
        </div>

        <div className="absolute right-3 top-3 flex items-center gap-2 z-10 sm:hidden">
          {isDashboard && (
            <div>
              <StockNotificationBell />
            </div>
          )}

          <UserMenuDropdown compact={!isDashboard} iconOnly />
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onMenuClick}
              className="text-2xl text-gray-700 hover:text-afmc-maroon transition p-2 rounded-lg flex-shrink-0"
            >
              <FaBars />
            </button>

            <img
              src={afmclogo}
              alt="AFMC Logo"
              className="w-8 h-10 flex-shrink-0"
            />

            <div>
              <h1 className="text-xl font-bold text-gray-800">
                AFMC MESS
              </h1>

              <p className="text-sm text-gray-500">
                Admin Dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isDashboard && <StockNotificationBell />}

            <UserMenuDropdown compact={!isDashboard} />
          </div>
        </div>
      </div>
    </header>
  );
}