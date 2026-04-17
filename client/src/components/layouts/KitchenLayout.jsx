import React, { useState } from "react";
import { Outlet } from "react-router-dom";

import KitchenSidebar from "../kitchen/KitchenSidebar";
import KitchenNavbar from "../kitchen/KitchenNavbar";
export default function KitchenLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-screen overflow-hidden bg-afmc-bg">
      <KitchenSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-col h-full min-h-0">
        <KitchenNavbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
