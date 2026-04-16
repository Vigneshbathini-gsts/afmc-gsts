import React, { useState, useEffect, useRef } from "react";
import {
  FaUserCircle,
  FaSignOutAlt,
  FaKey,
  FaChevronDown,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import ChangePasswordModal from "./ChangePasswordModal";
import { useAuth } from "../../context/AuthContext";

export default function UserMenuDropdown({ username }) {
  const [open, setOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  const navigate = useNavigate();
  const { user, clearUser } = useAuth();

  const dropdownRef = useRef(null);

  const displayName = username || user?.username || "User";

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("token");
    clearUser();
    navigate("/login");
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () =>
      document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* User Button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-gray-100 hover:bg-afmc-maroon/10 px-4 py-2 rounded-xl transition"
      >
        <FaUserCircle className="text-xl text-afmc-maroon" />
        <span className="font-medium text-gray-800">
          {displayName}
        </span>
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
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-afmc-maroon/5 text-gray-700"
          >
            <FaKey className="text-afmc-maroon" />
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
