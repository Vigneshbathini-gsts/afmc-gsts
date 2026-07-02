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

  const isDashboard = location.pathname === "/user/dashboard";

  const CartButton = () => (
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
  );

  return (
    <header className="bg-white shadow-md sticky top-0 z-30 border-b border-afmc-maroon/10">
      <div className="px-3 py-3 md:px-6 md:py-4">
        <div className="flex items-start justify-between gap-3 sm:hidden">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              onClick={onMenuClick}
              className="flex-shrink-0 rounded-lg p-2 text-2xl text-gray-700 transition hover:bg-afmc-maroon/10 hover:text-afmc-maroon"
              aria-label="Open navigation menu"
            >
              <FaBars />
            </button>

            <img src={afmclogo} alt="AFMC Logo" className="h-10 w-8 flex-shrink-0" />

            <div className="min-w-0">
              <h1 className="whitespace-nowrap text-sm font-bold text-gray-800">AFMC Service</h1>
              <p className="whitespace-nowrap text-xs text-gray-500">User Dashboard</p>
            </div>
          </div>

          <div className="z-10 flex items-center gap-2">
            {!hideCartIcon && <CartButton />}
            <UserMenuDropdown compact={!isDashboard} iconOnly />
          </div>
        </div>

        <div className="hidden items-center justify-between sm:flex">
          <div className="flex items-center gap-4">
            <button
              onClick={onMenuClick}
              className="rounded-lg p-2 text-2xl text-gray-700 transition hover:bg-afmc-maroon/10 hover:text-afmc-maroon"
              aria-label="Open navigation menu"
            >
              <FaBars />
            </button>

            <div className="flex min-w-0 items-center gap-3">
              <img src={afmclogo} alt="AFMC Logo" className="h-10 w-8" />

              <div>
                <h1 className="text-lg font-bold text-gray-800 md:text-xl">AFMC Service</h1>
                <p className="text-sm text-gray-500">User Dashboard</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-4">
            {!hideCartIcon && <CartButton />}
            <UserMenuDropdown compact={!isDashboard} />
          </div>
        </div>
      </div>
    </header>
  );
}