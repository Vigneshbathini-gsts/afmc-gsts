import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import UserNavbar from "../user/UserNavbar";
import UserSidebar from "../user/UserSidebar";

export default function UserLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-screen overflow-hidden bg-afmc-bg">
      <UserSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-col h-full min-h-0">
        <UserNavbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
