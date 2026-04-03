import React, { useState } from "react";
import { FaUserCircle, FaSignOutAlt, FaKey, FaChevronDown } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import ChangePasswordModal from "./ChangePasswordModal";

export default function UserMenuDropdown({ username = "Admin" }) {
  const [open, setOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div className="relative">
      {/* User Button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-xl transition"
      >
        <FaUserCircle className="text-xl text-[#d70652]" />
        <span className="font-medium text-gray-800">{username}</span>
        <FaChevronDown className="text-sm text-gray-500" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border z-50 overflow-hidden">
          <button
            onClick={() => {
              setPasswordModalOpen(true);
              setOpen(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-pink-50 text-gray-700"
          >
            <FaKey className="text-[#d70652]" />
            Change Password
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-50 text-red-600"
          >
            <FaSignOutAlt />
            Sign Out
          </button>
        </div>
      )}

      {/* Password Modal */}
      <ChangePasswordModal
        isOpen={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
      />
    </div>
  );
}