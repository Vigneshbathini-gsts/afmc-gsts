import React from "react";
import ActiveOrdersView from "../../components/common/ActiveOrdersView";
import { orderAPI } from "../../services/api";

export default function OrderHistory() {
  return (
    <ActiveOrdersView
      title="Order Status"
      backPath="/attendant/dashboard"
      fetchOrders={orderAPI.getAttendantOrders}
    />
  );
}
