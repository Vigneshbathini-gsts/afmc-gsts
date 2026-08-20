const Pubmenubuymodel = require("./Pubmenubuymodel");

const getOrderSummary = async (orderNumber) => {
  return Pubmenubuymodel.getOrderSummary(orderNumber);
};

const createOrder = async (payload, authUser) => {
  return Pubmenubuymodel.createOrder(payload, authUser);
};

const cancelOrder = async (orderNumber) => {
  return Pubmenubuymodel.cancelOrder(orderNumber);
};

const updateOrderItemQuantity = async (orderNumber, itemCode, delta, authUser) => {
  return Pubmenubuymodel.updateOrderItemQuantity(orderNumber, itemCode, delta, authUser);
};

const deleteOrderItem = async (orderNumber, itemCode, orderLineId = null) => {
  return Pubmenubuymodel.deleteOrderItem(orderNumber, itemCode, orderLineId);
};

const updateOrderLineQuantity = async (orderNumber, orderLineId, userId, quantity) => {
  return Pubmenubuymodel.updateOrderLineQuantity(orderNumber, orderLineId, userId, quantity);
};

const updateOrderItemCustomization = async (orderNumber, itemCode, userId, ingredients, authUser) => {
  return Pubmenubuymodel.updateOrderItemCustomization(orderNumber, itemCode, userId, ingredients, authUser);
};

module.exports = {
  createOrder,
  getOrderSummary,
  cancelOrder,
  updateOrderItemQuantity,
  deleteOrderItem,
  updateOrderLineQuantity,
  updateOrderItemCustomization,
};
