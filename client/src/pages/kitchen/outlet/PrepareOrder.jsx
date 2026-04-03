import React from "react";

export default function OutletPrepareOrder() {
  const user = JSON.parse(localStorage.getItem("user"));
  const outletType = user?.outletType || "KITCHEN";

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">
        Prepare {outletType === "BAR" ? "Drink" : "Food"} Order
      </h1>
    </div>
  );
}