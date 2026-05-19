// order API calls
// services/orderService.js

import api from "./api";

const getOrders = (params) => {
  return api.get("/orders", {
    params,
  });
};

const getOrderDetails = (orderNumber) => {
  return api.get(`/orders/${orderNumber}`);
};

const getOrderSummary = (orderNumber) => {
  return api.get(`/orders/${orderNumber}/summary`);
};

const completePayment = (payload) => {
  return api.put("/payment/update", payload);
};

const getPaymentModes = () => {
  return api.get("/payment/modes");
};

const getInvoice = (orderNumber) => {
  return api.get(`/invoice/${orderNumber}`);
};

const getOrderDetailsInPayment = async (orderNumber) => {
  try {
    return await api.get(`/orders/${orderNumber}/details`);
  } catch (error) {
    if (error?.response?.status === 404) {
      return api.get(`/order-history/${orderNumber}/details`);
    }

    throw error;
  }
};

const orderService = {
  getOrders,
  getOrderDetails,
  getOrderSummary,
  completePayment,
  getPaymentModes,
  getInvoice,
  getOrderDetailsInPayment,
  getOrderDetailsInPayement: getOrderDetailsInPayment,
};

export default orderService;
