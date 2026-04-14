import React from "react";
import { NavLink } from "react-router-dom";
import {
  FaTimes,
  FaBell,
} from "react-icons/fa";

export default function KitchenSidebar({ isOpen, onClose }) {
  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive
      ? "bg-[#d70652] text-white font-semibold shadow-md"
      : "text-gray-700 hover:bg-pink-100 hover:text-[#d70652]"
    }`;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${isOpen ? "opacity-100 visible" : "opacity-0 invisible"
          }`}
        onClick={onClose}
      ></div>

      <aside
        className={`fixed top-0 left-0 h-screen w-72 bg-white shadow-2xl z-50 transform transition-transform duration-300 ${isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-xl font-bold text-[#d70652]">Kitchen Panel</h2>
          <button
            onClick={onClose}
            className="text-2xl text-gray-600 hover:text-red-500 transition"
          >
            <FaTimes />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <NavLink to="/kitchen/dashboard" className={navLinkClass} onClick={onClose}>
            <FaBell />
            Pubmed / Dashboard
          </NavLink>
        </div>
      </aside>
    </>
  );
}
