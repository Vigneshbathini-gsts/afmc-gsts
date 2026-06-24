import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import AdminNavbar from "../admin/AdminNavbar";
import AdminSidebar from "../admin/AdminSidebar";

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const isStockReportsPage = location.pathname.startsWith("/admin/stock-reports");

  return (
    <div className="h-screen w-full overflow-hidden bg-afmc-bg">
      {/* Sidebar */}
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content */}
      <div className="flex flex-col h-full min-h-0 w-full">
        <AdminNavbar onMenuClick={() => setSidebarOpen(true)} />

        <main
          className={`flex-1 min-h-0 w-full overflow-y-auto ${
            isStockReportsPage ? "p-0 md:p-6" : "p-4 md:p-6"
          }`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
