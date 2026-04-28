import React from "react";
import { FaBars } from "react-icons/fa";
import UserMenuDropdown from "../common/UserMenuDropdown";
import KitchenOrderBell from "./KitchenOrderBell";
import { useAuth } from "../../context/AuthContext";
import logo from "../../assets/AFMC_Logo.png";

const afmclogo = logo;
export default function KitchenNavbar({ onMenuClick }) {
  const { user } = useAuth();
  const outletType = String(user?.outletType || "").toUpperCase();
  const isBar = outletType === "BAR";
  const panelLabel = isBar ? "Bar Panel" : "Kitchen Panel";

  return (
    <header className="bg-white shadow-md sticky top-0 z-30 border-b border-afmc-maroon/10">
      <div className="flex items-center justify-between px-4 md:px-6 py-4">
        {/* Left */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg hover:bg-afmc-maroon/10 text-2xl text-gray-700 hover:text-afmc-maroon transition"
          >
            <FaBars />
          </button>

          <div className="flex items-center gap-3">
            <div className="rounded-xl">
              <img src={afmclogo} alt="AFMC Logo" className="w-8 h-10" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-bold text-gray-800 truncate">
                AFMC
              </h1>
              <p className="text-sm text-gray-500 truncate">{panelLabel}</p>
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3 md:gap-4">
          <KitchenOrderBell />

          <UserMenuDropdown />
        </div>
      </div>
    </header>
  );
}
