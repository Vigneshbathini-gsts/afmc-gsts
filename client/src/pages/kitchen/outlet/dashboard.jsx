import React from "react";
import { useAuth } from "../../../context/AuthContext";

export default function OutletDashboard() {
  const { user } = useAuth();
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
