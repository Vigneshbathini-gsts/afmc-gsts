import React from "react";
import { useAuth } from "../../../context/AuthContext";
import OutletOrders from "../OutletOrders";

export default function OutletDashboard() {
  const { user } = useAuth();
  const outletType = user?.outletType || "BAR";
  const isKitchen = outletType === "KITCHEN";

  return (
    <div className="min-h-screen bg-gray-50">
      <OutletOrders kitchenType={isKitchen ? "Kitchen" : "Bar"} />
    </div>
  );
}