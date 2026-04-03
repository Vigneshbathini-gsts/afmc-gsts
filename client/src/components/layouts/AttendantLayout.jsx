import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import AttendantNavbar from "../attendant/AttendantNavbar";
import AttendantSidebar from "../attendant/AttendantSidebar";

export default function AttendantLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100">
      <AttendantSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-col min-h-screen">
        <AttendantNavbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}