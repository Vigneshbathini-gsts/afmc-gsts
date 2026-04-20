import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function Stackreporttab() {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    {
      name: "Bar Stock Report",
      path: "/admin/stock-reports/barstock",
    },
    {
      name: "Order Transaction Details",
      path: "/admin/stock-reports/order-transaction",
    },
    {
      name: "Order Item Details",
      path: "/admin/stock-reports/order-item",
    },
  ];

  const isOverviewPage = location.pathname === "/admin/stock-reports";

  return (
    <div className="w-full relative z-10">
      <div className="flex justify-between items-center gap-4 mb-4">
        <button
          onClick={() => navigate("/admin/dashboard")}
          className="px-4 py-2 bg-gray-200 rounded-full hover:bg-gray-300"
        >
          Go To Dashboard
        </button>

        {isOverviewPage && (
          <p className="text-sm text-gray-500">
            Choose a report tab to view the report details.
          </p>
        )}
      </div>

      <div className="flex bg-white/70 backdrop-blur-md border border-afmc-gold/25 rounded-xl shadow overflow-hidden">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;

          return (
            <div
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex-1 text-center py-4 cursor-pointer transition-all ${
                isActive
                  ? "relative font-semibold text-afmc-maroon bg-gradient-to-r from-afmc-maroon/5 via-white to-afmc-gold/15"
                  : "text-afmc-maroon hover:bg-afmc-maroon/5"
              }`}
            >
              {isActive && (
                <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-afmc-maroon via-afmc-gold to-afmc-maroon2" />
              )}
              {tab.name}
            </div>
          );
        })}
      </div>
    </div>
  );
}
