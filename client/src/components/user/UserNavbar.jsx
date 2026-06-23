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
      <div className="flex items-center justify-between gap-2 px-3 py-3 sm:px-4 md:px-6 md:py-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <button
            onClick={onMenuClick}
            className="shrink-0 p-2 rounded-lg hover:bg-afmc-maroon/10 text-xl sm:text-2xl text-gray-700 hover:text-afmc-maroon transition"
            aria-label="Open navigation menu"
          >
            <FaBars />
          </button>

          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white sm:h-10 sm:w-10">
              <img src={afmclogo} alt="AFMC Logo" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold leading-5 text-gray-800 sm:text-lg md:text-xl">
                AFMC Service
              </h1>
              <p className="truncate text-xs leading-4 text-gray-500 sm:text-sm">User Dashboard</p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 md:gap-4">
          {!hideCartIcon && (
            <button
              className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 hover:bg-afmc-maroon/10 transition sm:h-11 sm:w-11"
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
