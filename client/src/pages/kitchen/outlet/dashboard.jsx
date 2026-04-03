import React from "react";

export default function OutletDashboard() {
    const user = JSON.parse(localStorage.getItem("user"));
  const outletType = user?.outletType || "KITCHEN";

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">{outletType} Dashboard</h1>
      <p className="text-gray-600 mt-2">
        Welcome to {outletType} panel
      </p>
    </div>
  );
}