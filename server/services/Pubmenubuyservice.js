const Pubmenubuymodel = require("../models/Pubmenubuymodel");

const getOrderSummary = async (orderNumber) => {
  return Pubmenubuymodel.getOrderSummary(orderNumber);
};

const createOrder = async (payload, authUser) => {
  return Pubmenubuymodel.createOrder(payload, authUser);
};

const cancelOrder = async (orderNumber) => {
  return Pubmenubuymodel.cancelOrder(orderNumber);
};

const updateOrderLineQuantity = async (orderNumber, orderLineId, userId, quantity) => {
  return Pubmenubuymodel.updateOrderLineQuantity(orderNumber, orderLineId, userId, quantity);
};

module.exports = {
  createOrder,
  getOrderSummary,
  cancelOrder,
  updateOrderLineQuantity,
};
