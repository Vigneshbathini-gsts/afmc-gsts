import React from "react";
import { FaBars, FaShoppingCart } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import UserMenuDropdown from "../common/UserMenuDropdown";
import { useAuth } from "../../context/AuthContext";
import logo from "../../assets/AFMC_Logo.png";

const afmclogo = logo;

export default function UserNavbar({ onMenuClick }) {
  const { cartCount } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const hiddenCartPaths = [
    "/user/dashboard",
    "/user/dashboard-Page",
    "/user/confirm-order-page",
    "/user/payment",
    "/user/invoice",
    "/user/active-orders",
    "/user/order-status",
    "/user/cart/buy",
    "/user/Buyflowconfirmorder",
  ];

  const hideCartIcon =
    hiddenCartPaths.includes(location.pathname) ||
    location.pathname.startsWith("/user/invoice/") ||
    location.pathname.startsWith("/user/payment/");

  return (
    <header className="bg-white shadow-md sticky top-0 z-30 border-b border-afmc-maroon/10">
      <div className="flex items-center justify-between px-4 md:px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg hover:bg-afmc-maroon/10 text-2xl text-gray-700 hover:text-afmc-maroon transition"
            aria-label="Open navigation menu"
          >
            <FaBars />
          </button>

          <div className="flex items-center gap-3 min-w-0">
            <div className="rounded-xl">
              <img src={afmclogo} alt="AFMC Logo" className="w-8 h-10" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-bold text-gray-800 truncate">
                AFMC Service
              </h1>
              <p className="text-sm text-gray-500 truncate">User Dashboard</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          {!hideCartIcon && (
            <button
              className="relative p-3 rounded-xl bg-gray-100 hover:bg-afmc-maroon/10 transition"
              onClick={() => navigate("/user/cart")}
              aria-label="Open cart"
            >
              <FaShoppingCart className="text-gray-700" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          )}
          <UserMenuDropdown />
        </div>
      </div>
    </header>
  );
}
