import React, { useState } from "react";
import { Outlet } from "react-router-dom";

import KitchenSidebar from "../kitchen/KitchenSidebar";
import KitchenNavbar from "../kitchen/KitchenNavbar";
export default function KitchenLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100">
      <KitchenSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-col min-h-screen">
        <KitchenNavbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}