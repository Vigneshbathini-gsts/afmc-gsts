import React from "react";
import { FaBars, FaUtensils } from "react-icons/fa";
import { useLocation } from "react-router-dom";
import UserMenuDropdown from "../common/UserMenuDropdown";
import StockNotificationBell from "../common/StockNotificationBell";
import logo from "../../assets/AFMC_Logo.png";

const afmclogo = logo;


export default function AdminNavbar({ onMenuClick }) {
  const location = useLocation();
  // const afmclogo= "../../assets/AFMC-logo.png";

  // Show bell only on admin dashboard page
  const showNotificationBell = location.pathname === "/admin/dashboard";

  return (
    <header className="bg-white shadow-md sticky top-0 z-30 border-b border-afmc-maroon/10">
      <div className="flex items-center justify-between px-4 md:px-6 py-4">
        {/* Left */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="text-2xl text-gray-700 hover:text-afmc-maroon transition"
          >
            <FaBars />
          </button>

          <div className="flex items-center gap-3">
            <div className="rounded-xl">
              <img src={afmclogo} alt="AFMC Logo" className="w-8 h-10" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-bold text-gray-800 truncate">
                AFMC MESS
              </h1>
              <p className="text-sm text-gray-500 truncate">Admin Dashboard</p>
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3 md:gap-4">
          {showNotificationBell && <StockNotificationBell />}
          <UserMenuDropdown />
        </div>
      </div>
    </header>
  );
}
