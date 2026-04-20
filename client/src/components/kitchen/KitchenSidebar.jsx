import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  FaTimes,
  FaUtensils,
  FaHistory,
  FaBan,
  FaWineGlass,
  FaClipboardList,
} from "react-icons/fa";

export default function KitchenSidebar({ isOpen, onClose }) {
  const location = useLocation();

  const basePath = location.pathname.startsWith('/kitchen') ? '/kitchen' : '/bar';
  const isBar = basePath === '/bar';

  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
      isActive
        ? "bg-gradient-to-r from-[#6B1A4F] to-[#7B2252] text-[#DAA520] font-semibold shadow-md"
        : "text-gray-600 hover:bg-[#6B1A4F]/10 hover:text-[#6B1A4F] hover:translate-x-1"
    }`;

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-all duration-300 ${
          isOpen ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
        onClick={onClose}
      ></div>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-screen w-72 bg-gradient-to-b from-white to-[#faf8f9] shadow-xl z-50 transform transition-transform duration-300 flex flex-col ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } border-r border-[#DAA520]/15`}
      >
        {/* Header with AFMC theme */}
        <div className="bg-gradient-to-r from-[#6B1A4F] to-[#7B2252] px-5 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#DAA520]/15 rounded-lg flex items-center justify-center border border-[#DAA520]/30">
                {isBar ? (
                  <FaWineGlass className="text-[#DAA520] text-lg" />
                ) : (
                  <FaUtensils className="text-[#DAA520] text-lg" />
                )}
              </div>
              <h2 className="text-xl font-bold tracking-wider text-[#DAA520]">
                {isBar ? "Bar Panel" : "Kitchen Panel"}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-[#DAA520]/80 hover:text-[#DAA520] bg-white/10 hover:bg-[#DAA520]/20 p-2 rounded-lg transition-all hover:rotate-90"
            >
              <FaTimes className="text-lg" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 p-4 space-y-2">
          {/* Dashboard / Active Orders */}
          <NavLink to={`${basePath}/dashboard`} className={navLinkClass} onClick={onClose}>
            {isBar ? <FaWineGlass className="text-lg" /> : <FaClipboardList className="text-lg" />}
            <span>Pubmed</span>
          </NavLink>

          {/* Order History - Show for BOTH Kitchen and Bar */}
          <NavLink to={`${basePath}/order-history`} className={navLinkClass} onClick={onClose}>
            <FaHistory className="text-lg" />
            <span>Order History</span>
          </NavLink>

          {/* Cancelled Orders - Show for BOTH Kitchen and Bar */}
          <NavLink to={`${basePath}/cancelled-orders`} className={navLinkClass} onClick={onClose}>
            <FaBan className="text-lg" />
            <span>Cancelled Orders</span>
          </NavLink>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-[#DAA520]/10">
          <div className="h-px bg-gradient-to-r from-transparent via-[#DAA520]/30 to-transparent mb-4" />
          <div className="text-center">
            <span className="text-[10px] tracking-wider text-[#6B1A4F]/50 uppercase">
              AFMC v2.0
            </span>
          </div>
        </div>
      </aside>

      {/* Global animation styles */}
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .afmc-sidebar-link {
          animation: slideIn 0.3s ease;
        }
      `}</style>
    </>
  );
}