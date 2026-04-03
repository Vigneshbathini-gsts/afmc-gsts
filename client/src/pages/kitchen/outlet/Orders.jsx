import React from "react";
import { useAuth } from "../../../context/AuthContext";

export default function OutletOrders() {
  const { user } = useAuth();
  const outletType = user?.outletType || "KITCHEN";

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">{outletType} Orders</h1>
    </div>
  );
}
