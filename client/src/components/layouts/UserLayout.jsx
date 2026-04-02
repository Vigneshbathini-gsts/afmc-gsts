import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import UserNavbar from "../user/UserNavbar";
import UserSidebar from "../user/UserSidebar";

export default function UserLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100">
      <UserSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-col min-h-screen">
        <UserNavbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}