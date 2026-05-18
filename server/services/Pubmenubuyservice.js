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

const updateOrderItemQuantity = async (orderNumber, itemCode, delta, authUser) => {
  return Pubmenubuymodel.updateOrderItemQuantity(orderNumber, itemCode, delta, authUser);
};

const deleteOrderItem = async (orderNumber, itemCode) => {
  return Pubmenubuymodel.deleteOrderItem(orderNumber, itemCode);
};

const getOrderCocktailDetails = async (orderNumber, itemCode) => {
  return Pubmenubuymodel.getOrderCocktailDetails(orderNumber, itemCode);
};

const updateOrderCocktailIngredients = async (orderNumber, itemCode, ingredients, authUser) => {
  return Pubmenubuymodel.updateOrderCocktailIngredients(orderNumber, itemCode, ingredients, authUser);
};

module.exports = {
  createOrder,
  getOrderSummary,
  cancelOrder,
  updateOrderItemQuantity,
  deleteOrderItem,
  getOrderCocktailDetails,
  updateOrderCocktailIngredients,
};
