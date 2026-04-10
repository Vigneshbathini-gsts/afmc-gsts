import React from "react";
import ActiveOrdersView from "../../components/common/ActiveOrdersView";
import { orderAPI } from "../../services/api";

export default function ActiveOrders() {
  return (
    <ActiveOrdersView
      title="Active Orders"
      backPath="/user/dashboard"
      fetchOrders={orderAPI.getActiveOrders}
    />
  );
}
