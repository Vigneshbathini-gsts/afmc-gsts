import React from "react";
import { FaBars } from "react-icons/fa";
import UserMenuDropdown from "../common/UserMenuDropdown";
import KitchenOrderBell from "./KitchenOrderBell";
export default function KitchenNavbar({ onMenuClick }) {
  return (
    <header className="bg-white shadow-md sticky top-0 z-30">
      <div className="flex items-center justify-between px-4 md:px-6 py-4">
        {/* Left */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg hover:bg-gray-100 text-2xl text-gray-700 hover:text-[#d70652] transition"
          >
            <FaBars />
          </button>

          <div>
            <h1 className="text-lg md:text-xl font-bold text-gray-800">
              Kitchen Panel
            </h1>
            <p className="text-sm text-gray-500">Manage food preparation</p>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-4">
          <KitchenOrderBell />

          <UserMenuDropdown />
        </div>
      </div>
    </header>
  );
}
