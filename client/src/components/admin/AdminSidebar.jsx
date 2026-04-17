import React from "react";
import { NavLink } from "react-router-dom";
import {
  FaTachometerAlt,
  FaBoxes,
  FaUserPlus,
  FaHistory,
  FaBan,
  FaTimes,
} from "react-icons/fa";

export default function AdminSidebar({ isOpen, onClose }) {
  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
      isActive
        ? "bg-afmc-maroon text-afmc-gold font-semibold shadow-md"
        : "text-gray-700 hover:bg-afmc-maroon/10 hover:text-afmc-maroon"
    }`;

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
        onClick={onClose}
      ></div>

      {/* Sidebar Drawer */}
      <aside
        className={`fixed top-0 left-0 h-screen w-72 bg-white shadow-2xl z-50 transform transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-1 w-full bg-gradient-to-r from-afmc-maroon via-afmc-gold to-afmc-maroon2" />
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-xl font-bold text-afmc-maroon">AFMC Admin</h2>
          <button
            onClick={onClose}
            className="text-2xl text-gray-600 hover:text-red-500 transition"
          >
            <FaTimes />
          </button>
        </div>

        {/* Menu */}
        <div className="p-4 space-y-3">
          <NavLink
            to="/admin/dashboard"
            className={navLinkClass}
            onClick={onClose}
          >
            <FaTachometerAlt />
            Dashboard
          </NavLink>

          <NavLink
            to="/admin/add-item"
            className={navLinkClass}
            onClick={onClose}
          >
            <FaBoxes />
            Add Stock
          </NavLink>

          <NavLink
            to="/admin/users"
            className={navLinkClass}
            onClick={onClose}
          >
            <FaUserPlus />
            Add User
          </NavLink>

          <NavLink
            to="/admin/order-history"
            className={navLinkClass}
            onClick={onClose}
          >
            <FaHistory />
            Order History
          </NavLink>

          <NavLink
            to="/admin/cancelled-orders"
            className={navLinkClass}
            onClick={onClose}
          >
            <FaBan />
            Cancelled Orders
          </NavLink>
        </div>
      </aside>
    </>
  );
}
