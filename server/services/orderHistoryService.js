const orderModel = require("../models/orderHistoryModel");

const fetchOrderHistory = async (filters) => {
  const orders = await orderModel.getOrderHistory(filters);

  return orders.map((order) => ({
    ...order,
    isPaymentEditable: order.payment_status === "Un Paid",
  }));
};

const fetchOrderDetails = async (orderId) => {
  const items = await orderModel.getOrderDetails(orderId);

  let total = 0;

  items.forEach((item) => {
    total += Number(item.subtotal);
  });

  return {
    items,
    total,
  };
};


const getOrderDetails = async (orderNumber) => {
  const orderDetails = await orderModel.fetchOrderDetails(orderNumber);

  return orderDetails;
};

module.exports = {
  fetchOrderHistory,
  fetchOrderDetails,
  getOrderDetails,
};